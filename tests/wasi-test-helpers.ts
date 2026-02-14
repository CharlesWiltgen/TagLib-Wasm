/**
 * @fileoverview Shared helpers for WASI host tests and benchmarks.
 */

import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";
import { encodeTagData } from "../src/msgpack/encoder.ts";
import type { WasiModule } from "../src/runtime/wasmer-sdk-loader/index.ts";
import type { ExtendedTag } from "../src/types.ts";

export const FORMAT_FILES: Record<string, { virtual: string; real: string }> = {
  FLAC: {
    virtual: "/test/flac/kiss-snippet.flac",
    real: "flac/kiss-snippet.flac",
  },
  MP3: {
    virtual: "/test/mp3/kiss-snippet.mp3",
    real: "mp3/kiss-snippet.mp3",
  },
  WAV: {
    virtual: "/test/wav/kiss-snippet.wav",
    real: "wav/kiss-snippet.wav",
  },
  M4A: {
    virtual: "/test/mp4/kiss-snippet.m4a",
    real: "mp4/kiss-snippet.m4a",
  },
  OGG: {
    virtual: "/test/ogg/kiss-snippet.ogg",
    real: "ogg/kiss-snippet.ogg",
  },
};

export function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

function readCString(memory: WebAssembly.Memory, ptr: number): string {
  if (!ptr) return "";
  const u8 = new Uint8Array(memory.buffer);
  let end = ptr;
  while (end < u8.length && u8[end] !== 0) end++;
  return new TextDecoder().decode(u8.slice(ptr, end));
}

export function readTagsViaPath(
  wasi: WasiModule,
  virtualPath: string,
): ReturnType<typeof decodeTagData> {
  using arena = new WasmArena(wasi as WasmExports);
  const pathAlloc = arena.allocString(virtualPath);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(pathAlloc.ptr, 0, 0, outSizePtr.ptr);
  if (resultPtr === 0) {
    const errPtr = wasi.tl_get_last_error();
    const errMsg = readCString(wasi.memory, errPtr);
    throw new Error(`tl_read_tags failed for ${virtualPath}: ${errMsg}`);
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  return decodeTagData(
    new Uint8Array(u8.slice(resultPtr, resultPtr + outSize)),
  );
}

export function readTagsViaBuffer(
  wasi: WasiModule,
  fileData: Uint8Array,
): ReturnType<typeof decodeTagData> {
  using arena = new WasmArena(wasi as WasmExports);
  const inputBuf = arena.allocBuffer(fileData);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );
  if (resultPtr === 0) {
    const errPtr = wasi.tl_get_last_error();
    const errMsg = readCString(wasi.memory, errPtr);
    throw new Error(`tl_read_tags (buffer) failed: ${errMsg}`);
  }

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  return decodeTagData(
    new Uint8Array(u8.slice(resultPtr, resultPtr + outSize)),
  );
}

export function writeTagsWasi(
  wasi: WasiModule,
  virtualPath: string,
  tags: ExtendedTag,
): void {
  using arena = new WasmArena(wasi as WasmExports);
  const pathAlloc = arena.allocString(virtualPath);
  const tagBytes = encodeTagData(tags);
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
    const errPtr = wasi.tl_get_last_error();
    const errMsg = readCString(wasi.memory, errPtr);
    throw new Error(`tl_write_tags failed for ${virtualPath}: ${errMsg}`);
  }
}
