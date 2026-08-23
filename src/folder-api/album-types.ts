/**
 * Types for pure album grouping (taglib-ys7m split). No runtime imports:
 * every module in the disc-folder graph must stay Wasm-free (taglib-cd7b).
 */

import type { AudioFileMetadata } from "./types.ts";

/** Opaque, stable album identity. */
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

// ---------------------------------------------------------------------------
// Internal types shared across the grouping modules
// ---------------------------------------------------------------------------

export type DiscKind = "exact" | "embedded" | "volume" | "bonus" | "bare";

export interface DiscParse {
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

interface OkItemFields {
  path: string;
  tags: AudioFileMetadata["tags"];
  metadata: AudioFileMetadata;
}

export interface OkItem extends OkItemFields {}

export interface DirNode {
  files: OkItem[];
  parent: string | undefined;
}

/** Per-file disc evidence, resolved before tag merging. */
export interface FileDiscEvidence {
  /** Folder-derived disc number (own/ancestor parse or flat prefix). */
  folderDiscNumber: number | undefined;
  /** "of N" total from the folder name. */
  total: number | undefined;
  folderDiscTitle: string | undefined;
  confidence: DiscConfidence;
  /** The album directory attributed to this file. */
  albumDir: string;
}

/** Accumulator for one album during identity and disc assembly. */
export interface AlbumAccumulator {
  key: AlbumGroupKey;
  album: string;
  albumArtist: string | undefined;
  source: "tags" | "folder";
  directory: string | undefined;
  items: AlbumGroupItem[];
  evidence: Map<string, FileDiscEvidence | undefined>;
}
