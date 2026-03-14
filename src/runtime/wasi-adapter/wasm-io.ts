/**
 * @fileoverview Wasm I/O operations for WASI tag reading and writing
 *
 * Pure functions that handle the low-level Wasm memory allocation
 * and TagLib C API calls for reading and writing audio metadata.
 */

import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import {
  WasmArena,
  type WasmExports,
  WasmMemoryError,
} from "../wasi-memory.ts";
import { InvalidFormatError } from "../../errors/classes.ts";
import { encodeTagData } from "../../msgpack/encoder.ts";
import type { ExtendedTag } from "../../types.ts";

const TL_ERROR_UNSUPPORTED_FORMAT = -2;
const TL_ERROR_PARSE_FAILED = -6;

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
    if (
      errorCode === TL_ERROR_UNSUPPORTED_FORMAT ||
      errorCode === TL_ERROR_PARSE_FAILED
    ) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
        buffer.length,
      );
    }
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

export function readTagsFromWasmPath(
  wasi: WasiModule,
  path: string,
): Uint8Array {
  using arena = new WasmArena(wasi as WasmExports);

  const pathAlloc = arena.allocString(path);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(pathAlloc.ptr, 0, 0, outSizePtr.ptr);

  if (resultPtr === 0) {
    const errorCode = wasi.tl_get_last_error_code();
    if (
      errorCode === TL_ERROR_UNSUPPORTED_FORMAT ||
      errorCode === TL_ERROR_PARSE_FAILED
    ) {
      throw new InvalidFormatError(
        `File may be corrupted or in an unsupported format. Path: ${path}`,
      );
    }
    throw new WasmMemoryError(
      `error code ${errorCode}. Path: ${path}`,
      "read tags from path",
      errorCode,
    );
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  const result = new Uint8Array(u8.slice(resultPtr, resultPtr + outSize));
  wasi.free(resultPtr);
  return result;
}

export function writeTagsToWasmPath(
  wasi: WasiModule,
  path: string,
  tagData: ExtendedTag,
): boolean {
  using arena = new WasmArena(wasi as WasmExports);

  const pathAlloc = arena.allocString(path);
  const tagBytes = encodeTagData(tagData);
  const tagBuf = arena.allocBuffer(tagBytes);
  const outSizePtr = arena.allocUint32();

  const result = wasi.tl_write_tags(
    pathAlloc.ptr,
    0,
    0,
    tagBuf.ptr,
    tagBuf.size,
    0,
    outSizePtr.ptr,
  );

  if (result !== 0) {
    const errorCode = wasi.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}. Path: ${path}`,
      "write tags to path",
      errorCode,
    );
  }
  return true;
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
  const outBufPtr = arena.allocUint32();
  const outSizePtr = arena.allocUint32();

  const result = wasi.tl_write_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    tagBuf.ptr,
    tagBuf.size,
    outBufPtr.ptr,
    outSizePtr.ptr,
  );

  if (result === 0) {
    const bufferPtr = outBufPtr.readUint32();
    const size = outSizePtr.readUint32();
    if (bufferPtr && size > 0) {
      const u8 = new Uint8Array(wasi.memory.buffer);
      const output = new Uint8Array(u8.slice(bufferPtr, bufferPtr + size));
      wasi.free(bufferPtr);
      return output;
    }
  }
  return null;
}
