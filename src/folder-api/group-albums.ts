/**
 * @fileoverview Pure album grouping over a FolderScanResult (2026-08-03 spec).
 *
 * Given a folder scan, produce albums with disc subdivisions, using embedded
 * tags as authority and folder/filename structure as evidence. Synchronous,
 * runtime-agnostic, no wasm, no I/O: everything the algorithm needs arrives
 * in the scan result (tags, paths, statuses).
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

import type { AudioFileMetadata, FolderScanResult } from "./types.ts";
import { basename } from "../utils/path.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AlbumGroupKey = string & { __brand: "AlbumGroupKey" };

export type DiscConfidence = "high" | "medium" | "low";

/** A file inside an album, carrying its own resolution. */
export interface AlbumGroupItem extends AudioFileMetadata {
  /** The album directory this file resolves to: its own directory, or one
   * level up when that directory is a confirmed disc folder. */
  albumDir: string;
  /** This file's resolved disc number — the containing disc's resolved
   * number; undefined for discs with no number. */
  discNumber: number | undefined;
}

export interface AlbumDisc {
  /** Resolved disc number: tag value when files agree, else folder-implied. */
  discNumber: number | undefined;
  /** Total discs: common tag totalDiscs, else "of N" from folder, else max sibling number. */
  totalDiscs: number | undefined;
  /** Disc number parsed from the folder name; absent when no folder evidence. */
  folderDiscNumber: number | undefined;
  /** Subtitle after the marker, e.g. "Bonus Tracks" from "Disc 2 (Bonus Tracks)". */
  folderDiscTitle: string | undefined;
  /** Disc number from embedded tags; present only when all tagged files in the disc agree. */
  tagDiscNumber: number | undefined;
  /** Confidence in the folder-name evidence; "high" for tag-derived discs. */
  confidence: DiscConfidence;
  /** Files sorted by (track, filename), each carrying its own resolution. */
  items: AlbumGroupItem[];
}

export interface AlbumGroup {
  /** Opaque, stable identity. See the key construction rule (identity step). */
  key: AlbumGroupKey;
  albumArtist: string | undefined;
  album: string | undefined;
  /** Where the album identity came from. */
  source: "tags" | "folder";
  /** Compilation evidence from embedded tags (COMPILATION/TCMP/cpil): true
   * when the group's files agree and the flag is set, false when they agree
   * and it is unset, undefined when tags are absent or disagree. */
  compilation: boolean | undefined;
  /** The album's directory: the common directory of all items when they
   * share one (folder-derived albums always do), else undefined. */
  directory: string | undefined;
  /** One entry per resolved disc number; a single-disc album has one entry. */
  discs: AlbumDisc[];
  /** All files across discs, sorted by (discNumber, track, filename). */
  items: AlbumGroupItem[];
}

export interface AlbumGroupingResult {
  albums: AlbumGroup[];
  /** Ok items that resolve to an album of exactly one file — a single, not
   * an album. Cardinality is the only library rule. */
  singles: AudioFileMetadata[];
  /** Ok items not attributable to any album (untagged, no folder title evidence). */
  unmatched: AudioFileMetadata[];
  /** Per-file scan errors, surfaced exactly as the scan produced them. */
  errors: Array<{ path: string; error: Error }>;
}

export interface GroupAlbumsOptions {
  /** Drop folder disc evidence below this tier. Default "low" (accept all). */
  minFolderConfidence?: DiscConfidence;
  /** Parse flat disc prefixes (1-01) from filenames. Default true. */
  flatDiscPrefixes?: boolean;
  /** Group untagged files by folder into albums. Default true. */
  folderFallback?: boolean;
  /** The directory the scan started at. When set, a bare disc folder
   * (CD1/) directly under it is unmatched instead of an album named after
   * the root. Default: no guard — the scan root cannot be inferred from a
   * bare FolderScanResult (the common ancestor is the album folder, not the
   * scanned root). scanForAlbums always passes the folder path it scanned. */
  scanRoot?: string;
}

/** The standalone disc-folder recognizer result. */
export interface DiscFolderInfo {
  /** Which grammar form matched. */
  kind: "exact" | "embedded" | "volume" | "bonus" | "bare";
  /** True when corroboration is required (title-word markers like "Tape 4",
   * side letters like "CD D", bonus, bare). */
  gated: boolean;
  /** Disc number; undefined for side letters, bonus, and bare letters. */
  number: number | undefined;
  /** "of N" total from "CD 1 of 2". */
  total: number | undefined;
  /** Title text before an embedded marker ("Album (Disc 1)" -> "Album"). */
  title: string | undefined;
  /** Trailing text after the number ("Bonus Tracks" from "Disc 2 (Bonus Tracks)"). */
  discTitle: string | undefined;
  /** Base confidence tier; sibling corroboration may upgrade embedded to
   * "high" inside groupAlbums. Gated names stay "low" even corroborated. */
  confidence: DiscConfidence;
}

/**
 * Recognize a directory name as a disc folder. Standalone — it only
 * classifies the name; it does not resolve the folder to its parent (use
 * the album result's per-file `albumDir` for that). Returns undefined for
 * non-disc names. Plain "Bonus" and "Extras" are never discs by name.
 */
export function discFolderInfo(name: string): DiscFolderInfo | undefined {
  const parse = parseDiscName(name);
  if (!parse) return undefined;
  return {
    kind: parse.kind,
    gated: parse.gated,
    number: parse.number,
    total: parse.total,
    title: parse.title,
    discTitle: parse.discTitle,
    confidence: parse.gated ? "low" : baseConfidence(parse),
  };
}

// ---------------------------------------------------------------------------
// Path helpers (both / and \ are separators; runtime-agnostic)
// ---------------------------------------------------------------------------

function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i === -1 ? path : path.slice(0, i);
}

// ---------------------------------------------------------------------------
// Disc-folder recognition (spec step 3)
// ---------------------------------------------------------------------------

type DiscKind = "exact" | "embedded" | "volume" | "bonus" | "bare";

interface DiscParse {
  kind: DiscKind;
  /** Disc number when the name carries one. */
  number: number | undefined;
  /** "of N" total from "CD 1 of 2". */
  total: number | undefined;
  /** Title text before an embedded marker ("Album (Disc 1)" -> "Album"). */
  title: string | undefined;
  /** Trailing text after the number ("Bonus Tracks" from "Disc 2 (Bonus Tracks)"). */
  discTitle: string | undefined;
  /** True for title-word markers (tape/vinyl/cassette/lp/record) and
   * single-letter number tokens: corroboration required, low confidence. */
  gated: boolean;
  /** True when the number token was a single letter ("CD D"): a side label,
   * not a number — corroboration required (2026-08-04 feedback). */
  sideLetter: boolean;
  /** True when the number token was arabic digits ("CD1" vs "Disc One"). */
  digit: boolean;
}

// Medium-label markers. Unconditional ones (CD, DVD, SACD, ...) are not
// plausible album-title words, so "CD1" alone is a disc. Title-word markers
// (tape, vinyl, cassette, LP, record) collide with real album titles ("Tape 4"
// by Sleep/Felbm) and are GATED: a lone "Tape 4" folder is an album title,
// while "Tape 1" + "Tape 2" siblings still fold as discs (2026-08-04 feedback).
const UNCONDITIONAL_MARKERS = [
  "cd",
  "disc",
  "disk",
  "dvd",
  "sacd",
  "blu-ray",
  "bd",
  "digital media",
];
const GATED_MARKERS = ["tape", "vinyl", "cassette", "lp", "record"];
const MARKERS = [...UNCONDITIONAL_MARKERS, ...GATED_MARKERS];
const GATED_MARKER_SET = new Set(GATED_MARKERS);

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function romanToInt(s: string): number {
  const values: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = values[s[i]];
    if (v === undefined) return NaN;
    total += v < prev ? -v : v;
    prev = v;
  }
  return total;
}

function parseNumberToken(token: string): number | undefined {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  const word = WORD_NUMBERS[token.toLowerCase()];
  if (word) return word;
  const roman = romanToInt(token.toLowerCase());
  return Number.isFinite(roman) ? roman : undefined;
}

const SEP = String.raw`[\s._#-]*`;
// A number token: arabic, roman, word — or a SINGLE letter, which is a side
// label ("CD A", "Album (CD D)") parsed as a gated, numberless token.
// Non-digit tokens need a right word boundary: without it, "Recordings 1"
// matched "record" + the first letter of "ings" (2026-08-04 report).
const NUM = String
  .raw`(?:\d+|(?:[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[a-z])(?![a-z]))`;

/**
 * Parse a directory name as a disc folder. Returns undefined for non-disc
 * names. Plain "Bonus" and "Extras" are NEVER discs by name (tuneup rule;
 * the low-tier table's "Extras" row was the flagged divergence).
 */
function parseDiscName(name: string): DiscParse | undefined {
  const trimmed = name.trim();
  if (/^(?:extras?|bonus)$/i.test(trimmed)) return undefined;

  for (const marker of MARKERS) {
    // Word-delimited on the LEFT (start or a non-alphanumeric char) and on
    // the RIGHT (the marker must not run into a letter — "Recordings" is not
    // "record" + "ings"), so "Help 1", "Abcd1", "Scalp 1", "Recordings 1"
    // and "The Complete Recordings (41 Tracks)" are never LP 1 / CD 1 /
    // record discs.
    const left = String.raw`(?:^|[^a-z0-9])`;
    const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      left + String.raw`(${esc})(?![a-z])${SEP}(${NUM})`,
      "i",
    );
    const m = trimmed.match(re);
    if (!m) continue;

    // A single-letter token ("CD D", "CD A") is a side label, not a number —
    // gated like the bare-letter tier, no disc number (box-set convention).
    const sideLetter = /^[a-z]$/i.test(m[2]);
    const number = sideLetter ? undefined : parseNumberToken(m[2]);
    if (number === undefined && !sideLetter) continue;
    // Multi-letter roman tokens must be plausible disc numbers: all-roman-
    // letter words ("Mic" = 1099, "Mix" = 1011) are titles, not numerals
    // (2026-08-04 review — same word-collision class as the Recordings bug).
    if (
      !sideLetter && /^[ivxlcdm]{2,}$/i.test(m[2]) && (number ?? 0) > 100
    ) continue;

    const isGated = GATED_MARKER_SET.has(marker.toLowerCase()) || sideLetter;

    // Title text = everything before the marker's first character.
    const markerStart = m.index! + m[1].length - marker.length;
    const rawPrefix = trimmed.slice(0, markerStart).trim();
    const title = rawPrefix.replace(/[()[\]]/g, "").replace(/[\s._#-]+$/, "") ||
      undefined;
    const isExact = title === undefined;

    // Trailing text after the number becomes the disc title.
    const after = trimmed.slice(m.index! + m[0].length).trim();
    const discTitle = after
      .replace(/^[()[\],:;\-–—\s]+/, "")
      .replace(/[)\]\[,:;\-–—\s]+$/, "")
      .trim() || undefined;

    // "of N" total from "CD 1 of 2".
    const ofMatch = after.trim().match(/^of\s+(\d+)\b/i);
    const total = ofMatch ? parseInt(ofMatch[1], 10) : undefined;

    return {
      kind: isExact ? "exact" : "embedded",
      number: sideLetter ? undefined : number,
      total,
      title,
      discTitle,
      gated: isGated,
      sideLetter,
      digit: /^\d+$/.test(m[2]),
    };
  }

  // Volume / Part (medium).
  const volume = trimmed.match(
    /^(?:volume|vol\.?|part|pt\.?)\s*(\d+)(?:\s*of\s*(\d+))?$/i,
  );
  if (volume) {
    return {
      kind: "volume",
      number: parseInt(volume[1], 10),
      total: volume[2] ? parseInt(volume[2], 10) : undefined,
      title: undefined,
      discTitle: undefined,
      gated: false,
      sideLetter: false,
      digit: true,
    };
  }

  // Bonus Disc (low; needs corroboration).
  if (/^bonus\s+disc$/i.test(trimmed)) {
    return {
      kind: "bonus",
      number: undefined,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      gated: true,
      sideLetter: false,
      digit: false,
    };
  }

  // Bare numbers / letters / V1 / P2 (low; needs corroboration).
  if (/^(?:\d+|v\d+|p\d+|[ab])$/i.test(trimmed)) {
    return {
      kind: "bare",
      number: /^\d+$/i.test(trimmed) ? parseInt(trimmed, 10) : undefined,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      gated: true,
      sideLetter: false,
      digit: false,
    };
  }

  return undefined;
}

function baseConfidence(parse: DiscParse): DiscConfidence {
  switch (parse.kind) {
    case "exact":
      // Word/roman numerals are only low-confidence evidence.
      return parse.digit ? "high" : "low";
    case "embedded":
      return "medium";
    case "volume":
      return "medium";
    case "bonus":
    case "bare":
      return "low";
  }
}

/**
 * Sibling corroboration (spec step 3): gated names (title-word markers,
 * single-letter tokens, bonus, bare) are discs only when a sibling under the
 * same parent confirms them — an unconditional disc sibling, or sibling
 * numbering of their own (a folder never confirms itself). Side-letter
 * tokens corroborate each other ("CD D" + "CD E").
 */
function corroborated(parse: DiscParse, siblings: string[]): boolean {
  if (!parse.gated && parse.kind === "exact") return true;
  if (siblings.length === 0) return false;

  const siblingParses = siblings
    .map((s) => parseDiscName(basename(s)))
    .filter((p): p is DiscParse => p !== undefined);
  const hasExactSibling = siblingParses.some(
    (p) => !p.gated && p.kind === "exact",
  );
  const hasNumberedSibling = siblingParses.some(
    (p) => p.number !== undefined,
  );

  if (parse.number !== undefined && hasNumberedSibling) return true;
  if (!parse.gated && parse.kind === "embedded" && hasExactSibling) return true;
  if (!parse.gated && parse.kind === "volume" && hasNumberedSibling) {
    return true;
  }

  // Side-letter tokens corroborate each other ("CD D" + "CD E").
  if (parse.sideLetter) {
    return siblingParses.some((p) => p.sideLetter);
  }

  // Title-less set rules (low tier): bare numbers/letters or bonus names
  // accompanying at least two numbered siblings, or a numbered sibling of
  // their own kind.
  if (parse.kind === "bonus" || parse.kind === "bare") {
    const numberedCount = siblingParses.filter((p) => p.number !== undefined)
      .length;
    if (numberedCount >= 2) return true;
    if (parse.number !== undefined && hasNumberedSibling) return true;
  }

  return false;
}

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
// Identity normalization (spec step 5)
// ---------------------------------------------------------------------------

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isGenericAlbumArtist(albumArtist: string | undefined): boolean {
  if (!albumArtist || albumArtist.trim() === "") return true;
  const n = normalizeKey(albumArtist);
  return n === "various artists" || n === "va";
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface OkItem {
  path: string;
  tags: AudioFileMetadata["tags"];
  metadata: AudioFileMetadata;
}

interface DirNode {
  files: OkItem[];
  parent: string | undefined;
}

/** Per-file disc evidence, resolved before tag merging. */
interface FileDiscEvidence {
  /** Folder-derived disc number (own/ancestor parse or flat prefix). */
  folderDiscNumber: number | undefined;
  /** "of N" total from the folder name. */
  total: number | undefined;
  folderDiscTitle: string | undefined;
  confidence: DiscConfidence;
  /** The album directory attributed to this file. */
  albumDir: string;
}

const CONFIDENCE_RANK: Record<DiscConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

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

  // Step 1: normalize — split ok items from errors.
  const okItems: OkItem[] = [];
  const errors: Array<{ path: string; error: Error }> = [];
  for (const item of result.items) {
    if (item.status === "ok") {
      okItems.push({ path: item.path, tags: item.tags, metadata: item });
    } else {
      errors.push({ path: item.path, error: item.error });
    }
  }
  if (okItems.length === 0) {
    return { albums: [], singles: [], unmatched: [], errors };
  }

  // The scan root, when the caller knows it (scanForAlbums always does). The
  // guard that keeps a bare "CD1/" at the root unmatched applies ONLY with an
  // explicit root: the common ancestor of the paths is the album folder, not
  // the scanned root, so it cannot be inferred safely.
  const scanRoot = options.scanRoot;

  // Step 2: tree reconstruction.
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

  // Step 3: folder disc recognition per directory containing audio, with
  // sibling corroboration. Exact names are discs outright (word/roman at low
  // confidence). Embedded and volume names are discs at medium, upgraded to
  // high by corroboration. Low-tier names (Bonus Disc, bare numbers/letters)
  // are discs only with corroboration, at low confidence.
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

  // Step 4: flat filename prefixes — subdivide a directory's files into
  // discs when two or more distinct prefixes appear. Never inside a disc
  // folder. Separated forms are explicit; compact-only sets must be
  // plausible (each distinct prefix within 1..N, N = distinct count).
  const flatSubdivisions = new Map<string, Map<string, number>>();
  if (useFlatPrefixes) {
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
      if (plausible) flatSubdivisions.set(dir, byFile);
    }
  }

  // Step 5: album identity. Tags-first: key on normalized (albumArtist,
  // album), folding generic album artists (Various Artists) into an
  // album-only key — the same rule tuneup's groupingKey uses. Untagged
  // files fall back to the folder walk.
  interface AlbumAccumulator {
    key: AlbumGroupKey;
    album: string;
    albumArtist: string | undefined;
    source: "tags" | "folder";
    directory: string | undefined;
    items: AlbumGroupItem[];
    evidence: Map<string, FileDiscEvidence | undefined>;
  }

  const albums = new Map<AlbumGroupKey, AlbumAccumulator>();
  const unmatched: AudioFileMetadata[] = [];

  const evidenceFor = (item: OkItem): FileDiscEvidence | undefined => {
    const dir = dirname(item.path);
    // 1. Own directory parses as a confirmed disc folder.
    const own = confirmedDiscs.get(dir);
    if (own) {
      return {
        folderDiscNumber: own.parse.number,
        total: own.parse.total,
        folderDiscTitle: own.parse.discTitle,
        confidence: own.confidence,
        albumDir: dirname(dir),
      };
    }
    // 2. Nearest confirmed disc ancestor.
    let cursor = dirname(dir);
    while (cursor !== undefined) {
      const entry = confirmedDiscs.get(cursor);
      if (entry) {
        return {
          folderDiscNumber: entry.parse.number,
          total: entry.parse.total,
          folderDiscTitle: entry.parse.discTitle,
          confidence: entry.confidence,
          albumDir: dirname(cursor),
        };
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    // 3. Flat-prefix subdivision of the file's own directory.
    const flat = flatSubdivisions.get(dir)?.get(item.path);
    if (flat !== undefined) {
      return {
        folderDiscNumber: flat,
        total: undefined,
        folderDiscTitle: undefined,
        confidence: "medium",
        albumDir: dir,
      };
    }
    return undefined;
  };

  const folderIdentity = (dir: string):
    | { title: string; titleSource: string }
    | undefined => {
    // The file's own directory is the album folder unless it parses as a
    // confirmed disc folder (beets: any folder with audio is an album).
    const own = confirmedDiscs.get(dir);
    if (!own) {
      const title = basename(dir);
      return title ? { title, titleSource: dir } : undefined;
    }
    // Own directory is a disc folder: an embedded name yields its stripped
    // title; otherwise the title is the parent's basename — and a parent
    // that is the scan root provides no title evidence (bare "CD1/" at the
    // scan root is unmatched).
    if (own.parse.title !== undefined) {
      return { title: own.parse.title, titleSource: dirname(dir) };
    }
    const source = dirname(dir);
    if (source === scanRoot || source === dir) return undefined;
    const title = basename(source);
    return title ? { title, titleSource: source } : undefined;
  };

  for (const item of okItems) {
    const dir = dirname(item.path);
    const albumTag = item.tags.album?.[0]?.trim();
    const albumArtistTag = item.tags.albumArtist?.[0]?.trim();

    if (albumTag) {
      const artistPart = isGenericAlbumArtist(albumArtistTag)
        ? ""
        : normalizeKey(albumArtistTag ?? "");
      const key = `${artistPart}::${normalizeKey(albumTag)}` as AlbumGroupKey;
      let acc = albums.get(key);
      if (!acc) {
        acc = {
          key,
          album: albumTag,
          albumArtist: isGenericAlbumArtist(albumArtistTag)
            ? undefined
            : albumArtistTag,
          source: "tags",
          directory: undefined,
          items: [],
          evidence: new Map(),
        };
        albums.set(key, acc);
      }
      const evidence = evidenceFor(item);
      acc.evidence.set(item.path, evidence);
      acc.items.push({
        ...item.metadata,
        albumDir: evidence?.albumDir ?? dir,
        discNumber: evidence?.folderDiscNumber,
      });
      continue;
    }

    // Folder fallback for untagged files.
    if (!useFolderFallback) {
      unmatched.push(item.metadata);
      continue;
    }
    const identity = folderIdentity(dir);
    if (!identity) {
      unmatched.push(item.metadata);
      continue;
    }
    const key = `${identity.titleSource}::${
      normalizeKey(identity.title)
    }` as AlbumGroupKey;
    let acc = albums.get(key);
    if (!acc) {
      acc = {
        key,
        album: identity.title,
        albumArtist: undefined,
        source: "folder",
        directory: identity.titleSource,
        items: [],
        evidence: new Map(),
      };
      albums.set(key, acc);
    }
    const evidence = evidenceFor(item);
    acc.evidence.set(item.path, evidence);
    acc.items.push({
      ...item.metadata,
      albumDir: evidence?.albumDir ?? dir,
      discNumber: evidence?.folderDiscNumber,
    });
  }

  // Mixed folders: an untagged folder-derived group merges into a tag-keyed
  // group when normalized titles match and the tag-keyed files live under the
  // folder group's album directory (its title source — the parent that hosts
  // the disc folders). The tag key and source "tags" win.
  for (const [key, acc] of [...albums]) {
    if (acc.source === "tags") continue;
    for (const other of albums.values()) {
      if (other === acc || other.source !== "tags") continue;
      if (normalizeKey(other.album) !== normalizeKey(acc.album)) continue;
      const albumDir = acc.directory;
      const sharesChain = albumDir !== undefined && other.items.some((o) => {
        const od = dirname(o.path);
        return od === albumDir || od.startsWith(albumDir + "/");
      });
      if (!sharesChain) continue;
      for (const item of acc.items) {
        other.items.push(item);
        other.evidence.set(item.path, acc.evidence.get(item.path));
      }
      albums.delete(key);
      break;
    }
  }

  // Step 6: disc assembly per album. Each file resolves to a disc number:
  // the common tag value among its directory's files (missing abstains,
  // disagreement falls back to the folder), else the folder evidence (own
  // disc parse, ancestor, or flat filename prefix). Files resolving to the
  // SAME number merge into one AlbumDisc, with tagDiscNumber recomputed over
  // the merged set.
  const groups: AlbumGroup[] = [];
  for (const acc of albums.values()) {
    // Directory-level tag common, resolved per file (flat-prefix evidence
    // assigns different numbers to files in the same directory).
    const dirTagCommon = new Map<string, number | undefined>();
    const resolvedByFile = new Map<string, number | undefined>();
    for (const item of acc.items) {
      const dir = dirname(item.path);
      if (!dirTagCommon.has(dir)) {
        const tagged = acc.items
          .filter((i) => dirname(i.path) === dir)
          .map((i) => i.tags.discNumber)
          .filter((d): d is number => d !== undefined && d > 0);
        dirTagCommon.set(
          dir,
          tagged.length > 0 && tagged.every((d) => d === tagged[0])
            ? tagged[0]
            : undefined,
        );
      }
      const evidence = acc.evidence.get(item.path);
      const tagCommon = dirTagCommon.get(dir);
      resolvedByFile.set(
        item.path,
        tagCommon ?? evidence?.folderDiscNumber,
      );
    }

    const discs = new Map<string, AlbumDisc>();
    const order: string[] = [];
    const noEvidenceItems: AlbumGroupItem[] = [];
    for (const item of acc.items) {
      const evidence = acc.evidence.get(item.path);
      if (evidence === undefined) {
        noEvidenceItems.push(item);
        continue;
      }
      const resolved = resolvedByFile.get(item.path);
      const discKey = resolved === undefined
        ? `dir:${dirname(item.path)}`
        : String(resolved);
      let disc = discs.get(discKey);
      if (!disc) {
        disc = {
          discNumber: resolved,
          totalDiscs: evidence.total,
          folderDiscNumber: evidence.folderDiscNumber,
          folderDiscTitle: evidence.folderDiscTitle,
          tagDiscNumber: undefined,
          confidence: evidence.confidence,
          items: [],
        };
        discs.set(discKey, disc);
        order.push(discKey);
      }
      disc.items.push(item);
    }

    // Files with no disc evidence join the lowest-numbered disc; an album
    // with none holds all files in one disc whose discNumber is undefined.
    if (noEvidenceItems.length > 0) {
      const numbered = [...discs.values()]
        .filter((d) => d.folderDiscNumber !== undefined)
        .sort((a, b) => a.folderDiscNumber! - b.folderDiscNumber!);
      if (numbered.length > 0) {
        numbered[0].items.push(...noEvidenceItems);
      } else {
        const key = "dir:__none__";
        let disc = discs.get(key);
        if (!disc) {
          disc = {
            discNumber: undefined,
            totalDiscs: undefined,
            folderDiscNumber: undefined,
            folderDiscTitle: undefined,
            tagDiscNumber: undefined,
            confidence: "high",
            items: [],
          };
          discs.set(key, disc);
          order.push(key);
        }
        disc.items.push(...noEvidenceItems);
      }
    }

    // tagDiscNumber over the merged set: common nonzero tag value among
    // files carrying it (missing abstains; disagreement -> undefined).
    for (const disc of discs.values()) {
      const tagged = disc.items
        .map((i) => i.tags.discNumber)
        .filter((d): d is number => d !== undefined && d > 0);
      const common = tagged.length > 0 && tagged.every((d) => d === tagged[0])
        ? tagged[0]
        : undefined;
      disc.tagDiscNumber = common;
      disc.discNumber = common ?? disc.folderDiscNumber;
      for (const item of disc.items) item.discNumber = disc.discNumber;
    }

    // totalDiscs: common tag over the whole album -> "of N" -> max sibling.
    const albumTaggedTotals = acc.items
      .map((i) => i.tags.totalDiscs)
      .filter((t): t is number => t !== undefined && t > 0);
    const commonTotal = albumTaggedTotals.length > 0 &&
        albumTaggedTotals.every((t) => t === albumTaggedTotals[0])
      ? albumTaggedTotals[0]
      : undefined;
    const ofN = [...discs.values()].map((d) => d.totalDiscs).find((t) =>
      t !==
        undefined
    );
    const maxSibling = [...discs.values()]
      .map((d) => d.discNumber)
      .filter((n): n is number => n !== undefined)
      .reduce((a, b) => Math.max(a, b), 0) || undefined;
    for (const disc of discs.values()) {
      disc.totalDiscs = commonTotal ?? ofN ?? maxSibling;
    }

    // Step 7: sort.
    const sortedDiscs = [...discs.values()].sort((a, b) => {
      const an = a.discNumber === undefined ? -1 : a.discNumber;
      const bn = b.discNumber === undefined ? -1 : b.discNumber;
      if (an !== bn) return an - bn;
      return (a.folderDiscTitle ?? "").localeCompare(b.folderDiscTitle ?? "");
    });
    for (const disc of sortedDiscs) {
      disc.items.sort((a, b) => {
        const at = a.tags.track ?? Infinity;
        const bt = b.tags.track ?? Infinity;
        if (at !== bt) return at - bt;
        return a.path.localeCompare(b.path);
      });
    }

    // Compilation agreement (invariant 6).
    const flags = acc.items
      .map((i) => i.tags.compilation)
      .filter((c): c is boolean => c !== undefined);
    const compilation = flags.length > 0 && flags.every((f) => f === flags[0])
      ? flags[0]
      : undefined;

    // The album's directory: the common directory of the items' resolved
    // albumDirs when they share one; folder-derived albums fall back to
    // their title source.
    const albumDirs = new Set(acc.items.map((i) => i.albumDir));
    const directory = albumDirs.size === 1 ? [...albumDirs][0] : acc.directory;

    groups.push({
      key: acc.key,
      albumArtist: acc.albumArtist,
      album: acc.album,
      source: acc.source,
      compilation,
      directory,
      discs: sortedDiscs,
      items: sortedDiscs.flatMap((d) => d.items),
    });
  }

  // Step 8: singles (1-file albums), unmatched, sort albums.
  const albumsOut: AlbumGroup[] = [];
  const singles: AudioFileMetadata[] = [];
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
