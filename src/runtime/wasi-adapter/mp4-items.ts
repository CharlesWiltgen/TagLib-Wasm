/**
 * MP4 item operations over the WASI tag-data snapshot.
 *
 * Pure functions over tagData: the WasiFileHandle wrappers add destruction
 * guards. Extracted from file-handle.ts in the taglib-1dfc split.
 */

import { fromTagLibKey, mp4AtomWireKey } from "../../constants/properties.ts";
import { mirrorForRawKey, stringifyScalar } from "../../utils/mirror-fields.ts";
import { getProperty, setProperty } from "./property-surface.ts";

/**
 * Normalize an MP4 item key for the PropertyMap path. TagLib's MP4 PropertyMap
 * keys a freeform `----:mean:NAME` atom by its bare NAME, uppercased (the usual
 * key remap then maps known atoms like iTunNORM -> appleSoundCheck). WASI MP4
 * items ride the PropertyMap, so the full iTunes atom key that Emscripten's
 * dedicated Item API uses must be normalized or the value is silently dropped on
 * save (taglib-1qn). Non-freeform keys pass through unchanged.
 */
export function mp4ItemPropertyKey(key: string): string {
  if (key.startsWith("----:")) {
    return key.slice(key.lastIndexOf(":") + 1).toUpperCase();
  }
  // A STANDARD atom ("trkn", "©nam") is not a PropertyMap key either — TagLib
  // keys it by the corresponding property. Without this, WASI looked up
  // tagData["trkn"] while the value lives under `trackNumber`, so every item
  // operation on a standard atom silently targeted nothing (taglib-0piv).
  return mp4AtomWireKey(key) ?? key;
}

/** Read an MP4 item; foreign-mean atoms ride their full `----:` slot. */
export function getMP4Item(
  tagData: Record<string, unknown> | null,
  key: string,
): string {
  // A foreign-mean freeform atom never reaches the PropertyMap; the shim
  // ships it in the snapshot under its FULL atom name instead, and
  // setMP4Item keeps that slot current for staged writes (taglib-5ibr).
  // Checked first: the bare-name property slot can name a DIFFERENT atom
  // (TagLib files "MYTAG" under Apple's namespace).
  if (key.startsWith("----:")) {
    const foreign: unknown = tagData?.[key];
    if (foreign !== undefined) {
      if (Array.isArray(foreign)) {
        const first: unknown = foreign[0];
        return stringifyScalar(first);
      }
      return stringifyScalar(foreign);
    }
  }
  return getProperty(tagData, mp4ItemPropertyKey(key));
}

/** Write an MP4 item; returns the next snapshot record. */
export function setMP4Item(
  tagData: Record<string, unknown> | null,
  key: string,
  value: string,
): Record<string, unknown> {
  let next = setProperty(tagData, mp4ItemPropertyKey(key), value);
  // The property slot above is keyed by the UPPERCASED bare name, which is
  // what TagLib's PropertyMap will hand back. Register the caller's exact
  // spelling so the C++ write path can restore it (taglib-bnhl).
  if (key.startsWith("----:")) {
    next = registerMp4ItemName(next, key);
    // A snapshot from a file that already held this atom serves reads under
    // the full name; without this a staged overwrite would read back stale
    // (taglib-5ibr). The key never reaches the propMap — the C++ decoder
    // drops `----:` keys.
    if (next?.[key] !== undefined) {
      next = { ...next, [key]: value };
    }
  }
  return next;
}

/** Record an exact atom name to be repaired after the PropertyMap write. */
export function registerMp4ItemName(
  tagData: Record<string, unknown> | null,
  name: string,
): Record<string, unknown> {
  const existing = (tagData?._mp4ItemNames as string[] | undefined) ?? [];
  if (existing.includes(name)) return tagData ?? {};
  return {
    ...tagData,
    _mp4ItemNames: [...existing, name],
  };
}

/**
 * Record a foreign-mean freeform atom for deletion at save (taglib-65nm).
 * The PropertyMap erase pass cannot express foreign atoms, so the C++ shim
 * consumes this list and calls removeItem on each exact atom name.
 */
export function registerMp4ItemRemoval(
  tagData: Record<string, unknown> | null,
  name: string,
): Record<string, unknown> {
  const existing = (tagData?._mp4ItemRemovals as string[] | undefined) ?? [];
  if (existing.includes(name)) return tagData ?? {};
  return {
    ...tagData,
    _mp4ItemRemovals: [...existing, name],
  };
}

/** The accumulated foreign-atom removals pending the next save. */
export function getMp4ItemRemovals(
  tagData: Record<string, unknown> | null,
): string[] | undefined {
  return tagData?._mp4ItemRemovals as string[] | undefined;
}

/** Replace the pending foreign-atom removal list. */
export function setMp4ItemRemovals(
  tagData: Record<string, unknown> | null,
  removals: string[],
): Record<string, unknown> {
  return {
    ...tagData,
    _mp4ItemRemovals: [...new Set(removals)],
  };
}

/** Remove an MP4 item; returns the next snapshot record (null on no-op). */
export function removeMP4Item(
  tagData: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!tagData) return null;
  let next = tagData;
  if (key.startsWith("----:")) {
    // Foreign-mean freeform atom: the value may sit under the raw
    // `----:` key (snapshot mirror, taglib-5ibr) — delete it there AND
    // record the exact atom name for the C++ save to removeItem() (the
    // PropertyMap erase pass cannot express foreign atoms, taglib-65nm).
    delete next[key];
    next = registerMp4ItemRemoval(next, key);
  }
  // "trkn" now resolves to TRACKNUMBER, so the numeric mirror IS reachable
  // here and must go with the raw value — otherwise tag().track keeps
  // reporting a removed track (taglib-qpl mirror invariant).
  const mappedKey = fromTagLibKey(mp4ItemPropertyKey(key));
  delete next[mappedKey];
  const mirror = mirrorForRawKey(mappedKey);
  if (mirror !== undefined) delete next[mirror.numeric];
  return next;
}
