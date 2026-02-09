/**
 * @fileoverview Tests for in-process WASI host filesystem access
 *
 * Tests that TagLib can read/write audio files via path using the WASI host
 * (real filesystem syscalls) instead of loading entire files into buffers.
 */

import {
  assertEquals,
  assertExists,
  assertGreater,
  assertRejects,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

async function wasmBinaryExists(): Promise<boolean> {
  try {
    await Deno.stat(WASM_PATH);
    return true;
  } catch {
    return false;
  }
}

describe("WASI Host - In-Process Filesystem", () => {
  it("should load wasi module with preopens", async () => {
    if (!(await wasmBinaryExists())) {
      console.log("Skipping: WASI binary not found");
      return;
    }

    const wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    assertExists(wasi);
    assertEquals(typeof wasi.tl_version(), "string");
    assertGreater(wasi.tl_version().length, 0);
  });

  it("should read tags from file path (FLAC)", async () => {
    if (!(await wasmBinaryExists())) {
      console.log("Skipping: WASI binary not found");
      return;
    }

    const wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    using arena = new WasmArena(wasi as WasmExports);
    const pathAlloc = arena.allocString("/test/flac/kiss-snippet.flac");
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(
      pathAlloc.ptr,
      0,
      0,
      outSizePtr.ptr,
    );

    assertGreater(resultPtr, 0, "tl_read_tags should return valid pointer");

    const outSize = outSizePtr.readUint32();
    assertGreater(outSize, 0, "Output should have non-zero size");

    const u8 = new Uint8Array(wasi.memory.buffer);
    const msgpackData = u8.slice(resultPtr, resultPtr + outSize);
    const tags = decodeTagData(new Uint8Array(msgpackData));

    assertExists(tags.title);
    assertEquals(tags.title, "Kiss");
  });

  it("should read tags from buffer (FLAC)", async () => {
    if (!(await wasmBinaryExists())) {
      console.log("Skipping: WASI binary not found");
      return;
    }

    const wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    const fileData = await Deno.readFile(
      resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
    );

    using arena = new WasmArena(wasi as WasmExports);
    const inputBuf = arena.allocBuffer(fileData);
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      outSizePtr.ptr,
    );

    assertGreater(resultPtr, 0, "Buffer read should return valid pointer");

    const outSize = outSizePtr.readUint32();
    const u8 = new Uint8Array(wasi.memory.buffer);
    const tags = decodeTagData(
      new Uint8Array(u8.slice(resultPtr, resultPtr + outSize)),
    );

    assertEquals(tags.title, "Kiss");
  });

  it("should return error for non-existent path", async () => {
    if (!(await wasmBinaryExists())) {
      console.log("Skipping: WASI binary not found");
      return;
    }

    const wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    using arena = new WasmArena(wasi as WasmExports);
    const pathAlloc = arena.allocString("/test/nonexistent.mp3");
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(
      pathAlloc.ptr,
      0,
      0,
      outSizePtr.ptr,
    );

    assertEquals(resultPtr, 0, "Should return NULL for missing file");
  });

  it("should reject paths outside preopens", async () => {
    if (!(await wasmBinaryExists())) {
      console.log("Skipping: WASI binary not found");
      return;
    }

    const wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    using arena = new WasmArena(wasi as WasmExports);
    // Absolute path not in preopens
    const pathAlloc = arena.allocString("/etc/passwd");
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(
      pathAlloc.ptr,
      0,
      0,
      outSizePtr.ptr,
    );

    assertEquals(resultPtr, 0, "Should reject paths outside preopens");
  });

  it("should throw for invalid wasm path", async () => {
    await assertRejects(
      () =>
        loadWasiHost({
          wasmPath: "/nonexistent/taglib.wasm",
          preopens: {},
        }),
      Error,
    );
  });
});
