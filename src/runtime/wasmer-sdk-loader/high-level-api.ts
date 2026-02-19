/**
 * @fileoverview High-level API for reading tags using WASI
 */

import {
  WasmArena,
  type WasmExports,
  WasmMemoryError,
} from "../wasi-memory.ts";
import type { WasiModule } from "./types.ts";

/**
 * High-level API for reading tags from audio files using WASI
 * Uses RAII pattern with automatic memory cleanup
 */
export function readTagsWithWasi(
  audioBuffer: Uint8Array,
  wasiModule: WasiModule,
): Uint8Array {
  using arena = new WasmArena(wasiModule as WasmExports);

  const inputBuf = arena.allocBuffer(audioBuffer);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasiModule.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );

  if (resultPtr === 0) {
    const errorCode = wasiModule.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}. Buffer size: ${audioBuffer.length} bytes`,
      "read tags",
      errorCode,
    );
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasiModule.memory.buffer);
  const result = new Uint8Array(u8.slice(resultPtr, resultPtr + outSize));
  wasiModule.free(resultPtr);
  return result;
}
