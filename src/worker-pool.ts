/**
 * @fileoverview Worker pool implementation for parallel audio file processing
 *
 * Provides efficient parallel processing of audio files using Web Workers,
 * with support for both Simple and Full API operations.
 */

import type { AudioProperties, Picture, Tag } from "./types.ts";
import { WorkerError } from "./errors.ts";

/**
 * Worker pool configuration options
 */
export interface WorkerPoolOptions {
  /** Number of worker threads (defaults to hardwareConcurrency or 4) */
  size?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Worker initialization timeout in ms */
  initTimeout?: number;
  /** Operation timeout in ms */
  operationTimeout?: number;
}

/**
 * Task types supported by the worker pool
 */
export type WorkerTask =
  | { op: "readTags"; file: string | Uint8Array }
  | { op: "readProperties"; file: string | Uint8Array }
  | { op: "applyTags"; file: string | Uint8Array; tags: Partial<Tag> }
  | { op: "updateTags"; file: string; tags: Partial<Tag> }
  | { op: "readPictures"; file: string | Uint8Array }
  | {
    op: "setCoverArt";
    file: string | Uint8Array;
    coverArt: Uint8Array;
    mimeType?: string;
  }
  | { op: "batch"; file: string | Uint8Array; operations: BatchOperation[] };

/**
 * Batch operations for Full API
 */
export interface BatchOperation {
  method: string;
  args?: any[];
}

/**
 * Worker task with promise handlers
 */
interface QueuedTask {
  task: WorkerTask;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

/**
 * Worker state tracking
 */
interface WorkerState {
  worker: Worker;
  busy: boolean;
  initialized: boolean;
  initTimeout?: ReturnType<typeof setTimeout>;
}

/**
 * TagLib Worker Pool for parallel audio file processing
 *
 * @example
 * ```typescript
 * // Create a worker pool
 * const pool = new TagLibWorkerPool({ size: 4 });
 *
 * // Process files in parallel
 * const tags = await Promise.all(
 *   files.map(file => pool.readTags(file))
 * );
 *
 * // Batch operations
 * const results = await pool.readTagsBatch(files);
 *
 * // Clean up
 * pool.terminate();
 * ```
 */
export class TagLibWorkerPool {
  private workers: WorkerState[] = [];
  private queue: QueuedTask[] = [];
  private terminated = false;
  private readonly initPromise: Promise<void>;

  private readonly size: number;
  private readonly debug: boolean;
  private readonly initTimeout: number;
  private readonly operationTimeout: number;

  constructor(options: WorkerPoolOptions = {}) {
    this.size = options.size ??
      (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) ??
      4;
    this.debug = options.debug ?? false;
    this.initTimeout = options.initTimeout ?? 30000;
    this.operationTimeout = options.operationTimeout ?? 60000;

    // Defer initialization to avoid async operation in constructor
    this.initPromise = this.deferredInit();
  }

  /**
   * Deferred initialization to avoid async operation in constructor
   */
  private async deferredInit(): Promise<void> {
    // Use queueMicrotask to ensure constructor completes first
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    return this.initializeWorkers();
  }

  /**
   * Wait for the worker pool to be ready
   */
  async waitForReady(): Promise<void> {
    await this.initPromise;

    // Double-check that all workers are initialized
    const maxRetries = 20; // Increase retries for slower CI environments
    for (let i = 0; i < maxRetries; i++) {
      if (this.workers.every((w) => w.initialized)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const initializedCount = this.workers.filter((w) => w.initialized).length;
    throw new WorkerError(
      `Worker pool initialization timeout: ${initializedCount}/${this.workers.length} workers initialized`,
    );
  }

  /**
   * Initialize worker threads
   */
  private async initializeWorkers(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.size; i++) {
      const workerState: WorkerState = {
        worker: this.createWorker(),
        busy: false,
        initialized: false,
      };

      this.workers.push(workerState);

      // Initialize each worker
      const initPromise = new Promise<void>((resolve, reject) => {
        workerState.initTimeout = setTimeout(() => {
          workerState.initTimeout = undefined;
          reject(new WorkerError("Worker initialization timed out"));
        }, this.initTimeout);

        const messageHandler = (e: MessageEvent) => {
          if (e.data.type === "initialized") {
            if (workerState.initTimeout) {
              clearTimeout(workerState.initTimeout);
              workerState.initTimeout = undefined;
            }
            workerState.initialized = true;
            workerState.worker.removeEventListener("message", messageHandler);
            if (this.debug) console.log(`Worker ${i} initialized`);
            resolve();
          } else if (e.data.type === "error") {
            if (workerState.initTimeout) {
              clearTimeout(workerState.initTimeout);
              workerState.initTimeout = undefined;
            }
            workerState.worker.removeEventListener("message", messageHandler);
            reject(new WorkerError(e.data.error));
          }
        };

        workerState.worker.addEventListener("message", messageHandler);
        workerState.worker.addEventListener("error", (event) => {
          if (workerState.initTimeout) {
            clearTimeout(workerState.initTimeout);
            workerState.initTimeout = undefined;
          }
          const message = event instanceof ErrorEvent
            ? event.message
            : String(event);
          reject(new WorkerError(`Worker error: ${message}`));
        });

        // Send initialization message
        workerState.worker.postMessage({ op: "init" });
      });

      initPromises.push(initPromise);
    }

    await Promise.all(initPromises);
  }

  /**
   * Create a new worker instance
   */
  private createWorker(): Worker {
    try {
      // Try to create worker with module support
      return new Worker(
        new URL("./workers/taglib-worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (error) {
      // Fallback for environments without module worker support
      throw new WorkerError(
        `Failed to create worker: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Execute a task in the worker pool
   */
  private async execute<T>(task: WorkerTask): Promise<T> {
    if (this.terminated) {
      throw new WorkerError("Worker pool has been terminated");
    }

    // Wait for initialization
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = { task, resolve, reject };

      // Set operation timeout
      if (this.operationTimeout > 0) {
        queuedTask.timeout = setTimeout(() => {
          const index = this.queue.indexOf(queuedTask);
          if (index !== -1) {
            this.queue.splice(index, 1);
          }
          reject(new WorkerError("Operation timed out"));
        }, this.operationTimeout);
      }

      this.queue.push(queuedTask);
      this.processQueue();
    });
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.busy && w.initialized);
    if (!availableWorker) return;

    const task = this.queue.shift();
    if (!task) return;

    availableWorker.busy = true;

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === "result") {
        availableWorker.worker.removeEventListener("message", messageHandler);
        availableWorker.busy = false;

        if (task.timeout) clearTimeout(task.timeout);

        task.resolve(e.data.result);
        this.processQueue();
      } else if (e.data.type === "error") {
        availableWorker.worker.removeEventListener("message", messageHandler);
        availableWorker.busy = false;

        if (task.timeout) clearTimeout(task.timeout);

        task.reject(new WorkerError(e.data.error));
        this.processQueue();
      }
    };

    availableWorker.worker.addEventListener("message", messageHandler);
    availableWorker.worker.postMessage(task.task);
  }

  /**
   * Simple API: Read tags from a file
   */
  async readTags(file: string | Uint8Array): Promise<Tag> {
    return this.execute<Tag>({ op: "readTags", file });
  }

  /**
   * Simple API: Read tags from multiple files
   */
  async readTagsBatch(files: (string | Uint8Array)[]): Promise<Tag[]> {
    return Promise.all(files.map((file) => this.readTags(file)));
  }

  /**
   * Simple API: Read audio properties
   */
  async readProperties(
    file: string | Uint8Array,
  ): Promise<AudioProperties | null> {
    return this.execute<AudioProperties | null>({ op: "readProperties", file });
  }

  /**
   * Simple API: Apply tags and return modified buffer
   */
  async applyTags(
    file: string | Uint8Array,
    tags: Partial<Tag>,
  ): Promise<Uint8Array> {
    return this.execute<Uint8Array>({ op: "applyTags", file, tags });
  }

  /**
   * Simple API: Update tags on disk
   */
  async updateTags(file: string, tags: Partial<Tag>): Promise<void> {
    return this.execute<void>({ op: "updateTags", file, tags });
  }

  /**
   * Simple API: Read pictures
   */
  async readPictures(file: string | Uint8Array): Promise<Picture[]> {
    return this.execute<Picture[]>({ op: "readPictures", file });
  }

  /**
   * Simple API: Set cover art
   */
  async setCoverArt(
    file: string | Uint8Array,
    coverArt: Uint8Array,
    mimeType?: string,
  ): Promise<Uint8Array> {
    return this.execute<Uint8Array>({
      op: "setCoverArt",
      file,
      coverArt,
      mimeType,
    });
  }

  /**
   * Full API: Execute batch operations
   */
  async batchOperations(
    file: string | Uint8Array,
    operations: BatchOperation[],
  ): Promise<any> {
    return this.execute({ op: "batch", file, operations });
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    poolSize: number;
    busyWorkers: number;
    queueLength: number;
    initialized: boolean;
  } {
    return {
      poolSize: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queueLength: this.queue.length,
      initialized: this.workers.every((w) => w.initialized),
    };
  }

  /**
   * Terminate all workers and clean up resources
   */
  terminate(): void {
    this.terminated = true;

    // Clear queue
    this.queue.forEach((task) => {
      if (task.timeout) clearTimeout(task.timeout);
      task.reject(new WorkerError("Worker pool terminated"));
    });
    this.queue = [];

    // Terminate workers and clear any initialization timeouts
    this.workers.forEach((workerState) => {
      if (workerState.initTimeout) {
        clearTimeout(workerState.initTimeout);
      }
      workerState.worker.terminate();
    });
    this.workers = [];

    if (this.debug) console.log("Worker pool terminated");
  }
}

/**
 * Global worker pool instance for convenience
 */
let globalPool: TagLibWorkerPool | null = null;

/**
 * Get or create a global worker pool instance
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
