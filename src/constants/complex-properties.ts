/**
 * Complex property definitions for structured metadata types.
 * These are properties that contain multiple fields and cannot be
 * represented as simple string values.
 *
 * @example
 * ```typescript
 * import { COMPLEX_PROPERTIES, COMPLEX_PROPERTY_KEY, Rating } from 'taglib-wasm';
 *
 * // Type-safe property access
 * const ratings = file.getComplexProperty(COMPLEX_PROPERTY_KEY.RATING);
 * console.log(ratings[0].rating); // 0.0-1.0 normalized
 *
 * // Set a rating
 * file.setComplexProperty(COMPLEX_PROPERTY_KEY.RATING, [
 *   { rating: 0.8, email: "user@example.com" }
 * ]);
 * ```
 */

import type { Picture } from "../types.ts";

/**
 * Rating metadata representing track popularity/rating.
 * Uses normalized 0.0-1.0 scale for cross-format compatibility.
 *
 * Format mappings:
 * - ID3v2 (MP3): POPM frame (0-255 scale, normalized)
 * - Vorbis (FLAC/OGG): RATING field
 * - MP4: Freeform ----:com.apple.iTunes:RATING atom
 */
export interface Rating {
  /** Normalized rating 0.0-1.0 (0 = unrated, 1.0 = highest) */
  rating: number;
  /** Email/ID identifying the rater (POPM standard) */
  email?: string;
  /** Play counter (if supported by format) */
  counter?: number;
}

/**
 * Unsynchronized lyrics text.
 * For lyrics without timing information.
 */
export interface UnsyncedLyrics {
  /** Full lyrics text */
  text: string;
  /** Description or content type */
  description?: string;
  /** ISO 639-2 language code (3 characters, e.g., "eng") */
  language?: string;
}

/**
 * Generic variant map for unknown/future complex properties.
 * Used as escape hatch when type is not known at compile time.
 */
export type VariantMap = Record<string, unknown>;

/**
 * Type map linking complex property keys to their value types.
 * Enables type-safe generic methods for getComplexProperty/setComplexProperty.
 *
 * @example
 * ```typescript
 * // TypeScript knows the return type based on key
 * const ratings = file.getComplexProperty("RATING"); // Rating[]
 * const pictures = file.getComplexProperty("PICTURE"); // Picture[]
 * ```
 *
 * Consumers can extend via module augmentation:
 * ```typescript
 * declare module "taglib-wasm" {
 *   interface ComplexPropertyValueMap {
 *     MY_CUSTOM: { foo: string };
 *   }
 * }
 * ```
 */
/**
 * Chapter marker metadata (ID3v2 CHAP frames).
 * Describes a time range within an audio file.
 */
export interface Chapter {
  /** Unique element ID for the chapter */
  id: string;
  /** Start time in milliseconds */
  startTimeMs: number;
  /** End time in milliseconds */
  endTimeMs: number;
  /** Optional chapter title */
  title?: string;
}

export interface ComplexPropertyValueMap {
  /** Cover art and embedded images */
  PICTURE: Picture;
  /** Track/album rating (normalized 0.0-1.0) */
  RATING: Rating;
  /** Unsynchronized lyrics text */
  LYRICS: UnsyncedLyrics;
  /** Chapter markers (ID3v2 CHAP frames) */
  CHAPTER: Chapter;
}

/**
 * Union type of all valid complex property keys.
 */
export type ComplexPropertyKey = keyof ComplexPropertyValueMap;

/**
 * Complex property metadata interface.
 */
export interface ComplexPropertyMetadata {
  key: string;
  description: string;
  type: "binary" | "object";
  supportedFormats: readonly string[];
  mappings: Record<
    string,
    string | { frame?: string; atom?: string; description?: string }
  >;
}

/**
 * Rich metadata object for complex properties.
 * Contains descriptions, format support info, and underlying format mappings.
 *
 * Use this for introspection, documentation, or format-aware operations.
 */
export const COMPLEX_PROPERTIES = {
  PICTURE: {
    key: "PICTURE",
    description: "Embedded album art or images",
    type: "binary" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "FLAC"] as const,
    mappings: {
      id3v2: { frame: "APIC" },
      mp4: "covr",
      vorbis: "METADATA_BLOCK_PICTURE",
      flac: "PICTURE",
    },
  },
  RATING: {
    key: "RATING",
    description: "Track rating (normalized 0.0-1.0)",
    type: "object" as const,
    supportedFormats: ["ID3v2", "Vorbis", "MP4"] as const,
    mappings: {
      id3v2: { frame: "POPM" },
      vorbis: "RATING",
      mp4: "----:com.apple.iTunes:RATING",
    },
  },
  LYRICS: {
    key: "LYRICS",
    description: "Unsynchronized lyrics text",
    type: "object" as const,
    supportedFormats: ["ID3v2", "Vorbis", "MP4"] as const,
    mappings: {
      id3v2: { frame: "USLT" },
      vorbis: "LYRICS",
      mp4: "©lyr",
    },
  },
  CHAPTER: {
    key: "CHAPTER",
    description: "Chapter markers with time ranges",
    type: "object" as const,
    supportedFormats: ["ID3v2"] as const,
    mappings: {
      id3v2: { frame: "CHAP" },
    },
  },
} as const;

/**
 * Type for the simple key map.
 */
export type ComplexPropertyKeyMap = {
  readonly [K in ComplexPropertyKey]: K;
};

/**
 * Simple string map for daily use.
 * Avoids the `.key` ceremony when you just need the key string.
 *
 * @example
 * ```typescript
 * // Instead of: file.getComplexProperty(COMPLEX_PROPERTIES.RATING.key)
 * file.getComplexProperty(COMPLEX_PROPERTY_KEY.RATING);
 * ```
 */
export const COMPLEX_PROPERTY_KEY: ComplexPropertyKeyMap = {
  PICTURE: "PICTURE",
  RATING: "RATING",
  LYRICS: "LYRICS",
  CHAPTER: "CHAPTER",
} as const;
