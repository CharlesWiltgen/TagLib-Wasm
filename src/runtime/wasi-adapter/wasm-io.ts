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

  const sizeResult = wasi.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );
  if (sizeResult !== 0) {
    const errorCode = wasi.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}`,
      "read tags size",
      errorCode,
    );
  }

  const outputSize = outSizePtr.readUint32();
  const outputBuf = arena.alloc(outputSize);

  const readResult = wasi.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outputBuf.ptr,
  );
  if (readResult !== 0) {
    throw new WasmMemoryError(
      "failed to read data into buffer",
      "read tags data",
      readResult,
    );
  }

  return new Uint8Array(outputBuf.read().slice());
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

  const sizeResult = wasi.tl_write_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    tagBuf.ptr,
    tagBuf.size,
    0,
    outSizePtr.ptr,
  );

  if (sizeResult !== 0) {
    return null;
  }

  const outputSize = outSizePtr.readUint32();
  const outputBuf = arena.alloc(outputSize);

  const writeResult = wasi.tl_write_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    tagBuf.ptr,
    tagBuf.size,
    outputBuf.ptr,
    outSizePtr.ptr,
  );

  if (writeResult === 0) {
    return new Uint8Array(outputBuf.read().slice());
  }

  return null;
}
