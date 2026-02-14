/**
 * @fileoverview Global worker pool management functions
 */

import type { WorkerPoolOptions } from "./types.ts";
import { TagLibWorkerPool } from "./pool.ts";

let globalPool: TagLibWorkerPool | null = null;

/**
 * Create a new worker pool instance
 * @param options Worker pool configuration
 * @returns Promise that resolves to an initialized worker pool
 */
export async function createWorkerPool(
  options?: WorkerPoolOptions,
): Promise<TagLibWorkerPool> {
  const pool = new TagLibWorkerPool(options);
  await pool.initialize();
  return pool;
}

/**
 * Get or create a global worker pool instance
 * @deprecated Use createWorkerPool() instead for better error handling
 */
export function getGlobalWorkerPool(
  options?: WorkerPoolOptions,
): TagLibWorkerPool {
  globalPool ??= new TagLibWorkerPool(options);
  return globalPool;
}

/**
 * Terminate the global worker pool
 */
export function terminateGlobalWorkerPool(): void {
  if (globalPool) {
    globalPool.terminate();
    globalPool = null;
  }
}
