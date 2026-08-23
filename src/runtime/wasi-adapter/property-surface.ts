/**
 * The property surface over the WASI tag-data snapshot.
 *
 * Pure functions over tagData: the WasiFileHandle wrappers add destruction
 * guards. Extracted from file-handle.ts in the taglib-1dfc split.
 */

import type { BasicTagData } from "../../types/tags.ts";
import { fromTagLibKey, toTagLibKey } from "../../constants/properties.ts";
import {
  DATE_MIRROR,
  firstValueString,
  isShadowedNumericMirror,
  mirrorForRawKey,
  readNumericMirror,
  stageNumericWrite,
  stageRawWrite,
  stringifyScalar,
  TRACK_MIRROR,
} from "../../utils/mirror-fields.ts";
import { AUDIO_KEYS, INTERNAL_KEYS } from "./tag-keys.ts";

/** The readable basic-tag surface (first-value idiom, numeric mirrors). */
export function getBasicTagData(
  tagData: Record<string, unknown> | null,
): BasicTagData {
  const d = tagData ?? {};
  return {
    title: firstValueString(d.title),
    artist: firstValueString(d.artist),
    album: firstValueString(d.album),
    comment: firstValueString(d.comment),
    genre: firstValueString(d.genre),
    year: readNumericMirror(d, DATE_MIRROR),
    track: readNumericMirror(d, TRACK_MIRROR),
  };
}

/**
 * Merge a basic-tag write into the snapshot. setYear()/setTrack() are
 * authoritative for their wire key: the raw mirror is replaced so a stale
 * "1975-10-31" or "3/12" cannot shadow the new number, and a non-positive
 * value clears the field outright (taglib-bk7, taglib-qpl).
 */
export function setBasicTagData(
  tagData: Record<string, unknown> | null,
  data: Partial<BasicTagData>,
): Record<string, unknown> {
  const merged = { ...tagData, ...data } as Record<string, unknown>;
  if (data.year !== undefined) {
    stageNumericWrite(merged, DATE_MIRROR, data.year);
  }
  if (data.track !== undefined) {
    stageNumericWrite(merged, TRACK_MIRROR, data.track);
  }
  return merged;
}

/** The property map over the snapshot, excluding audio/internal keys. */
export function getProperties(
  tagData: Record<string, unknown> | null,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const data = tagData ?? {};

  for (const [key, value] of Object.entries(data)) {
    if (AUDIO_KEYS.has(key) || INTERNAL_KEYS.has(key)) continue;
    // The foreign-atom read channel (taglib-5ibr): full `----:mean:name`
    // keys are getMP4Item's, not properties — TagLib's PropertyMap never
    // carries a foreign mean, so Emscripten's properties() has no such key.
    if (key.startsWith("----:")) continue;
    // `year` is a numeric mirror of the DATE property; when the full `date`
    // string is present it carries DATE, so skip `year` to avoid both mapping
    // to the same "DATE" wire key (taglib-bk7).
    // A numeric mirror and its raw partner share one wire key, so emitting
    // both would collide; the raw string carries more information and wins.
    if (isShadowedNumericMirror(data, key)) continue;
    if (value === undefined || value === null) continue;
    if (value === 0 || value === "") continue;

    const propKey = toTagLibKey(key);
    if (Array.isArray(value)) {
      // An empty array is the cleared-state marker (itunesAdvisory's rtng
      // removal signal, taglib-an30); the surface shows cleared fields as
      // absent, matching Emscripten.
      if (value.length === 0) continue;
      result[propKey] = value.map(String);
    } else if (typeof value === "object") {
      continue;
    } else if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean" || typeof value === "bigint" ||
      typeof value === "symbol"
    ) {
      result[propKey] = [String(value)];
    }
  }

  return result;
}

/** Replace-style property write; returns the next snapshot record. */
export function setProperties(
  tagData: Record<string, unknown> | null,
  props: Record<string, string[]>,
): Record<string, unknown> {
  const next = { ...tagData } as Record<string, unknown>;
  for (const [key, values] of Object.entries(props)) {
    const camelKey = fromTagLibKey(key);
    if (camelKey === "_mp4ItemNames") {
      // Accumulate: a setMP4Item earlier in this handle's life may already
      // have registered a name that this call does not mention.
      const existing = (next._mp4ItemNames as string[] | undefined) ?? [];
      next._mp4ItemNames = [...new Set([...existing, ...values])];
      continue;
    }
    const mirror = mirrorForRawKey(camelKey);
    if (mirror !== undefined) {
      // Raw string verbatim, mirror re-derived; an empty list clears both.
      stageRawWrite(next, mirror, values);
    } else if (values.length === 0) {
      // An empty value list clears the property (TagLib PropertyMap
      // semantics). This is what lets clearTags() actually remove a field
      // under WASI's merge model, matching Emscripten's replace-style
      // setProperties (taglib-nc5).
      // EXCEPT itunesAdvisory: MP4's rtng item is invisible to TagLib's
      // property map, so the C++ layer must SEE the empty list to remove
      // it (taglib-an30) — an absent key would leave the stale rtng atom
      // behind on MP4. The wire carries [] and apply_mp4_advisory removes
      // the item; getProperties() hides empty arrays from the surface.
      if (camelKey === "itunesAdvisory") next[camelKey] = [];
      else delete next[camelKey];
    } else {
      next[camelKey] = values;
    }
  }
  return next;
}

/** Single-property read (first value of arrays). */
export function getProperty(
  tagData: Record<string, unknown> | null,
  key: string,
): string {
  const mappedKey = fromTagLibKey(key);
  const stored: unknown = tagData?.[mappedKey];
  if (Array.isArray(stored)) {
    const first: unknown = stored[0];
    return stringifyScalar(first);
  }
  return stringifyScalar(stored);
}

/** Single-property write; returns the next snapshot record. */
export function setProperty(
  tagData: Record<string, unknown> | null,
  key: string,
  value: string,
): Record<string, unknown> {
  const mappedKey = fromTagLibKey(key);
  const mirror = mirrorForRawKey(mappedKey);
  if (mirror !== undefined) {
    // The mirror must never outlive the raw string: an empty value is a clear,
    // and an unparseable one has no valid mirror. Leaving a stale number made
    // a delete a silent no-op and let tag() contradict the file (taglib-qpl,
    // taglib-iyfr).
    const next = { ...tagData } as Record<string, unknown>;
    stageRawWrite(next, mirror, value === "" ? [] : [value]);
    return next;
  }
  return { ...tagData, [mappedKey]: value };
}
