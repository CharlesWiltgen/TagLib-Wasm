/**
 * @fileoverview Pure album grouping over a FolderScanResult (2026-08-03 spec).
 *
 * Given a folder scan, produce albums with disc subdivisions, using embedded
 * tags as authority and folder/filename structure as evidence. Synchronous,
 * runtime-agnostic, no wasm, no I/O: everything the algorithm needs arrives
 * in the scan result (tags, paths, statuses). taglib-ys7m split: disc
 * recognition lives in folder-disc.ts, identity in album-identity.ts, disc
 * assembly in album-discs.ts, types in album-types.ts.
 *
 * Model contract (invariants, enforced by tests):
 *   1. Every ok item appears exactly once across albums[*].items, singles,
 *      and unmatched; errors is disjoint.
 *   2. discs >= 1 per album; items >= 1 per disc.
 *   3. discNumber === tagDiscNumber ?? folderDiscNumber on every disc.
 *   4. key is stable for identical input.
 *   5. Every item's albumDir/discNumber match the disc it was assigned to.
 *   6. compilation is true/false only under full tag agreement, else undefined.
 *   7. singles holds exactly the ok items whose resolved album has one file.
 */

import { basename } from "../utils/path.ts";
import { dirname } from "./folder-disc.ts";
import type { FolderScanResult } from "./types.ts";
import type {
  AlbumGroup,
  AlbumGroupingResult,
  DirNode,
  DiscConfidence,
  DiscParse,
  GroupAlbumsOptions,
  OkItem,
} from "./album-types.ts";
import { baseConfidence, parseDiscName } from "./folder-disc.ts";
import { CONFIDENCE_RANK, corroborated } from "./album-corroborate.ts";
import { buildAlbumIdentity } from "./album-identity.ts";
import { assembleDiscs } from "./album-discs.ts";

// ---------------------------------------------------------------------------
// Flat filename prefixes (spec step 4)
// ---------------------------------------------------------------------------

function flatPrefix(
  filename: string,
): { disc: number; form: "separated" | "compact" } | undefined {
  // Separated: 1-01, 1.01, 1_01, 1-1 — explicit, no plausibility check.
  const separated = filename.match(/^(\d{1,2})[\s._-](\d{1,2})/);
  if (separated) return { disc: parseInt(separated[1], 10), form: "separated" };
  // Compact: 101 = disc 1, track 01 — ambiguous; caller validates plausibility.
  const compact = filename.match(/^(\d)(\d{2})(?:\D|$)/);
  if (compact) return { disc: parseInt(compact[1], 10), form: "compact" };
  return undefined;
}

// ---------------------------------------------------------------------------
// Pipeline steps (spec steps 1-4)
// ---------------------------------------------------------------------------

/** Step 1: split ok items from errors. */
function normalizeOk(
  result: FolderScanResult,
): { okItems: OkItem[]; errors: Array<{ path: string; error: Error }> } {
  const okItems: OkItem[] = [];
  const errors: Array<{ path: string; error: Error }> = [];
  for (const item of result.items) {
    if (item.status === "ok") {
      okItems.push({ path: item.path, tags: item.tags, metadata: item });
    } else {
      errors.push({ path: item.path, error: item.error });
    }
  }
  return { okItems, errors };
}

/** Step 2: directory tree reconstruction. */
function buildTree(okItems: OkItem[]): Map<string, DirNode> {
  const tree = new Map<string, DirNode>();
  for (const item of okItems) {
    const dir = dirname(item.path);
    let node = tree.get(dir);
    if (!node) {
      node = { files: [], parent: dirname(dir) };
      tree.set(dir, node);
    }
    node.files.push(item);
  }
  return tree;
}

/**
 * Step 3: folder disc recognition per directory containing audio, with
 * sibling corroboration. Exact names are discs outright (word/roman at low
 * confidence). Embedded and volume names are discs at medium, upgraded to
 * high by corroboration. Low-tier names (Bonus Disc, bare numbers/letters)
 * are discs only with corroboration, at low confidence.
 */
function confirmDiscs(
  tree: Map<string, DirNode>,
  minRank: number,
): Map<string, { parse: DiscParse; confidence: DiscConfidence }> {
  const confirmedDiscs = new Map<
    string,
    { parse: DiscParse; confidence: DiscConfidence }
  >();
  for (const [dir, node] of tree) {
    if (node.files.length === 0) continue;
    const parse = parseDiscName(basename(dir));
    if (!parse) continue;
    const siblings = [...tree.keys()].filter(
      (d) => d !== dir && dirname(d) === dirname(dir),
    );
    const corroboratedBySiblings = corroborated(parse, siblings);
    // Gated names (title-word markers, side letters, bonus, bare) keep low
    // confidence even when corroborated; everything else upgrades to high.
    let confidence = parse.gated ? "low" : baseConfidence(parse);
    if (parse.gated) {
      if (!corroboratedBySiblings) continue;
    } else if (parse.kind === "bonus" || parse.kind === "bare") {
      if (!corroboratedBySiblings) continue;
    } else if (corroboratedBySiblings) {
      confidence = "high";
    }
    if (CONFIDENCE_RANK[confidence] < minRank) continue;
    confirmedDiscs.set(dir, { parse, confidence });
  }
  return confirmedDiscs;
}

/**
 * Step 4: flat filename prefixes — subdivide a directory's files into discs
 * when two or more distinct prefixes appear. Never inside a disc folder.
 * Separated forms are explicit; compact-only sets must be plausible (each
 * distinct prefix within 1..N, N = distinct count).
 */
function flatSubdivisions(
  tree: Map<string, DirNode>,
  confirmedDiscs: Map<string, { parse: DiscParse; confidence: string }>,
  useFlatPrefixes: boolean,
): Map<string, Map<string, number>> {
  const flat = new Map<string, Map<string, number>>();
  if (!useFlatPrefixes) return flat;
  for (const [dir, node] of tree) {
    if (node.files.length === 0 || confirmedDiscs.has(dir)) continue;
    const byFile = new Map<string, number>();
    const forms = new Set<string>();
    for (const item of node.files) {
      const prefix = flatPrefix(basename(item.path));
      if (prefix) {
        byFile.set(item.path, prefix.disc);
        forms.add(prefix.form);
      }
    }
    if (byFile.size < 2) continue;
    const distinct = [...new Set(byFile.values())].sort((a, b) => a - b);
    // Separated forms are explicit. A compact-only set must be plausible:
    // every distinct prefix within 1..N where N = the distinct count
    // (101+201 split; 101+102 stay one disc; 101+301 do not split).
    const allCompact = forms.size === 1 && forms.has("compact");
    const plausible = allCompact
      ? distinct.every((d) => d >= 1 && d <= distinct.length)
      : true;
    if (plausible) flat.set(dir, byFile);
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function groupAlbums(
  result: FolderScanResult,
  options: GroupAlbumsOptions = {},
): AlbumGroupingResult {
  const minRank = CONFIDENCE_RANK[options.minFolderConfidence ?? "low"];
  const useFlatPrefixes = options.flatDiscPrefixes ?? true;
  const useFolderFallback = options.folderFallback ?? true;

  const { okItems, errors } = normalizeOk(result);
  if (okItems.length === 0) {
    return { albums: [], singles: [], unmatched: [], errors };
  }

  const tree = buildTree(okItems);
  const confirmedDiscs = confirmDiscs(tree, minRank);
  const flat = flatSubdivisions(tree, confirmedDiscs, useFlatPrefixes);

  const { albums, unmatched } = buildAlbumIdentity(
    okItems,
    confirmedDiscs,
    flat,
    { scanRoot: options.scanRoot, useFolderFallback },
  );

  const groups = assembleDiscs(albums);

  // Step 8: singles (1-file albums), unmatched, sort albums.
  const albumsOut: AlbumGroup[] = [];
  const singles: AlbumGroupingResult["singles"] = [];
  for (const group of groups) {
    if (group.items.length === 1) {
      singles.push(group.items[0]);
    } else {
      albumsOut.push(group);
    }
  }
  albumsOut.sort((a, b) =>
    (a.albumArtist ?? "").localeCompare(b.albumArtist ?? "") ||
    (a.album ?? "").localeCompare(b.album ?? "")
  );

  return { albums: albumsOut, singles, unmatched, errors };
}
