/**
 * Rating conversion utilities for cross-format compatibility.
 *
 * All ratings are stored internally as normalized 0.0-1.0 values.
 * These utilities convert between normalized values and format-specific
 * representations (POPM 0-255, star ratings, percentages).
 *
 * @example
 * ```typescript
 * import { RatingUtils } from 'taglib-wasm';
 *
 * // Convert from 5-star to normalized
 * const normalized = RatingUtils.fromStars(4, 5);  // 0.8
 *
 * // Convert to POPM value for ID3v2
 * const popm = RatingUtils.toPopm(0.8);  // 196
 *
 * // Display as percentage
 * const percent = RatingUtils.toPercent(0.8);  // 80
 * ```
 */

type Brand<T, K extends string> = T & { readonly __brand: K };

/** Normalized rating value (0.0-1.0 scale). */
export type NormalizedRating = Brand<number, "NormalizedRating">;

/** POPM rating value (0-255 scale, as used in ID3v2 Popularimeter frames). */
export type PopmRating = Brand<number, "PopmRating">;

/** Create a NormalizedRating from a plain number. */
export function normalized(value: number): NormalizedRating {
  return value as NormalizedRating;
}

/** Create a PopmRating from a plain number. */
export function popm(value: number): PopmRating {
  return value as PopmRating;
}

/**
 * Convert POPM value (0-255) to normalized (0.0-1.0).
 * Precision-preserving linear conversion.
 *
 * @param value - POPM rating value (0-255)
 * @returns Normalized rating (0.0-1.0)
 */
export function toNormalized(value: PopmRating): NormalizedRating {
  return value / 255 as NormalizedRating;
}

/**
 * Convert normalized (0.0-1.0) to POPM value (0-255).
 * Precision-preserving linear conversion.
 *
 * @param value - Normalized rating (0.0-1.0)
 * @returns POPM rating value (0-255)
 */
export function fromNormalized(value: NormalizedRating): PopmRating {
  return Math.round(value * 255) as PopmRating;
}

/**
 * Convert normalized rating to star value.
 *
 * @param value - Normalized rating (0.0-1.0)
 * @param maxStars - Maximum star count (default: 5)
 * @returns Star rating (0 to maxStars)
 */
export function toStars(value: NormalizedRating, maxStars = 5): number {
  return Math.round(value * maxStars);
}

/**
 * Convert star rating to normalized value.
 *
 * @param stars - Star rating
 * @param maxStars - Maximum star count (default: 5)
 * @returns Normalized rating (0.0-1.0)
 */
export function fromStars(stars: number, maxStars = 5): NormalizedRating {
  return stars / maxStars as NormalizedRating;
}

/**
 * Standard POPM values for 5-star ratings.
 * This mapping is widely used by media players (Windows Media Player, etc.)
 *
 * 0 = unrated
 * 1 = 1 star
 * 64 = 2 stars
 * 128 = 3 stars
 * 196 = 4 stars
 * 255 = 5 stars
 */
const POPM_STAR_VALUES = [0, 1, 64, 128, 196, 255] as const;

/**
 * Convert normalized rating to standard POPM value.
 * Uses the widely-adopted 5-star to POPM mapping.
 *
 * @param value - Normalized rating (0.0-1.0)
 * @returns POPM value (0, 1, 64, 128, 196, or 255)
 */
export function toPopm(value: NormalizedRating): PopmRating {
  const stars = Math.round(value * 5);
  return (POPM_STAR_VALUES[stars] ?? 0) as PopmRating;
}

/**
 * Convert POPM value to normalized rating using standard mapping.
 * Handles the full 0-255 range by mapping to nearest star level.
 *
 * @param value - POPM rating value (0-255)
 * @returns Normalized rating (0.0, 0.2, 0.4, 0.6, 0.8, or 1.0)
 */
export function fromPopm(value: PopmRating): NormalizedRating {
  if (value === 0) return 0 as NormalizedRating;
  if (value <= 1) return 0.2 as NormalizedRating;
  if (value <= 64) return 0.4 as NormalizedRating;
  if (value <= 128) return 0.6 as NormalizedRating;
  if (value <= 196) return 0.8 as NormalizedRating;
  return 1 as NormalizedRating;
}

/**
 * Convert normalized rating to percentage.
 *
 * @param value - Normalized rating (0.0-1.0)
 * @returns Percentage (0-100)
 */
export function toPercent(value: NormalizedRating): number {
  return value * 100;
}

/**
 * Convert percentage to normalized rating.
 *
 * @param percent - Percentage (0-100)
 * @returns Normalized rating (0.0-1.0)
 */
export function fromPercent(percent: number): NormalizedRating {
  return percent / 100 as NormalizedRating;
}

/**
 * Clamp a rating to the valid normalized range.
 *
 * @param rating - Rating value to clamp
 * @returns Rating clamped to 0.0-1.0
 */
export function clamp(rating: number): NormalizedRating {
  return Math.max(0, Math.min(1, rating)) as NormalizedRating;
}

/**
 * Check if a rating is valid (within 0.0-1.0 range).
 *
 * @param rating - Rating value to check
 * @returns True if rating is valid
 */
export function isValid(rating: number): rating is NormalizedRating {
  return typeof rating === "number" && !Number.isNaN(rating) && rating >= 0 &&
    rating <= 1;
}

/**
 * Namespace export for convenient grouped access.
 */
export const RatingUtils = {
  normalized,
  popm,
  toNormalized,
  fromNormalized,
  toStars,
  fromStars,
  toPopm,
  fromPopm,
  toPercent,
  fromPercent,
  clamp,
  isValid,
  POPM_STAR_VALUES,
} as const;
