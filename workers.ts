/**
 * Worker pool API for parallel audio metadata processing.
 *
 * Use this module for high-throughput scenarios like batch processing
 * music libraries or handling multiple concurrent requests.
 *
 * @module workers
 *
 * @example
 * ```typescript
 * import { TagLibWorkers } from "@charlesw/taglib-wasm/workers";
 *
 * // Create a worker pool
 * const pool = new TagLibWorkers({ poolSize: 4 });
 *
 * // Process files in parallel
 * const results = await Promise.all(
 *   files.map(file => pool.readTags(file))
 * );
 *
 * pool.terminate();
 * ```
 */

export * from "./src/workers.ts";
