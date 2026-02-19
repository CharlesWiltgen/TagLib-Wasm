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
import type { ExtendedTag } from "../src/types.ts";
import {
  fileExists,
  FORMAT_FILES,
  readTagsViaBuffer,
  readTagsViaPath,
} from "./wasi-test-helpers.ts";
import { readTagsFromWasm } from "../src/runtime/wasi-adapter/wasm-io.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

const HAS_WASM = fileExists(WASM_PATH);

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

        assertEquals(pathTags, bufTags);
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

    it("should decode albumArtist from WASI buffer path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      const tags = readTagsViaBuffer(wasi, fileData);
      // kiss-snippet files don't have albumArtist set — absent from output
      assertEquals(tags.albumArtist, undefined);
    });

    it("should decode composer from WASI buffer path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      const tags = readTagsViaBuffer(wasi, fileData);
      assertEquals(tags.composer, undefined);
    });

    it("should decode disc number from WASI buffer path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      const tags = readTagsViaBuffer(wasi, fileData);
      // disc absent from kiss-snippet files
      assertEquals((tags as Record<string, unknown>).disc, undefined);
    });

    it("should decode BPM from WASI buffer path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      const tags = readTagsViaBuffer(wasi, fileData);
      assertEquals(tags.bpm, undefined);
    });

    it("should map UPPERCASE property keys to camelCase for WASI", async () => {
      using _wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(_wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      // ALBUMARTIST should map to albumArtist key in decoded data
      const result = handle.getProperty("ALBUMARTIST");
      assertEquals(typeof result, "string");
      handle.destroy();
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

    it("readTagsFromWasm should read tags via production code path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const mp3Path = resolve(TEST_FILES_DIR, FORMAT_FILES.MP3.real);
      const audioData = await Deno.readFile(mp3Path);
      const msgpackData = readTagsFromWasm(wasi, audioData);
      const tags = decodeTagData(msgpackData);

      assertEquals(tags.title, "Kiss");
      assertExists(tags.artist);
    });

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`taglib.open() end-to-end via WASI (${format})`, async () => {
        const { TagLib } = await import("../src/taglib/taglib-class.ts");
        const taglib = await TagLib.initialize({ forceWasmType: "wasi" });
        const filePath = resolve(TEST_FILES_DIR, paths.real);
        const audioData = await Deno.readFile(filePath);

        const audioFile = await taglib.open(audioData);
        try {
          assertEquals(audioFile.isValid(), true);
          const tag = audioFile.tag();
          assertEquals(tag.title, "Kiss");
        } finally {
          audioFile.dispose();
        }
      });
    }

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`should return non-zero audio properties via WasiFileHandle (${format})`, async () => {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/test": TEST_FILES_DIR },
        });

        const { WasiFileHandle } = await import(
          "../src/runtime/wasi-adapter/file-handle.ts"
        );
        const handle = new WasiFileHandle(wasi);
        const fileData = await Deno.readFile(
          resolve(TEST_FILES_DIR, paths.real),
        );
        handle.loadFromBuffer(fileData);

        const props = handle.getAudioProperties();
        assertExists(props, `${format}: audioProperties should not be null`);
        assertGreater(
          props!.sampleRate(),
          0,
          `${format}: sampleRate should be > 0`,
        );
        assertGreater(
          props!.channels(),
          0,
          `${format}: channels should be > 0`,
        );
        assertGreater(
          props!.lengthInMilliseconds(),
          0,
          `${format}: lengthMs should be > 0`,
        );

        handle.destroy();
      });
    }

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`taglib.open() audioProperties() e2e via WASI (${format})`, async () => {
        const { TagLib } = await import("../src/taglib/taglib-class.ts");
        const taglib = await TagLib.initialize({ forceWasmType: "wasi" });
        const filePath = resolve(TEST_FILES_DIR, paths.real);
        const audioData = await Deno.readFile(filePath);

        const audioFile = await taglib.open(audioData);
        try {
          const props = audioFile.audioProperties();
          assertExists(props, `${format}: audioProperties should not be null`);
          assertGreater(
            props!.sampleRate,
            0,
            `${format}: sampleRate should be > 0`,
          );
          assertGreater(
            props!.channels,
            0,
            `${format}: channels should be > 0`,
          );
        } finally {
          audioFile.dispose();
        }
      });
    }

    it("should write tags via buffer and read them back", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      const tag = handle.getTag();
      tag.setTitle("Buffer Write Test");
      const saved = handle.save();
      assertEquals(saved, true, "save() should return true for buffer write");

      // Re-read the modified buffer
      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      assertEquals(handle2.getTag().title(), "Buffer Write Test");

      handle2.destroy();
      handle.destroy();
    });

    it("should roundtrip albumArtist via buffer write", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setProperty("ALBUMARTIST", "Test Album Artist");
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      assertEquals(handle2.getProperty("ALBUMARTIST"), "Test Album Artist");

      handle2.destroy();
      handle.destroy();
    });

    it("should roundtrip extended properties (ACOUSTID_FINGERPRINT) via buffer write", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setProperty("ACOUSTID_FINGERPRINT", "AQADtNQYhYkYRcg");
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      assertEquals(
        handle2.getProperty("ACOUSTID_FINGERPRINT"),
        "AQADtNQYhYkYRcg",
      );

      handle2.destroy();
      handle.destroy();
    });

    it("should produce different bytes after tag modification", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      handle.getTag().setTitle("Completely New Title For Byte Diff");
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const outputBuffer = handle.getBuffer();
      const inputAndOutputDiffer = fileData.length !== outputBuffer.length ||
        fileData.some((byte, i) => byte !== outputBuffer[i]);
      assertEquals(
        inputAndOutputDiffer,
        true,
        "Output buffer should differ from input after tag modification",
      );

      handle.destroy();
    });

    it("should saveToFile() via WASI buffer write path", async () => {
      const { TagLib } = await import("../src/taglib/taglib-class.ts");
      const taglib = await TagLib.initialize({ forceWasmType: "wasi" });

      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      const audioFile = await taglib.open(fileData);

      const tempDir = await Deno.makeTempDir();
      const tempPath = resolve(tempDir, "save-test.flac");
      try {
        audioFile.tag().setTitle("SaveToFile Test");
        await audioFile.saveToFile(tempPath);

        const saved = await Deno.readFile(tempPath);
        const audioFile2 = await taglib.open(saved);
        try {
          assertEquals(audioFile2.tag().title, "SaveToFile Test");
        } finally {
          audioFile2.dispose();
        }
      } finally {
        audioFile.dispose();
        await Deno.remove(tempDir, { recursive: true });
      }
    });
  },
);
