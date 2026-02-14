/**
 * @fileoverview Error types and interfaces for Wasmer SDK loader
 */

// Branded error types for proper error handling
export class WasmerInitError extends Error {
  readonly code = "WASMER_INIT_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerInitError";
  }
}

export class WasmerLoadError extends Error {
  readonly code = "WASMER_LOAD_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerLoadError";
  }
}

export class WasmerExecutionError extends Error {
  readonly code = "WASMER_EXECUTION_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerExecutionError";
  }
}

/**
 * WASI module interface matching our C API exports
 */
export interface WasiModule {
  // Core metadata functions
  tl_version(): string;
  tl_api_version(): number;

  // Memory management
  malloc(size: number): number;
  free(ptr: number): void;

  // MessagePack API
  tl_read_tags(
    pathPtr: number,
    bufPtr: number,
    len: number,
    outSizePtr: number,
  ): number;
  tl_write_tags(
    pathPtr: number,
    bufPtr: number,
    len: number,
    tagsPtr: number,
    tagsSize: number,
    outBufPtr: number,
    outSizePtr: number,
  ): number;

  // Error handling (returns pointer to error string)
  tl_get_last_error(): number;
  tl_get_last_error_code(): number;
  tl_clear_error(): void;

  // Memory access
  memory: WebAssembly.Memory;
}

/**
 * Configuration for Wasmer SDK loader
 */
export interface WasmerLoaderConfig {
  /** Path to WASI WASM binary */
  wasmPath?: string;
  /** Use inline WASM for bundling */
  useInlineWasm?: boolean;
  /** Initial file system mounts */
  mounts?: Record<string, unknown>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Arguments to pass to WASI module */
  args?: string[];
  /** Enable debug output */
  debug?: boolean;
}
