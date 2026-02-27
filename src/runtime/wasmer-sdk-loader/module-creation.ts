/**
 * @fileoverview WASI module creation and interface wrapping
 */

import { heapViews } from "../wasi-memory.ts";
import type { WasiModule } from "./types.ts";
import { validateWasiExports } from "./wasi-stubs.ts";

/**
 * Create memory utilities for WASI operations
 */
function createMemoryUtils(memory: WebAssembly.Memory) {
  const views = heapViews(memory);

  return {
    readCString: (ptr: number): string => {
      if (!ptr) return "";
      let end = ptr;
      while (views.u8[end] !== 0) end++;
      return new TextDecoder().decode(views.u8.slice(ptr, end));
    },

    writeCString: (str: string, ptr: number): void => {
      const bytes = new TextEncoder().encode(str);
      views.u8.set(bytes, ptr);
      views.u8[ptr + bytes.length] = 0; // Null terminator
    },
  };
}

/**
 * Create WasiModule interface from WebAssembly instance
 */
export function createWasiModule(
  instance: WebAssembly.Instance,
  debug: boolean,
): WasiModule {
  const exports = instance.exports;
  validateWasiExports(exports);

  const memory = exports.memory as WebAssembly.Memory;
  const memUtils = createMemoryUtils(memory);

  if (debug) {
    console.log(
      "[WasmerSDK] WASI module loaded with exports:",
      Object.keys(exports),
    );
  }

  return createWasiInterface(exports, memory, memUtils);
}

/**
 * Create the actual WasiModule interface object
 */
function createWasiInterface(
  exports: WebAssembly.Exports,
  memory: WebAssembly.Memory,
  memUtils: ReturnType<typeof createMemoryUtils>,
): WasiModule {
  return {
    // Core metadata
    tl_version: () => {
      const ptr = (exports.tl_version as () => number)();
      return memUtils.readCString(ptr);
    },

    tl_api_version: () => {
      return exports.tl_api_version
        ? (exports.tl_api_version as () => number)()
        : 100; // Default API version
    },

    // Memory management
    malloc: (size: number) =>
      (exports.tl_malloc as (size: number) => number)(size),
    free: (ptr: number) => (exports.tl_free as (ptr: number) => void)(ptr),

    // MessagePack API
    tl_read_tags: (pathPtr, bufPtr, len, outSizePtr) =>
      (exports.tl_read_tags as (
        flag: number,
        input: number,
        inputSize: number,
        output: number,
      ) => number)(
        pathPtr,
        bufPtr,
        len,
        outSizePtr,
      ),

    tl_write_tags: (
      pathPtr,
      bufPtr,
      len,
      tagsPtr,
      tagsSize,
      outBufPtr,
      outSizePtr,
    ) =>
      (exports.tl_write_tags as (
        flag: number,
        input: number,
        inputSize: number,
        tags: number,
        tagSize: number,
        output: number,
        outSize: number,
      ) => number)(
        pathPtr,
        bufPtr,
        len,
        tagsPtr,
        tagsSize,
        outBufPtr,
        outSizePtr,
      ),

    // Error handling
    tl_get_last_error: () => (exports.tl_get_last_error as () => number)(),
    tl_get_last_error_code: () =>
      (exports.tl_get_last_error_code as () => number)(),
    tl_clear_error: () => (exports.tl_clear_error as () => void)(),

    // Memory access
    memory,
  };
}
