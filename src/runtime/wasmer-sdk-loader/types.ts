/**
 * @fileoverview Error types and interfaces for Wasmer SDK loader
 */

import { TagLibError } from "../../errors/base.ts";

export class WasmerInitError extends TagLibError {
  constructor(message: string, cause?: unknown) {
    super("MODULE_LOAD", message, cause ? { cause } : undefined);
    this.name = "WasmerInitError";
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, WasmerInitError.prototype);
  }
}

export class WasmerLoadError extends TagLibError {
  constructor(message: string, cause?: unknown) {
    super("MODULE_LOAD", message, cause ? { cause } : undefined);
    this.name = "WasmerLoadError";
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, WasmerLoadError.prototype);
  }
}

export class WasmerExecutionError extends TagLibError {
  constructor(message: string, cause?: unknown) {
    super("WASM_MEMORY", message, cause ? { cause } : undefined);
    this.name = "WasmerExecutionError";
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, WasmerExecutionError.prototype);
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
