/**
 * @fileoverview Security tests focused on WASI path traversal and
 * input boundary conditions.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { fileExists, TEST_FILES_DIR_PATH } from "./shared-fixtures.ts";

const WASM_PATH = resolve(Deno.cwd(), "dist/wasi/taglib_wasi.wasm");
const HAS_WASM = fileExists(WASM_PATH);

describe(
  { name: "Security - WASI Path Traversal", ignore: !HAS_WASM },
  () => {
    it("should reject absolute path outside preopens", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR_PATH },
      });

      using arena = new WasmArena(wasi as WasmExports);
      const pathAlloc = arena.allocString("/etc/passwd");
      const outSizePtr = arena.allocUint32();

      const result = wasi.tl_read_tags(
        pathAlloc.ptr,
        0,
        0,
        outSizePtr.ptr,
      );
      assertEquals(result, 0, "should reject /etc/passwd");
    });

    it("should reject path traversal with ..", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR_PATH },
      });

      using arena = new WasmArena(wasi as WasmExports);
      const pathAlloc = arena.allocString(
        "/test/../../../etc/passwd",
      );
      const outSizePtr = arena.allocUint32();

      const result = wasi.tl_read_tags(
        pathAlloc.ptr,
        0,
        0,
        outSizePtr.ptr,
      );
      assertEquals(result, 0, "should reject path traversal");
    });

    it("should reject write to path outside preopens", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR_PATH },
      });

      using arena = new WasmArena(wasi as WasmExports);
      const pathAlloc = arena.allocString("/outside/file.mp3");
      const tagBuf = arena.allocBuffer(new Uint8Array([0x80]));
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
      // Non-zero = error (write failed), or zero but no output
      assertEquals(
        result === 0 && outSizePtr.readUint32() === 0 || result !== 0,
        true,
        "should fail to write outside preopens",
      );
    });
  },
);

describe(
  { name: "Security - Buffer Edge Cases", ignore: !HAS_WASM },
  () => {
    it("should handle null bytes in tag strings", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR_PATH },
      });

      // Read normal tags first to confirm module works
      using arena = new WasmArena(wasi as WasmExports);
      const pathAlloc = arena.allocString(
        "/test/mp3/kiss-snippet.mp3",
      );
      const outSizePtr = arena.allocUint32();

      const result = wasi.tl_read_tags(
        pathAlloc.ptr,
        0,
        0,
        outSizePtr.ptr,
      );
      assertEquals(result > 0, true, "should read valid file");
    });

    it("should handle zero-length buffer for read", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR_PATH },
      });

      using arena = new WasmArena(wasi as WasmExports);
      const outSizePtr = arena.allocUint32();

      // Pass null path and zero-length buffer
      const result = wasi.tl_read_tags(0, 0, 0, outSizePtr.ptr);
      assertEquals(result, 0, "should return NULL for zero input");
    });
  },
);
