/**
 * Rating conversion utilities for cross-format compatibility.
 *
 * @module rating
 *
 * @example
 * ```typescript
 * import { toStars, fromStars, toPopm } from "@charlesw/taglib-wasm/rating";
 *
 * const normalized = fromStars(4, 5);  // 0.8
 * const popm = toPopm(0.8);            // 196
 * ```
 */

export * from "./src/utils/rating.ts";
