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
export async function readTagsWithWasi(
  audioBuffer: Uint8Array,
  wasiModule: WasiModule,
): Promise<Uint8Array> {
  using arena = new WasmArena(wasiModule as WasmExports);

  // Allocate and copy input buffer
  const inputBuf = arena.allocBuffer(audioBuffer);
  const outSizePtr = arena.allocUint32();

  // Call WASI function to get required size
  const sizeResult = wasiModule.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );
  if (sizeResult !== 0) {
    const errorCode = wasiModule.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}`,
      "read tags size",
      errorCode,
    );
  }

  // Allocate output buffer and read data
  const outputSize = outSizePtr.readUint32();
  const outputBuf = arena.alloc(outputSize);

  const readResult = wasiModule.tl_read_tags(
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

  // Return copy of data (arena will dispose automatically)
  return new Uint8Array(outputBuf.read().slice());
}
