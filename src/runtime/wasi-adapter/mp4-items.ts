/**
 * MP4 item operations over the WASI tag-data snapshot.
 *
 * Pure functions over tagData: the WasiFileHandle wrappers add destruction
 * guards. Extracted from file-handle.ts in the taglib-1dfc split.
 */

import {
  fromTagLibKey,
  mp4AtomWireKey,
  PROPERTIES,
} from "../../constants/properties.ts";
import type { RawMP4FreeformItem } from "../../types/tags.ts";
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
  const items = tagData?._mp4Items as Record<string, unknown> | undefined;
  if (items !== undefined && items[key] !== undefined) {
    return stringifyScalar(items[key]);
  }
  return getProperty(tagData, mp4ItemPropertyKey(key));
}

/** Write an MP4 item; returns the next snapshot record. */
export function setMP4Item(
  tagData: Record<string, unknown> | null,
  key: string,
  value: string,
): Record<string, unknown> {
  if (!key.startsWith("----:") && mp4AtomWireKey(key) === undefined) {
    // An exact 4CC with no PropertyMap mapping: TagLib's setProperties would
    // file it as an Apple freeform twin under the uppercased name, so carry an
    // exact-name directive for the save (taglib-5y0s). The read map keeps a
    // staged value readable before the file is reopened.
    const items =
      (tagData?._mp4Items as Record<string, string> | undefined) ?? {};
    const values =
      (tagData?._mp4ItemValues as Record<string, string> | undefined) ?? {};
    let next: Record<string, unknown> = {
      ...tagData,
      _mp4Items: { ...items, [key]: value },
      _mp4ItemValues: { ...values, [key]: value },
    };
    const removals = next._mp4ItemRemovals as string[] | undefined;
    if (removals?.includes(key)) {
      next = {
        ...next,
        _mp4ItemRemovals: removals.filter((name) => name !== key),
      };
    }
    return next;
  }
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
    // Keep the typed channel consistent too: getMP4FreeformItems() serves
    // `_mp4Freeform`, and a write through this item API would otherwise leave
    // it reporting the pre-write value (WASI disagreed with itself and with
    // the Emscripten live handle). A fresh file has no list yet, so start one.
    const sep = key.indexOf(":", 5);
    const freeform =
      (next._mp4Freeform as RawMP4FreeformItem[] | undefined) ?? [];
    if (sep !== -1) {
      const mean = key.slice(5, sep);
      const name = key.slice(sep + 1);
      const kept = freeform.filter(
        (entry) => entry.mean !== mean || entry.name !== name,
      );
      next = {
        ...next,
        _mp4Freeform:
          value === ""
            ? kept
            : [
                ...kept,
                {
                  mean,
                  name,
                  type: 1,
                  value: new TextEncoder().encode(value),
                },
              ],
      };
    }
  }
  return next;
}

/** Exact-name raw item writes staged for the next save (taglib-5y0s). */
export function getMp4ItemValues(
  tagData: Record<string, unknown> | null,
): Record<string, string> | undefined {
  return tagData?._mp4ItemValues as Record<string, string> | undefined;
}

/** Replace the exact-name raw item write directive. */
export function setMp4ItemValues(
  tagData: Record<string, unknown> | null,
  values: Record<string, string>,
): Record<string, unknown> {
  return { ...tagData, _mp4ItemValues: values };
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

/** Typed MP4 freeform entries carried by the snapshot (taglib-gja). */
export function getMP4FreeformItems(
  tagData: Record<string, unknown> | null,
): RawMP4FreeformItem[] {
  const raw = tagData?._mp4Freeform;
  return Array.isArray(raw) ? (raw as RawMP4FreeformItem[]) : [];
}

/** Minimal PROPERTIES entry shape needed to classify a property's MP4 form. */
interface PropertyMetaLike {
  mappings?: { mp4?: unknown };
}

/**
 * The exact MP4 freeform atom a property write lands in, or `undefined` for a
 * standard item. TagLib writes a property with no MP4 mapping as
 * `----:com.apple.iTunes:<wireKey>`; one with a standard mapping ("©nam",
 * "trkn", ...) is not a freeform atom at all.
 */
export function freeformAtomForProperty(wireKey: string): string | undefined {
  if (wireKey.startsWith("_") || wireKey.startsWith("----:")) return undefined;
  const table = PROPERTIES as Record<string, PropertyMetaLike>;
  const meta = table[fromTagLibKey(wireKey)] ?? table[wireKey];
  const atom = meta?.mappings?.mp4;
  if (typeof atom === "string") {
    return atom.startsWith("----:") ? atom : undefined;
  }
  return `----:com.apple.iTunes:${wireKey}`;
}

/**
 * Keep the typed channel in step with a freeform-backed property write.
 *
 * The two views must agree: `setMP4FreeformItems` replaces every freeform
 * atom, so a slot written through the property surface has to be visible to
 * it; and after a binary atom is overwritten by a property write,
 * `getMP4FreeformItems` must not keep serving the binary value. No dirty flag
 * is set here — the property surface owns the value, this only mirrors it.
 */
export function mirrorFreeformPropertyWrite(
  tagData: Record<string, unknown> | null,
  wireKey: string,
  values: readonly string[],
): Record<string, unknown> {
  const base = tagData ?? {};
  const atom = freeformAtomForProperty(wireKey);
  if (atom === undefined) return base;
  const sep = atom.lastIndexOf(":");
  const mean = atom.slice(5, sep);
  const name = atom.slice(sep + 1);
  const kept = getMP4FreeformItems(base).filter(
    (entry) => entry.mean !== mean || entry.name !== name,
  );
  const added = values
    .filter((value) => value !== "")
    .map((value) => ({
      mean,
      name,
      type: 1,
      value: new TextEncoder().encode(value),
    }));
  return { ...base, _mp4Freeform: [...kept, ...added] };
}

/**
 * Keep the property slots a typed list owns in sync with it. Without this a
 * typed write only wins on the save that applies the directive; the stale
 * property slot is what the next save ships (taglib-gja review).
 */
function syncFreeformPropertySlots(
  tagData: Record<string, unknown> | null,
  oldItems: readonly RawMP4FreeformItem[],
  newItems: readonly RawMP4FreeformItem[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...tagData };
  const clearSlot = (item: RawMP4FreeformItem) => {
    // Only com.apple.iTunes is representable in the PropertyMap. A foreign-mean
    // atom belongs to the typed channel alone: clearing its bare-name slot
    // would delete an unrelated Apple atom that happens to share the name.
    if (item.mean !== "com.apple.iTunes") return;
    const upper = item.name.toUpperCase();
    delete next[upper];
    delete next[fromTagLibKey(upper)];
  };
  for (const item of oldItems) clearSlot(item);
  for (const item of newItems) clearSlot(item);
  // One atom can carry several values. The PropertyMap expresses a StringList,
  // so mirror the whole group — writing one slot per item left only the last
  // value, and with the typed apply now running first that single value would
  // overwrite the group on the same save.
  const utf8Slots = new Map<string, string[]>();
  for (const item of newItems) {
    // Only UTF-8 is representable in the PropertyMap; binary/typed values
    // ride the directive alone.
    if (item.type === 1 && item.mean === "com.apple.iTunes") {
      const key = fromTagLibKey(item.name.toUpperCase());
      const values = utf8Slots.get(key) ?? [];
      values.push(new TextDecoder().decode(item.value));
      utf8Slots.set(key, values);
    }
  }
  for (const [key, values] of utf8Slots) next[key] = values;
  return next;
}

/** Stage a full replacement of the typed freeform channel. */
export function setMP4FreeformItems(
  tagData: Record<string, unknown> | null,
  items: readonly RawMP4FreeformItem[],
): Record<string, unknown> {
  const next = syncFreeformPropertySlots(
    tagData,
    getMP4FreeformItems(tagData),
    items,
  );
  return { ...next, _mp4Freeform: items, _mp4FreeformDirty: true };
}

/** Clear the write directive after a successful save (idempotent). */
export function clearMP4FreeformDirty(
  tagData: Record<string, unknown> | null,
): Record<string, unknown> {
  if (tagData?._mp4FreeformDirty === undefined) {
    return tagData ?? {};
  }
  // A non-UTF-8 item has no PropertyMap representation, so keeping the
  // directive is what prevents the next save from replacing it with the
  // (necessarily absent or lossy) property slot.
  const items = tagData._mp4Freeform;
  if (
    Array.isArray(items) &&
    items.some((item) => (item as RawMP4FreeformItem).type !== 1)
  ) {
    return tagData;
  }
  const next = { ...tagData };
  delete next._mp4FreeformDirty;
  return next;
}

/** Remove an MP4 item; returns the next snapshot record (null on no-op). */
export function removeMP4Item(
  tagData: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!tagData) return null;
  let next = tagData;
  if (!key.startsWith("----:") && mp4AtomWireKey(key) === undefined) {
    // Exact-name raw atom: drop the staged read/write slots and register the
    // on-disk removal; setProperty cannot express it (taglib-5y0s).
    const drop = (map: Record<string, string> | undefined) =>
      map === undefined
        ? undefined
        : Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
    const items = drop(next._mp4Items as Record<string, string> | undefined);
    const values = drop(
      next._mp4ItemValues as Record<string, string> | undefined,
    );
    next = { ...next };
    if (items !== undefined) next._mp4Items = items;
    if (values !== undefined) next._mp4ItemValues = values;
    return registerMp4ItemRemoval(next, key);
  }
  if (key.startsWith("----:")) {
    // Foreign-mean freeform atom: the value may sit under the raw
    // `----:` key (snapshot mirror, taglib-5ibr) — delete it there AND
    // record the exact atom name for the C++ save to removeItem() (the
    // PropertyMap erase pass cannot express foreign atoms, taglib-65nm).
    delete next[key];
    const sep = key.indexOf(":", 5);
    if (sep !== -1) {
      const mean = key.slice(5, sep);
      const name = key.slice(sep + 1);
      const freeform = next._mp4Freeform as RawMP4FreeformItem[] | undefined;
      if (freeform !== undefined) {
        const kept = freeform.filter(
          (entry) => entry.mean !== mean || entry.name !== name,
        );
        if (kept.length !== freeform.length) {
          next = { ...next, _mp4Freeform: kept };
        }
      }
    }
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
