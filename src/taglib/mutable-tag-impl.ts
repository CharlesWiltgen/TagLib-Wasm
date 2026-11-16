/**
 * @fileoverview The mutable `tag()` facade over a FileHandle.
 *
 * Extracted from audio-file-base.ts, which the additions for taglib-qpl/bnhl/eq3
 * pushed past CLAUDE.md's 250-line limit. This is the whole of the basic-tag
 * surface: five plain string fields plus the two that are backed by a raw
 * string with a numeric mirror (`date`/`year`, `trackNumber`/`track`), whose
 * write rules are the interesting part.
 */

import type { BasicTagData } from "../types/tags.ts";
import type { FileHandle } from "../wasm.ts";
import type { MutableTag } from "./mutable-tag.ts";
import { toTagLibKey } from "../constants/properties.ts";

/** Wire key for the raw track field, whose value may be "n" or "n/total". */
const RAW_TRACK_WIRE_KEY = toTagLibKey("trackNumber"); // "TRACKNUMBER"

/** Getters backed by BasicTagData's plain string fields. */
const TAG_GETTER_FIELDS = [
  "title",
  "artist",
  "album",
  "comment",
  "genre",
] as const;

type TagState = { data: BasicTagData };

/**
 * Define the read-only surface on a fresh tag object. The getters close over
 * `state.data`, which every setter refreshes from the handle.
 */
function buildGetters(state: TagState, handle: FileHandle): MutableTag {
  const tag = {} as MutableTag;
  for (const field of TAG_GETTER_FIELDS) {
    Object.defineProperty(tag, field, {
      enumerable: true,
      configurable: true,
      get: () => state.data[field],
    });
  }
  Object.defineProperties(tag, {
    year: {
      enumerable: true,
      configurable: true,
      get: () => state.data.year,
    },
    track: {
      enumerable: true,
      configurable: true,
      get: () => state.data.track,
    },
    date: {
      enumerable: true,
      configurable: true,
      get: () => handle.getProperty("DATE") || undefined, // "DATE" = toTagLibKey("date")
    },
  });
  return tag;
}

/** Preserve an existing "n/total" when setting a bare track number. */
function stageTrackWrite(handle: FileHandle, value: number): void {
  // ID3v2::Tag::setTrack replaces the whole TRCK frame, so setting the number
  // over a "3/12" destroyed the total on Emscripten while WASI preserved it via
  // its separate totalTracks field (taglib-eq3). When a total is present, write
  // the pair through the property surface instead.
  // WASI never reaches this branch for an int-pair format: it splits the pair
  // on read, so its trackNumber holds no "/" and its own merge re-attaches the
  // total on save.
  // A non-positive value is a clear, not a renumbering, so it must reach
  // setTagData rather than staging "0/12".
  const existing = value > 0 ? handle.getProperty(RAW_TRACK_WIRE_KEY) : "";
  const slash = existing.indexOf("/");
  if (slash !== -1) {
    handle.setProperty(RAW_TRACK_WIRE_KEY, `${value}${existing.slice(slash)}`);
  } else {
    handle.setTagData({ track: value });
  }
}

/** `setDate("")` is a coherent clear of BOTH date and year. */
function stageDateWrite(handle: FileHandle, value: string): void {
  if (value === "") {
    handle.setTagData({ year: 0 }); // coherent clear: drops BOTH date and year
  } else {
    handle.setProperty("DATE", value);
  }
}

/** Build the mutable tag facade. Reads re-snapshot after every write. */
export function buildMutableTag(handle: FileHandle): MutableTag {
  const state: TagState = { data: handle.getTagData() };
  const tag = buildGetters(state, handle);

  const refresh = () => {
    state.data = handle.getTagData();
    return tag;
  };

  const setBasic = <K extends keyof BasicTagData>(
    field: K,
    value: BasicTagData[K],
  ) => {
    handle.setTagData({ [field]: value });
    return refresh();
  };

  tag.setTitle = (value) => setBasic("title", value);
  tag.setArtist = (value) => setBasic("artist", value);
  tag.setAlbum = (value) => setBasic("album", value);
  tag.setComment = (value) => setBasic("comment", value);
  tag.setGenre = (value) => setBasic("genre", value);
  tag.setYear = (value) => setBasic("year", value);
  tag.setTrack = (value) => {
    stageTrackWrite(handle, value);
    return refresh();
  };
  tag.setDate = (value) => {
    stageDateWrite(handle, value);
    return refresh(); // re-read so `year` reflects the change immediately
  };
  return tag;
}
