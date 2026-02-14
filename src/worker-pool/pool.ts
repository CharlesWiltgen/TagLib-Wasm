/**
 * @fileoverview TagLibWorkerPool class implementation
 */

import type { AudioProperties, Picture, Tag } from "../types.ts";
import { WorkerError } from "../errors.ts";
import type {
  BatchOperation,
  QueuedTask,
  WorkerPoolOptions,
  WorkerState,
  WorkerTask,
} from "./types.ts";

/**
 * TagLib Worker Pool for parallel audio file processing
 *
 * @example
 * ```typescript
 * // Create and initialize a worker pool
 * const pool = await createWorkerPool({ size: 4 });
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
  private initPromise?: Promise<void>;
  private waitForReadyTimer?: ReturnType<typeof setTimeout>;
  private initialized = false;

  private readonly size: number;
  private readonly debug: boolean;
  private readonly initTimeout: number;
  private readonly operationTimeout: number;

  /**
   * Create a new worker pool instance.
   * Note: Call initialize() before using the pool.
   * @param options Worker pool configuration
   */
  constructor(options: WorkerPoolOptions = {}) {
    this.size = options.size ??
      (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) ??
      4;
    this.debug = options.debug ?? false;
    this.initTimeout = options.initTimeout ?? 30000;
    this.operationTimeout = options.operationTimeout ?? 60000;
  }

  /**
   * Initialize the worker pool. Must be called before using the pool.
   * @returns Promise that resolves when all workers are initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return this.initPromise;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeWorkers();
    await this.initPromise;
    this.initialized = true;
    return this.initPromise;
  }

  /**
   * Wait for the worker pool to be ready
   */
  async waitForReady(): Promise<void> {
    if (!this.initPromise) {
      await this.initialize();
    }
    await this.initPromise!;

    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      if (this.workers.every((w) => w.initialized)) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.waitForReadyTimer = setTimeout(() => {
          this.waitForReadyTimer = undefined;
          resolve();
        }, 100);
      });

      if (this.terminated) {
        throw new WorkerError("Worker pool terminated during initialization");
      }
    }

    const initializedCount = this.workers.filter((w) => w.initialized).length;
    throw new WorkerError(
      `Worker pool initialization timeout: ${initializedCount}/${this.workers.length} workers initialized`,
    );
  }

  private async initializeWorkers(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.size; i++) {
      const workerState: WorkerState = {
        worker: this.createWorker(),
        busy: false,
        initialized: false,
      };

      this.workers.push(workerState);

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

        workerState.worker.postMessage({ op: "init" });
      });

      initPromises.push(initPromise);
    }

    await Promise.all(initPromises);
  }

  private createWorker(): Worker {
    try {
      return new Worker(
        new URL("../workers/taglib-worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (error) {
      throw new WorkerError(
        `Failed to create worker: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async execute<T>(task: WorkerTask): Promise<T> {
    if (this.terminated) {
      throw new WorkerError("Worker pool has been terminated");
    }

    if (!this.initialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = { task, resolve, reject };

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

  async readTags(file: string | Uint8Array): Promise<Tag> {
    return this.execute<Tag>({ op: "readTags", file });
  }

  async readTagsBatch(files: (string | Uint8Array)[]): Promise<Tag[]> {
    return Promise.all(files.map((file) => this.readTags(file)));
  }

  async readProperties(
    file: string | Uint8Array,
  ): Promise<AudioProperties | null> {
    return this.execute<AudioProperties | null>({ op: "readProperties", file });
  }

  async applyTags(
    file: string | Uint8Array,
    tags: Partial<Tag>,
  ): Promise<Uint8Array> {
    return this.execute<Uint8Array>({ op: "applyTags", file, tags });
  }

  async updateTags(file: string, tags: Partial<Tag>): Promise<void> {
    return this.execute<void>({ op: "updateTags", file, tags });
  }

  async readPictures(file: string | Uint8Array): Promise<Picture[]> {
    return this.execute<Picture[]>({ op: "readPictures", file });
  }

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

  async batchOperations(
    file: string | Uint8Array,
    operations: BatchOperation[],
  ): Promise<any> {
    return this.execute({ op: "batch", file, operations });
  }

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

  terminate(): void {
    this.terminated = true;

    if (this.waitForReadyTimer) {
      clearTimeout(this.waitForReadyTimer);
      this.waitForReadyTimer = undefined;
    }

    this.queue.forEach((task) => {
      if (task.timeout) clearTimeout(task.timeout);
      task.reject(new WorkerError("Worker pool terminated"));
    });
    this.queue = [];

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
