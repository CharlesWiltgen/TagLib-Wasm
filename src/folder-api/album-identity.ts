/**
 * Album identity resolution (spec step 5, taglib-ys7m split).
 *
 * Tags are authority: key on normalized (albumArtist, album), folding generic
 * album artists into an album-only key. Untagged files fall back to a folder
 * walk, and folder-derived groups merge into matching tag-keyed groups.
 */

import { basename } from "../utils/path.ts";
import { dirname } from "./folder-disc.ts";
import type { AudioFileMetadata } from "./types.ts";
import type {
  AlbumAccumulator,
  AlbumGroupKey,
  DiscConfidence,
  DiscParse,
  FileDiscEvidence,
  OkItem,
} from "./album-types.ts";

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isGenericAlbumArtist(albumArtist: string | undefined): boolean {
  if (!albumArtist || albumArtist.trim() === "") return true;
  const n = normalizeKey(albumArtist);
  return n === "various artists" || n === "va";
}

type ConfirmedDiscs = Map<
  string,
  { parse: DiscParse; confidence: DiscConfidence }
>;

export interface AlbumIdentity {
  albums: Map<AlbumGroupKey, AlbumAccumulator>;
  unmatched: AudioFileMetadata[];
}

/** Resolve the per-file disc evidence (own/ancestor parse, flat prefix). */
function evidenceFor(
  item: OkItem,
  confirmedDiscs: ConfirmedDiscs,
  flatSubdivisions: Map<string, Map<string, number>>,
): FileDiscEvidence | undefined {
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
}

/** The folder-derived album title for a directory, when evidence exists. */
function folderIdentity(
  dir: string,
  confirmedDiscs: ConfirmedDiscs,
  scanRoot: string | undefined,
): { title: string; titleSource: string } | undefined {
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
}

/**
 * Build the album map (spec step 5): tag-keyed groups first, folder fallback
 * for untagged files, then mixed-folder merges into tag-keyed groups.
 */
export function buildAlbumIdentity(
  okItems: OkItem[],
  confirmedDiscs: ConfirmedDiscs,
  flatSubdivisions: Map<string, Map<string, number>>,
  options: { scanRoot?: string | undefined; useFolderFallback: boolean },
): AlbumIdentity {
  const albums = new Map<AlbumGroupKey, AlbumAccumulator>();
  const unmatched: AudioFileMetadata[] = [];

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
      const evidence = evidenceFor(item, confirmedDiscs, flatSubdivisions);
      acc.evidence.set(item.path, evidence);
      acc.items.push({
        ...item.metadata,
        albumDir: evidence?.albumDir ?? dir,
        discNumber: evidence?.folderDiscNumber,
      });
      continue;
    }

    // Folder fallback for untagged files.
    if (!options.useFolderFallback) {
      unmatched.push(item.metadata);
      continue;
    }
    const identity = folderIdentity(dir, confirmedDiscs, options.scanRoot);
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
    const evidence = evidenceFor(item, confirmedDiscs, flatSubdivisions);
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

  return { albums, unmatched };
}
