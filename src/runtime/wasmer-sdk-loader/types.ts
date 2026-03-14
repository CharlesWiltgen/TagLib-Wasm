/**
 * @fileoverview WASI module interface and error types
 */

import { TagLibError } from "../../errors/base.ts";

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
