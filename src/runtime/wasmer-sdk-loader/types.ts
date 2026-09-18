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
  tl_read_id3v2_frames(
    pathPtr: number,
    bufPtr: number,
    len: number,
    idPtr: number,
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

  /**
   * The boundary's content detector (`src/capi/taglib_boundary.c`), the one the
   * buffer open runs before it picks a file class: a `tl_format` value, or
   * `TL_FORMAT_AUTO` (0) when the bytes are not a container it knows.
   */
  tl_detect_format(bufPtr: number, len: number): number;

  /**
   * The host path behind a WASI path, resolved through the preopens this host
   * was created with, or undefined when no preopen covers it. Host-side code
   * cannot otherwise read a file the guest reads (`utils/path.ts` carries the
   * rule); the path content gate is the only caller.
   */
  hostPathFor(wasiPath: string): string | undefined;

  // Error handling (returns pointer to error string)
  tl_get_last_error(): number;
  tl_get_last_error_code(): number;
  tl_clear_error(): void;

  // Memory access
  memory: WebAssembly.Memory;
}
