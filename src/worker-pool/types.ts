/**
 * @fileoverview Type definitions for the worker pool module
 */

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
  | {
    op: "applyTags";
    file: string | Uint8Array;
    tags: Partial<import("../types.ts").Tag>;
  }
  | { op: "updateTags"; file: string; tags: Partial<import("../types.ts").Tag> }
  | { op: "readPictures"; file: string | Uint8Array }
  | {
    op: "setCoverArt";
    file: string | Uint8Array;
    coverArt: Uint8Array;
    mimeType?: string;
  }
  | {
    op: "batch";
    file: string | Uint8Array;
    operations: BatchOperation[];
  };

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
export interface QueuedTask {
  task: WorkerTask;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

/**
 * Worker state tracking
 */
export interface WorkerState {
  worker: Worker;
  busy: boolean;
  initialized: boolean;
  initTimeout?: ReturnType<typeof setTimeout>;
}
