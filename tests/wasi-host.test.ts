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
import { encodeTagData } from "../src/msgpack/encoder.ts";
import type { WasiModule } from "../src/runtime/wasmer-sdk-loader.ts";
import type { ExtendedTag } from "../src/types.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

const FORMAT_FILES: Record<string, { virtual: string; real: string }> = {
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

function readCString(memory: WebAssembly.Memory, ptr: number): string {
  if (!ptr) return "";
  const u8 = new Uint8Array(memory.buffer);
  let end = ptr;
  while (end < u8.length && u8[end] !== 0) end++;
  return new TextDecoder().decode(u8.slice(ptr, end));
}

function readTagsViaPath(
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

function readTagsViaBuffer(
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
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      assertExists(wasi);
      assertEquals(typeof wasi.tl_version(), "string");
      assertGreater(wasi.tl_version().length, 0);
    });

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`should read tags from file path (${format})`, async () => {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/test": TEST_FILES_DIR },
        });

        const tags = readTagsViaPath(wasi, paths.virtual);
        assertExists(tags.title, `${format}: title should exist`);
        assertEquals(tags.title, "Kiss");
      });

      it(`should read tags from buffer (${format})`, async () => {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/test": TEST_FILES_DIR },
        });

        const fileData = await Deno.readFile(
          resolve(TEST_FILES_DIR, paths.real),
        );
        const tags = readTagsViaBuffer(wasi, fileData);
        assertEquals(tags.title, "Kiss");
      });

      it(`should produce same tags from path and buffer (${format})`, async () => {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/test": TEST_FILES_DIR },
        });

        const fileData = await Deno.readFile(
          resolve(TEST_FILES_DIR, paths.real),
        );
        const pathTags = readTagsViaPath(wasi, paths.virtual);
        const bufTags = readTagsViaBuffer(wasi, fileData);

        assertEquals(pathTags.title, bufTags.title);
        assertEquals(pathTags.artist, bufTags.artist);
        assertEquals(pathTags.album, bufTags.album);
        assertEquals(pathTags.year, bufTags.year);
      });
    }

    it("should return error for non-existent path", async () => {
      using wasi = await loadWasiHost({
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
      using wasi = await loadWasiHost({
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

    it("should write tags via path and read them back", async () => {
      const tempDir = await Deno.makeTempDir();
      const srcPath = resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac");
      const destPath = resolve(tempDir, "test-write.flac");
      await Deno.copyFile(srcPath, destPath);

      try {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        // Write new tags
        {
          using arena = new WasmArena(wasi as WasmExports);
          const pathAlloc = arena.allocString("/tmp/test-write.flac");
          const tags: ExtendedTag = { title: "New Title" };
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
          assertEquals(result, 0, "Write should succeed (return 0)");
        }

        // Re-instantiate to read back (fresh file handles)
        using wasi2 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        // Read tags back and verify
        {
          using arena = new WasmArena(wasi2 as WasmExports);
          const pathAlloc = arena.allocString("/tmp/test-write.flac");
          const outSizePtr = arena.allocUint32();

          const resultPtr = wasi2.tl_read_tags(
            pathAlloc.ptr,
            0,
            0,
            outSizePtr.ptr,
          );
          assertGreater(resultPtr, 0, "Read-back should return valid pointer");

          const outSize = outSizePtr.readUint32();
          const u8 = new Uint8Array(wasi2.memory.buffer);
          const readTags = decodeTagData(
            new Uint8Array(u8.slice(resultPtr, resultPtr + outSize)),
          );
          assertEquals(readTags.title, "New Title");
        }
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
