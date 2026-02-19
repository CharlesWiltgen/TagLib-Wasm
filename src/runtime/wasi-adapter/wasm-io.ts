/**
 * @fileoverview Wasm I/O operations for WASI tag reading and writing
 *
 * Pure functions that handle the low-level Wasm memory allocation
 * and TagLib C API calls for reading and writing audio metadata.
 */

import type { WasiModule } from "../wasmer-sdk-loader/index.ts";
import {
  WasmArena,
  type WasmExports,
  WasmMemoryError,
} from "../wasi-memory.ts";
import { encodeTagData } from "../../msgpack/encoder.ts";
import type { ExtendedTag } from "../../types.ts";

export function readTagsFromWasm(
  wasi: WasiModule,
  buffer: Uint8Array,
): Uint8Array {
  using arena = new WasmArena(wasi as WasmExports);

  const inputBuf = arena.allocBuffer(buffer);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );

  if (resultPtr === 0) {
    const errorCode = wasi.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}. Buffer size: ${buffer.length} bytes`,
      "read tags",
      errorCode,
    );
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  const result = new Uint8Array(u8.slice(resultPtr, resultPtr + outSize));
  wasi.free(resultPtr);
  return result;
}

export function writeTagsToWasm(
  wasi: WasiModule,
  fileData: Uint8Array,
  tagData: ExtendedTag,
): Uint8Array | null {
  using arena = new WasmArena(wasi as WasmExports);

  const tagBytes = encodeTagData(tagData);
  const inputBuf = arena.allocBuffer(fileData);
  const tagBuf = arena.allocBuffer(tagBytes);
  const outSizePtr = arena.allocUint32();

  const result = wasi.tl_write_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    tagBuf.ptr,
    tagBuf.size,
    0,
    outSizePtr.ptr,
  );

  // Buffer-to-buffer write is not supported by the C API (TL_ERROR_NOT_IMPLEMENTED).
  // Path-based writes use writeTagsWasi() from wasi-test-helpers instead.
  return null;
}
