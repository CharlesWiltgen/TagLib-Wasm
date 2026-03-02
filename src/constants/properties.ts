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

import { BASIC_PROPERTIES } from "./basic-properties.ts";
import { GENERAL_EXTENDED_PROPERTIES } from "./general-extended-properties.ts";
import { SPECIALIZED_PROPERTIES } from "./specialized-properties.ts";

// Combine all properties into a single object
export const PROPERTIES = {
  ...BASIC_PROPERTIES,
  ...GENERAL_EXTENDED_PROPERTIES,
  ...SPECIALIZED_PROPERTIES,
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

/** Translate a camelCase property key to TagLib's ALL_CAPS wire key. Unknown keys pass through. */
export function toTagLibKey(key: string): string {
  return _toTagLib[key] ?? key;
}

/** Translate a TagLib ALL_CAPS wire key to a camelCase property key. Unknown keys pass through. */
export function fromTagLibKey(key: string): string {
  return _fromTagLib[key] ?? key;
}

// Re-export property types
export type { PropertyMetadata } from "./property-types.ts";
