/**
 * Structured-field accessors over the WASI tag-data snapshot.
 *
 * Pure functions over the tag-data snapshot: the WasiFileHandle wrappers add
 * destruction guards. Extracted from file-handle.ts in the taglib-1dfc split.
 */

import type {
  RawChapter,
  RawId3v2Frame,
  RawLyrics,
  RawPicture,
} from "../../wasm.ts";
import type { HandleState } from "./handle-state.ts";
import { readId3v2FramesFromWasm } from "./wasm-io.ts";

export function getPictures(
  tagData: Record<string, unknown> | null,
): RawPicture[] {
  return (tagData?.pictures as RawPicture[] | undefined) ?? [];
}

export function setPictures(
  tagData: Record<string, unknown> | null,
  pictures: RawPicture[],
): Record<string, unknown> {
  return { ...tagData, pictures };
}

export function addPicture(
  tagData: Record<string, unknown> | null,
  picture: RawPicture,
): Record<string, unknown> {
  const pictures = getPictures(tagData);
  pictures.push(picture);
  return setPictures(tagData, pictures);
}

export function removePictures(
  tagData: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...tagData, pictures: [] };
}

export function getChapters(
  tagData: Record<string, unknown> | null,
): RawChapter[] {
  return (tagData?.chapters as RawChapter[] | undefined) ?? [];
}

export function setChapters(
  tagData: Record<string, unknown> | null,
  chapters: RawChapter[],
  mp4ChapterStyle: string,
): Record<string, unknown> {
  return {
    ...tagData,
    _mp4ChapterStyle: mp4ChapterStyle,
    chapters,
  };
}

export function getBextData(
  tagData: Record<string, unknown> | null,
): Uint8Array | undefined {
  return (tagData?.bextData as Uint8Array | undefined) ?? undefined;
}

export function setBextData(
  tagData: Record<string, unknown> | null,
  data: Uint8Array | null,
): Record<string, unknown> {
  // Store `null` (not delete) so the encoder emits msgpack nil => C++ removes.
  return { ...tagData, bextData: data };
}

export function getIxml(
  tagData: Record<string, unknown> | null,
): string | undefined {
  const v = tagData?.ixml;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function setIxml(
  tagData: Record<string, unknown> | null,
  data: string | null,
): Record<string, unknown> {
  return { ...tagData, ixml: data };
}

export function hasId3Tags(
  tagData: Record<string, unknown> | null,
): { v1: boolean; v2: boolean } {
  const t = tagData?.id3Tags as { v1?: boolean; v2?: boolean } | undefined;
  return { v1: t?.v1 ?? false, v2: t?.v2 ?? false };
}

export function stripId3Tags(
  tagData: Record<string, unknown> | null,
  opts: { v1: boolean; v2: boolean },
): Record<string, unknown> | null {
  // id3Tags is only emitted by the read path on FLAC files that have any
  // ID3 attached. Skip the directive entirely on non-FLAC handles so the
  // optimistic cache update doesn't synthesize a key the read path would
  // never have written. hasId3Tags() returns {false,false} either way.
  const current = tagData?.id3Tags as
    | { v1?: boolean; v2?: boolean }
    | undefined;
  if (!current) return tagData;
  // _stripId3 is a write-time directive consumed by the C++ shim. OR-merge
  // with any prior directive so successive calls accumulate (Embind applies
  // strip immediately and naturally composes; WASI must mirror that).
  const prior = tagData?._stripId3 as
    | { v1?: boolean; v2?: boolean }
    | undefined;
  const stripV1 = (prior?.v1 ?? false) || opts.v1;
  const stripV2 = (prior?.v2 ?? false) || opts.v2;
  // Optimistically reflect the post-strip state in the local cache so that
  // hasId3Tags() on the same handle matches Embind semantics without a
  // round-trip through save+reload.
  return {
    ...tagData,
    _stripId3: { v1: stripV1, v2: stripV2 },
    id3Tags: {
      v1: (current.v1 ?? false) && !stripV1,
      v2: (current.v2 ?? false) && !stripV2,
    },
  };
}

export function getRatings(
  tagData: Record<string, unknown> | null,
): { rating: number; email: string; counter: number }[] {
  return (tagData?.ratings as
    | { rating: number; email: string; counter: number }[]
    | undefined) ?? [];
}

export function setRatings(
  tagData: Record<string, unknown> | null,
  ratings: { rating: number; email?: string; counter?: number }[],
): Record<string, unknown> {
  const normalizedRatings = ratings.map((r) => ({
    rating: r.rating,
    email: r.email ?? "",
    counter: r.counter ?? 0,
  }));
  return {
    ...tagData,
    ratings: normalizedRatings,
  };
}

export function getLyrics(
  tagData: Record<string, unknown> | null,
): RawLyrics[] {
  const value = tagData?.lyrics;
  if (value === undefined || value === null) return [];
  // A fresh read surfaces lyrics as the "LYRICS" text property (a string, or a
  // string[] for multi-value); setLyrics stores a RawLyrics[]. Normalize all
  // shapes — description/language are not persisted via the PropertyMap so
  // they read back empty (taglib-gq9).
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) =>
    typeof entry === "string"
      ? { text: entry, description: "", language: "" }
      : {
        text: (entry as RawLyrics)?.text ?? "",
        description: (entry as RawLyrics)?.description ?? "",
        language: (entry as RawLyrics)?.language ?? "",
      }
  );
}

export function setLyrics(
  tagData: Record<string, unknown> | null,
  lyrics: RawLyrics[],
): Record<string, unknown> {
  return { ...tagData, lyrics };
}

export function getStagedId3v2Frames(
  tagData: Record<string, unknown> | null,
): Record<string, Uint8Array[]> | undefined {
  return tagData?.id3v2Frames as Record<string, Uint8Array[]> | undefined;
}

export function setId3v2Frames(
  tagData: Record<string, unknown> | null,
  id: string,
  data: Uint8Array[],
): Record<string, unknown> {
  const staged = { ...(getStagedId3v2Frames(tagData) ?? {}) };
  staged[id] = data.map((d) => new Uint8Array(d));
  return {
    ...tagData,
    id3v2Frames: staged,
  };
}

export function removeId3v2Frames(
  tagData: Record<string, unknown> | null,
  id: string,
): Record<string, unknown> {
  return setId3v2Frames(tagData, id, []);
}

/** Raw ID3v2 frames: file state filtered by staged per-ID replacements. */
export function getId3v2Frames(
  state: HandleState,
  id: string,
): RawId3v2Frame[] {
  const filter = id === "" ? undefined : id;
  const source = state.filePath ?? state.fileData;
  let frames: RawId3v2Frame[] = [];
  if (source) {
    frames = readId3v2FramesFromWasm(state.wasi, source, filter);
  }
  const staged = getStagedId3v2Frames(state.tagData);
  if (!staged) return frames;
  // Staged per-ID replacements win over (possibly stale) file state.
  const stagedIds = new Set(Object.keys(staged));
  frames = frames.filter((f) => !stagedIds.has(f.id));
  for (const [sid, bodies] of Object.entries(staged)) {
    if (filter && sid !== filter) continue;
    // Copy: callers must not be able to mutate staged state by mutating
    // the returned array (Embind's getId3v2Frames already returns copies).
    for (const data of bodies) frames.push({ id: sid, data: data.slice() });
  }
  return frames;
}
