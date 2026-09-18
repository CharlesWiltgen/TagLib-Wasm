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
import {
  FileOperationError,
  InvalidFormatError,
  UnsupportedFormatError,
} from "../../errors/classes.ts";
import { encodeTagData } from "../../msgpack/encoder.ts";
import { decodeMessagePack } from "../../msgpack/decoder.ts";
import type { ExtendedTag } from "../../types.ts";
import type { RawId3v2Frame } from "../../wasm.ts";

// The C boundary's enum, mirrored (src/capi/core/taglib_core.h:19-27).
const TL_ERROR_INVALID_INPUT = -1;
const TL_ERROR_UNSUPPORTED_FORMAT = -2;
const TL_ERROR_MEMORY_ALLOCATION = -3;
const TL_ERROR_IO_READ = -4;
const TL_ERROR_IO_WRITE = -5;
const TL_ERROR_PARSE_FAILED = -6;

/**
 * The one code→class rule for a failing `tl_*` call, so a consumer's
 * `isInvalidFormatError` branch means the same thing whichever call failed —
 * and the same thing for a path as for a buffer of the same bytes.
 *
 * - `INVALID_INPUT`, `UNSUPPORTED_FORMAT`, `IO_READ` and `PARSE_FAILED` all say
 *   the *input* is not audio the library can open: a zero-length buffer, junk
 *   bytes, a corrupt file, a path that is not there. `IO_READ` reads as "could
 *   not open", and these read paths decide that from the content, never from the
 *   caller's reach — a path outside the WASI preopens fails the same way.
 * - `IO_WRITE` is the file refusing the write, which is a file operation.
 * - `MEMORY_ALLOCATION` is the only genuine memory failure. An unrecognised code
 *   (a module built against a different enum) keeps `WASM_MEMORY` rather than
 *   being folded into a format error.
 *
 * @param where - what the failure was observed on, as the message tail:
 *   `. Path: /x.mp3` or `. Buffer size: 1024 bytes`, empty when the caller has
 *   nothing to add.
 * @param bufferSize - the buffer form's size hint, which `InvalidFormatError`
 *   renders as its own detail.
 */
function throwForErrorCode(
  errorCode: number,
  operation: string,
  where: string,
  bufferSize?: number,
): never {
  switch (errorCode) {
    case TL_ERROR_INVALID_INPUT:
    case TL_ERROR_UNSUPPORTED_FORMAT:
    case TL_ERROR_IO_READ:
    case TL_ERROR_PARSE_FAILED:
      throw new InvalidFormatError(
        `File may be corrupted or in an unsupported format${where}`,
        bufferSize,
      );
    case TL_ERROR_IO_WRITE:
      throw new FileOperationError("write", `Failed to write tags${where}`);
    default:
      throw new WasmMemoryError(
        `error code ${errorCode}${where}`,
        operation,
        errorCode,
      );
  }
}

export function readTagsFromWasm(
  wasi: WasiModule,
  buffer: Uint8Array,
): Uint8Array {
  using arena = new WasmArena(wasi);

  const inputBuf = arena.allocBuffer(buffer);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );

  if (resultPtr === 0) {
    throwForErrorCode(
      wasi.tl_get_last_error_code(),
      "read tags",
      `. Buffer size: ${buffer.length} bytes`,
      buffer.length,
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
  using arena = new WasmArena(wasi);

  const pathAlloc = arena.allocString(path);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(pathAlloc.ptr, 0, 0, outSizePtr.ptr);

  if (resultPtr === 0) {
    throwForErrorCode(
      wasi.tl_get_last_error_code(),
      "read tags from path",
      `. Path: ${path}`,
    );
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  const result = new Uint8Array(u8.slice(resultPtr, resultPtr + outSize));
  wasi.free(resultPtr);
  return result;
}

export function readId3v2FramesFromWasm(
  wasi: WasiModule,
  source: Uint8Array | string,
  id?: string,
): RawId3v2Frame[] {
  using arena = new WasmArena(wasi);

  const idAlloc = id ? arena.allocString(id) : null;
  const outSizePtr = arena.allocUint32();

  let resultPtr: number;
  if (typeof source === "string") {
    const pathAlloc = arena.allocString(source);
    resultPtr = wasi.tl_read_id3v2_frames(
      pathAlloc.ptr,
      0,
      0,
      idAlloc?.ptr ?? 0,
      outSizePtr.ptr,
    );
  } else {
    const inputBuf = arena.allocBuffer(source);
    resultPtr = wasi.tl_read_id3v2_frames(
      0,
      inputBuf.ptr,
      inputBuf.size,
      idAlloc?.ptr ?? 0,
      outSizePtr.ptr,
    );
  }

  if (resultPtr === 0) {
    const errorCode = wasi.tl_get_last_error_code();
    if (errorCode === TL_ERROR_UNSUPPORTED_FORMAT) {
      throw new UnsupportedFormatError("non-MP3", ["MP3"], {
        operation: "readId3v2Frames",
      });
    }
    throwForErrorCode(errorCode, "read ID3v2 frames", "");
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  const bytes = new Uint8Array(u8.slice(resultPtr, resultPtr + outSize));
  wasi.free(resultPtr);
  return decodeMessagePack<RawId3v2Frame[]>(bytes);
}

export function writeTagsToWasmPath(
  wasi: WasiModule,
  path: string,
  tagData: ExtendedTag,
): boolean {
  using arena = new WasmArena(wasi);

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
    throwForErrorCode(
      wasi.tl_get_last_error_code(),
      "write tags to path",
      `. Path: ${path}`,
    );
  }
  return true;
}

export function writeTagsToWasm(
  wasi: WasiModule,
  fileData: Uint8Array,
  tagData: ExtendedTag,
): Uint8Array | null {
  using arena = new WasmArena(wasi);

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
