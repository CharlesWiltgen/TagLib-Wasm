/**
 * Comprehensive property definitions with metadata for all supported audio metadata fields.
 * This is the single source of truth for all property information including descriptions,
 * types, format support, and format-specific mappings.
 *
 * Keys are camelCase (e.g. "title", "musicbrainzTrackId"). Each entry's `.key` field
 * contains the TagLib ALL_CAPS wire name (e.g. "TITLE", "MUSICBRAINZ_TRACKID").
 *
 * Use `toTagLibKey()` / `fromTagLibKey()` to translate between the two vocabularies.
 */

import { ADDITIONAL_PROPERTIES } from "./additional-properties.ts";
import { BASIC_PROPERTIES } from "./basic-properties.ts";
import { GENERAL_EXTENDED_PROPERTIES } from "./general-extended-properties.ts";
import { SPECIALIZED_PROPERTIES } from "./specialized-properties.ts";

// Combine all properties into a single object
export const PROPERTIES = {
  ...BASIC_PROPERTIES,
  ...GENERAL_EXTENDED_PROPERTIES,
  ...SPECIALIZED_PROPERTIES,
  ...ADDITIONAL_PROPERTIES,
} as const;

/**
 * Type representing all valid property keys from the PROPERTIES object.
 * This provides TypeScript autocomplete and type safety.
 */
export type PropertyKey = keyof typeof PROPERTIES;

/**
 * Type representing the property value type based on the property definition.
 * Currently all properties are strings, but this allows for future expansion.
 */
export type PropertyValue<K extends PropertyKey> =
  typeof PROPERTIES[K]["type"] extends "string" ? string
    : typeof PROPERTIES[K]["type"] extends "number" ? number
    : typeof PROPERTIES[K]["type"] extends "boolean" ? boolean
    : string;

// Build bidirectional lookup maps from PROPERTIES
const _toTagLib: Record<string, string> = {};
const _fromTagLib: Record<string, string> = {};
for (const [camelKey, meta] of Object.entries(PROPERTIES)) {
  const wireKey = (meta as { key: string }).key;
  _toTagLib[camelKey] = wireKey;
  _fromTagLib[wireKey] = camelKey;
}

// Forward-only aliases: ExtendedTag field names that map to the same wire keys
// as their PropertyMap equivalents. Only added to _toTagLib (not _fromTagLib)
// so that fromTagLibKey("DATE") still returns "date" (the canonical PropertyMap key).
_toTagLib["year"] = "DATE";
_toTagLib["track"] = "TRACKNUMBER";
// Legacy: older C++ binaries sent "disc" instead of "discNumber"
_fromTagLib["disc"] = "discNumber";

/** Translate a camelCase property key to TagLib's ALL_CAPS wire key. Unknown keys pass through. */
export function toTagLibKey(key: string): string {
  return _toTagLib[key] ?? key;
}

// Wire key -> exact MP4 freeform atom name, for the properties whose atom is a
// `----:com.apple.iTunes:*` freeform atom. TagLib's PropertyMap uppercases every
// key, so writing one of these through the property surface produces
// `REPLAYGAIN_TRACK_GAIN` where the ecosystem expects `replaygain_track_gain`.
// The C++ layer repairs the casing but cannot invent the name of an atom that is
// not yet on disk, so it is sent along on write (taglib-bnhl).
//
// Derived from the PROPERTIES table rather than hand-listed, so a new property
// with a freeform atom mapping is covered automatically. Entries whose atom name
// is already all-uppercase are omitted: nothing can be lost for those.
const _mp4FreeformAtoms: Record<string, string> = {};
for (const meta of Object.values(PROPERTIES)) {
  const { key, mappings } = meta as {
    key: string;
    mappings?: { mp4?: unknown };
  };
  const atom = mappings?.mp4;
  if (typeof atom !== "string" || !atom.startsWith("----:")) continue;
  const bare = atom.slice(atom.lastIndexOf(":") + 1);
  if (bare === bare.toUpperCase()) continue;
  _mp4FreeformAtoms[key] = atom;

  // Writing the atom under its real name changes the key TagLib reports back:
  // "Acoustid Fingerprint" reads as ACOUSTID FINGERPRINT (space), not our
  // ACOUSTID_FINGERPRINT (underscore), so without this alias the typed property
  // would stop resolving — correct on disk, invisible to us. Only added when it
  // does not shadow a real wire key.
  const readKey = bare.toUpperCase();
  const camel = _fromTagLib[key];
  if (camel !== undefined && _fromTagLib[readKey] === undefined) {
    _fromTagLib[readKey] = camel;
  }
}

/**
 * Exact MP4 atom names for the given TagLib wire keys, for keys backed by a
 * mixed-case freeform atom. Empty when none apply, which is the common case.
 */
export function mp4FreeformAtomNames(wireKeys: Iterable<string>): string[] {
  const names: string[] = [];
  for (const key of wireKeys) {
    const atom = _mp4FreeformAtoms[key];
    if (atom !== undefined) names.push(atom);
  }
  return names;
}

/** Translate a TagLib ALL_CAPS wire key to a camelCase property key. Unknown keys pass through. */
export function fromTagLibKey(key: string): string {
  return _fromTagLib[key] ?? key;
}

/** Remap all keys of an object from TagLib ALL_CAPS to camelCase. */
export function remapKeysFromTagLib<V>(
  obj: Record<string, V>,
): Record<string, V> {
  const result: Record<string, V> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[fromTagLibKey(key)] = value;
  }
  return result;
}

// Re-export property types
export type { PropertyMetadata } from "./property-types.ts";
