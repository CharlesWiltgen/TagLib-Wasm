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
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";
import { encodeTagData } from "../src/msgpack/encoder.ts";
import type { ExtendedTag } from "../src/types.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

function wasmBinaryExists(): boolean {
  try {
    Deno.statSync(WASM_PATH);
    return true;
  } catch {
    return false;
  }
}

const HAS_WASM = wasmBinaryExists();

describe(
  { name: "WASI Host - In-Process Filesystem", ignore: !HAS_WASM },
  () => {
    it("should load wasi module with preopens", async () => {
      const wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      assertExists(wasi);
      assertEquals(typeof wasi.tl_version(), "string");
      assertGreater(wasi.tl_version().length, 0);
    });

    it("should read tags from file path (FLAC)", async () => {
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

    it("should produce same tags from path and buffer reads", async () => {
      const wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const flacPath = "/test/flac/kiss-snippet.flac";
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
      );

      using arena = new WasmArena(wasi as WasmExports);

      // Read via path
      const pathAlloc = arena.allocString(flacPath);
      const pathOutSize = arena.allocUint32();
      const pathResult = wasi.tl_read_tags(
        pathAlloc.ptr,
        0,
        0,
        pathOutSize.ptr,
      );
      assertGreater(pathResult, 0);
      const pathSize = pathOutSize.readUint32();
      const pathTags = decodeTagData(
        new Uint8Array(
          new Uint8Array(wasi.memory.buffer).slice(
            pathResult,
            pathResult + pathSize,
          ),
        ),
      );

      // Read via buffer
      const bufAlloc = arena.allocBuffer(fileData);
      const bufOutSize = arena.allocUint32();
      const bufResult = wasi.tl_read_tags(
        0,
        bufAlloc.ptr,
        bufAlloc.size,
        bufOutSize.ptr,
      );
      assertGreater(bufResult, 0);
      const bufSize = bufOutSize.readUint32();
      const bufTags = decodeTagData(
        new Uint8Array(
          new Uint8Array(wasi.memory.buffer).slice(
            bufResult,
            bufResult + bufSize,
          ),
        ),
      );

      assertEquals(pathTags.title, bufTags.title);
      assertEquals(pathTags.artist, bufTags.artist);
      assertEquals(pathTags.album, bufTags.album);
      assertEquals(pathTags.year, bufTags.year);
    });

    it("should return error for non-existent path", async () => {
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
      const wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      using arena = new WasmArena(wasi as WasmExports);
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

    // write_to_path uses TagLib::FileRef which triggers call_indirect type
    // mismatch in the current Wasm binary (same root cause as MP3 parsing).
    // This test documents the known crash until FileRef virtual dispatch is fixed.
    it("should crash on write via path (FileRef call_indirect issue)", async () => {
      const wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      // Copy test file to temp dir so we don't modify the original
      const tempDir = await Deno.makeTempDir();
      const srcPath = resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac");
      const destPath = resolve(tempDir, "test-write.flac");
      await Deno.copyFile(srcPath, destPath);

      try {
        const wasiWithTemp = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        using arena = new WasmArena(wasiWithTemp as WasmExports);
        const pathAlloc = arena.allocString("/tmp/test-write.flac");
        const tags: ExtendedTag = { title: "New Title" };
        const tagBytes = encodeTagData(tags);
        const tagBuf = arena.allocBuffer(tagBytes);
        const outSizePtr = arena.allocUint32();

        assertThrows(
          () => {
            wasiWithTemp.tl_write_tags(
              pathAlloc.ptr,
              0,
              0,
              tagBuf.ptr,
              tagBuf.size,
              0,
              outSizePtr.ptr,
            );
          },
          // FileRef virtual dispatch causes Wasm trap
          Error,
          "function signature mismatch",
        );
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
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
  },
);
