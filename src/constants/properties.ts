/**
 * Comprehensive property definitions with metadata for all supported audio metadata fields.
 * This is the single source of truth for all property information including descriptions,
 * types, format support, and format-specific mappings.
 *
 * @example
 * ```typescript
 * import { PROPERTIES, PropertyKey } from 'taglib-wasm/constants';
 *
 * // Type-safe property access with rich metadata
 * const titleProp = PROPERTIES.TITLE;
 * console.log(titleProp.description); // "The title of the track"
 * console.log(titleProp.type);        // "string"
 * console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]
 *
 * // Use with typed methods
 * const title = file.getProperty('TITLE'); // TypeScript knows this returns string | undefined
 * file.setProperty('TRACK_NUMBER', 5);     // TypeScript knows this expects number
 * ```
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

// Re-export property types
export type { PropertyMetadata } from "./property-types.ts";
