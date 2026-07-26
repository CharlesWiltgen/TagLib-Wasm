/**
 * @fileoverview The mutable `tag()` facade over a FileHandle.
 *
 * Extracted from audio-file-base.ts, which the additions for taglib-qpl/bnhl/eq3
 * pushed past CLAUDE.md's 250-line limit. This is the whole of the basic-tag
 * surface: five plain string fields plus the two that are backed by a raw
 * string with a numeric mirror (`date`/`year`, `trackNumber`/`track`), whose
 * write rules are the interesting part.
 */

import type { FileHandle } from "../wasm.ts";
import type { MutableTag } from "./mutable-tag.ts";
import { toTagLibKey } from "../constants/properties.ts";

/** Wire key for the raw track field, whose value may be "n" or "n/total". */
const RAW_TRACK_WIRE_KEY = toTagLibKey("trackNumber"); // "TRACKNUMBER"

/** Build the mutable tag facade. Reads re-snapshot after every write. */
export function buildMutableTag(handle: FileHandle): MutableTag {
  let data = handle.getTagData();
  const tag: MutableTag = {
    get title() {
      return data.title;
    },
    get artist() {
      return data.artist;
    },
    get album() {
      return data.album;
    },
    get comment() {
      return data.comment;
    },
    get genre() {
      return data.genre;
    },
    get year() {
      return data.year;
    },
    get track() {
      return data.track;
    },
    get date() {
      return handle.getProperty("DATE") || undefined; // "DATE" = toTagLibKey("date")
    },
    setTitle: (value: string) => {
      handle.setTagData({ title: value });
      data = handle.getTagData();
      return tag;
    },
    setArtist: (value: string) => {
      handle.setTagData({ artist: value });
      data = handle.getTagData();
      return tag;
    },
    setAlbum: (value: string) => {
      handle.setTagData({ album: value });
      data = handle.getTagData();
      return tag;
    },
    setComment: (value: string) => {
      handle.setTagData({ comment: value });
      data = handle.getTagData();
      return tag;
    },
    setGenre: (value: string) => {
      handle.setTagData({ genre: value });
      data = handle.getTagData();
      return tag;
    },
    setYear: (value: number) => {
      handle.setTagData({ year: value });
      data = handle.getTagData();
      return tag;
    },
    setTrack: (value: number) => {
      // ID3v2::Tag::setTrack replaces the whole TRCK frame, so setting the
      // number over a "3/12" destroyed the total on Emscripten while WASI
      // preserved it via its separate totalTracks field (taglib-eq3). When a
      // total is present, write the pair through the property surface instead.
      // WASI never reaches this branch for an int-pair format: it splits the
      // pair on read, so its trackNumber holds no "/" and its own merge
      // re-attaches the total on save.
      // A non-positive value is a clear, not a renumbering, so it must reach
      // setTagData rather than staging "0/12".
      const existing = value > 0 ? handle.getProperty(RAW_TRACK_WIRE_KEY) : "";
      const slash = existing.indexOf("/");
      if (slash !== -1) {
        handle.setProperty(
          RAW_TRACK_WIRE_KEY,
          `${value}${existing.slice(slash)}`,
        );
      } else {
        handle.setTagData({ track: value });
      }
      data = handle.getTagData();
      return tag;
    },
    setDate: (value: string) => {
      if (value === "") {
        handle.setTagData({ year: 0 }); // coherent clear: drops BOTH date and year
      } else {
        handle.setProperty("DATE", value);
      }
      data = handle.getTagData(); // re-read so `year` reflects the change immediately
      return tag;
    },
  };
  return tag;
}
