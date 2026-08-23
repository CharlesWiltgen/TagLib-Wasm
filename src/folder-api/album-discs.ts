/**
 * Disc assembly and finalization (spec steps 6-7, taglib-ys7m split).
 *
 * Each file resolves to a disc number: the common tag value among its
 * directory's files (missing abstains, disagreement falls back to the
 * folder), else the folder evidence (own disc parse, ancestor, or flat
 * filename prefix). Files resolving to the SAME number merge into one
 * AlbumDisc, with tagDiscNumber recomputed over the merged set.
 */

import { dirname } from "./folder-disc.ts";
import type {
  AlbumAccumulator,
  AlbumDisc,
  AlbumGroup,
  AlbumGroupItem,
} from "./album-types.ts";

/** Assemble discs per album, then sort discs and items (steps 6-7). */
export function assembleDiscs(
  albums: Map<AlbumAccumulator["key"], AlbumAccumulator>,
): AlbumGroup[] {
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

  return groups;
}
