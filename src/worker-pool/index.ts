/**
 * @fileoverview Worker pool module barrel export
 *
 * Provides efficient parallel processing of audio files using Web Workers,
 * with support for both Simple and Full API operations.
 */

export type { BatchOperation, WorkerPoolOptions, WorkerTask } from "./types.ts";

export { TagLibWorkerPool } from "./pool.ts";

export {
  createWorkerPool,
  getGlobalWorkerPool,
  terminateGlobalWorkerPool,
} from "./global-pool.ts";
