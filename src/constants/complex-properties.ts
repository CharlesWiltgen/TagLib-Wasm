/**
 * Complex property definitions for structured metadata types.
 * These are properties that contain multiple fields and cannot be
 * represented as simple string values.
 *
 * These constants describe the shape of each complex property. Values are read
 * and written through dedicated typed accessors, not a generic property call.
 *
 * @example
 * ```typescript
 * import type { Rating } from 'taglib-wasm';
 *
 * // Read via the typed accessor
 * const ratings = file.getRatings();
 * console.log(ratings[0].rating); // 0.0-1.0 normalized
 *
 * // Set a rating
 * file.setRating(0.8, "user@example.com");
 *
 * // Or replace the full list
 * file.setRatings([{ rating: 0.8, email: "user@example.com" }]);
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
 * A raw ID3v2 frame (escape hatch for vendor and unsupported frames).
 *
 * `data` is the frame BODY only (no 10-byte header); the caller owns the
 * body encoding. Reads of TagLib-modeled IDs (TIT2, APIC, ...) return
 * TagLib's canonical rendering; see the raw-frames docs for caveats.
 */
export interface Id3v2Frame {
  /** 4-character frame ID matching [A-Z0-9]{4}, e.g. "TXXX", "RGAD" */
  id: string;
  /** Frame body bytes (without the 10-byte frame header) */
  data: Uint8Array;
  /**
   * Frame header flags. Reserved for forward compatibility: currently never
   * populated — TagLib blanks frame header flags when rendering, so they
   * cannot be observed or preserved. Read-only.
   */
  flags?: number;
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
