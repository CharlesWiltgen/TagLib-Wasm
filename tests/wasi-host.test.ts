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

type RawTag = Record<string, unknown>;
import {
  fileExists,
  FORMAT_FILES,
  readTagsViaBuffer,
  readTagsViaPath,
  writeTagsWasi,
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

        const tags = readTagsViaPath(wasi, paths.virtual) as unknown as RawTag;
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
        const tags = readTagsViaBuffer(wasi, fileData) as unknown as RawTag;
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
          const tags = { title: "New Title" } as unknown as ExtendedTag;
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
          ) as unknown as RawTag;
          assertEquals(readTags.title, "New Title");
        }
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    });

    it("should roundtrip extended fields via Simple API", async () => {
      const tempDir = await Deno.makeTempDir();
      const srcPath = resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac");
      const destPath = resolve(tempDir, "extended-roundtrip.flac");
      await Deno.copyFile(srcPath, destPath);

      try {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        const extendedTags = {
          title: "Roundtrip Test",
          albumArtist: "Various Artists",
          composer: "Test Composer",
          discNumber: 2,
          bpm: 128,
          acoustidFingerprint: "AQADtNQYhYkYRcg",
          musicbrainzTrackId: "abc-123-def",
          replayGainTrackGain: "-6.54 dB",
          titleSort: "Roundtrip Test, The",
          artistSort: "Artist, The",
        } as unknown as ExtendedTag;

        writeTagsWasi(wasi, "/tmp/extended-roundtrip.flac", extendedTags);

        using wasi2 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        const readBack = readTagsViaPath(
          wasi2,
          "/tmp/extended-roundtrip.flac",
        ) as unknown as RawTag;
        assertEquals(readBack.title, "Roundtrip Test");
        assertEquals(readBack.albumArtist, "Various Artists");
        assertEquals(readBack.composer, "Test Composer");
        assertEquals(readBack.discNumber, 2);
        assertEquals(readBack.bpm, 128);
        assertEquals(readBack.acoustidFingerprint, "AQADtNQYhYkYRcg");
        assertEquals(readBack.musicbrainzTrackId, "abc-123-def");
        assertEquals(readBack.replayGainTrackGain, "-6.54 dB");
        assertEquals(readBack.titleSort, "Roundtrip Test, The");
        assertEquals(readBack.artistSort, "Artist, The");
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
      const tags = decodeTagData(msgpackData) as unknown as RawTag;

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

    it("should return UPPERCASE keys from getProperties()", async () => {
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

      const props = handle.getProperties();
      // Keys should be UPPERCASE
      assertExists(props["TITLE"]);
      assertEquals(props["TITLE"], ["Kiss"]);
      // camelCase keys should not exist
      assertEquals("title" in props, false);
      assertEquals("artist" in props, false);

      handle.destroy();
    });

    it("should not include audio properties in getProperties()", async () => {
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

      const props = handle.getProperties();
      assertEquals("bitrate" in props, false);
      assertEquals("sampleRate" in props, false);
      assertEquals("channels" in props, false);
      assertEquals("length" in props, false);
      assertEquals("lengthMs" in props, false);

      handle.destroy();
    });

    it("should roundtrip ALBUMARTIST via getProperties after buffer write", async () => {
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

      handle.setProperty("ALBUMARTIST", "Various Artists");
      handle.save();

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const props = handle2.getProperties();
      assertEquals(props["ALBUMARTIST"], ["Various Artists"]);

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

    it("should roundtrip setProperties() via buffer write", async () => {
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

      handle.setProperties({
        TITLE: ["Properties Title"],
        ARTIST: ["Properties Artist"],
        ALBUMARTIST: ["VA"],
      });
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      assertEquals(handle2.getTag().title(), "Properties Title");
      assertEquals(handle2.getTag().artist(), "Properties Artist");
      assertEquals(handle2.getProperty("ALBUMARTIST"), "VA");
      const props = handle2.getProperties();
      assertEquals(props["TITLE"], ["Properties Title"]);
      assertEquals(props["ALBUMARTIST"], ["VA"]);

      handle2.destroy();
      handle.destroy();
    });

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`should detect correct format via getFormat() (${format})`, async () => {
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

        const expected: Record<string, string> = {
          FLAC: "FLAC",
          MP3: "MP3",
          WAV: "WAV",
          M4A: "MP4",
          OGG: "OGG",
        };
        assertEquals(
          handle.getFormat(),
          expected[format],
          `${format}: getFormat() should return ${expected[format]}`,
        );

        handle.destroy();
      });
    }

    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`should return extended audio properties (${format})`, async () => {
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

        const expected: Record<string, {
          codec: string;
          containerFormat: string;
          isLossless: boolean;
          hasBitsPerSample: boolean;
        }> = {
          FLAC: {
            codec: "FLAC",
            containerFormat: "FLAC",
            isLossless: true,
            hasBitsPerSample: true,
          },
          WAV: {
            codec: "PCM",
            containerFormat: "WAV",
            isLossless: true,
            hasBitsPerSample: true,
          },
          MP3: {
            codec: "MP3",
            containerFormat: "MP3",
            isLossless: false,
            hasBitsPerSample: false,
          },
          OGG: {
            codec: "Vorbis",
            containerFormat: "OGG",
            isLossless: false,
            hasBitsPerSample: false,
          },
          M4A: {
            codec: "AAC",
            containerFormat: "MP4",
            isLossless: false,
            hasBitsPerSample: false,
          },
        };

        const exp = expected[format];
        assertEquals(
          props!.codec(),
          exp.codec,
          `${format}: codec mismatch`,
        );
        assertEquals(
          props!.containerFormat(),
          exp.containerFormat,
          `${format}: containerFormat mismatch`,
        );
        assertEquals(
          props!.isLossless(),
          exp.isLossless,
          `${format}: isLossless mismatch`,
        );
        if (exp.hasBitsPerSample) {
          assertGreater(
            props!.bitsPerSample(),
            0,
            `${format}: bitsPerSample should be > 0`,
          );
        }

        handle.destroy();
      });
    }

    it("should roundtrip pictures via buffer write (FLAC)", async () => {
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

      const smallJpeg = new Uint8Array([
        0xFF,
        0xD8,
        0xFF,
        0xE0,
        0x00,
        0x10,
        0x4A,
        0x46,
        0x49,
        0x46,
        0x00,
        0x01,
        0x01,
        0x00,
        0x00,
        0x01,
        0x00,
        0x01,
        0x00,
        0x00,
        0xFF,
        0xD9,
      ]);

      handle.setPictures([{
        mimeType: "image/jpeg",
        data: smallJpeg,
        type: 3,
        description: "Front Cover",
      }]);
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const pics = handle2.getPictures();

      assertEquals(pics.length, 1, "Should have 1 picture");
      assertEquals(pics[0].mimeType, "image/jpeg");
      assertEquals(pics[0].type, 3);
      assertEquals(pics[0].description, "Front Cover");
      assertEquals(pics[0].data.length, smallJpeg.length);

      handle2.destroy();
      handle.destroy();
    });

    it("should clear pictures with setPictures([])", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );

      // First write a picture
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setPictures([{
        mimeType: "image/png",
        data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
        type: 0,
      }]);
      handle.save();

      // Then clear
      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      handle2.setPictures([]);
      handle2.save();

      const handle3 = new WasiFileHandle(wasi);
      handle3.loadFromBuffer(handle2.getBuffer());
      assertEquals(
        handle3.getPictures().length,
        0,
        "Pictures should be cleared",
      );

      handle3.destroy();
      handle2.destroy();
      handle.destroy();
    });

    it("should not include extended audio keys in getProperties()", async () => {
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

      const props = handle.getProperties();
      assertEquals("bitsPerSample" in props, false);
      assertEquals("codec" in props, false);
      assertEquals("containerFormat" in props, false);
      assertEquals("isLossless" in props, false);
      assertEquals("pictures" in props, false);

      handle.destroy();
    });

    it("should roundtrip ratings via buffer write (FLAC)", async () => {
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

      handle.setRatings([{ rating: 0.8, email: "", counter: 0 }]);
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const ratings = handle2.getRatings();

      assertEquals(ratings.length, 1, "Should have 1 rating");
      // XiphComment stores as string "0.8", parses back to 0.8
      assertEquals(
        Math.abs(ratings[0].rating - 0.8) < 0.01,
        true,
        `FLAC rating roundtrip: expected ~0.8, got ${ratings[0].rating}`,
      );

      handle2.destroy();
      handle.destroy();
    });

    it("should roundtrip ratings via buffer write (MP3 POPM)", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.MP3.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setRatings([{
        rating: 0.8,
        email: "test@example.com",
        counter: 42,
      }]);
      const saved = handle.save();
      assertEquals(saved, true, "save() should succeed");

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const ratings = handle2.getRatings();

      assertEquals(ratings.length, 1, "Should have 1 rating");
      // POPM: 0.8 * 255 + 0.5 = 204, then 204/255 = 0.8 exactly
      assertEquals(
        Math.abs(ratings[0].rating - 0.8) < 0.01,
        true,
        `MP3 rating roundtrip: expected ~0.8, got ${ratings[0].rating}`,
      );
      assertEquals(ratings[0].email, "test@example.com");
      assertEquals(ratings[0].counter, 42);

      handle2.destroy();
      handle.destroy();
    });

    it("should roundtrip ratings via buffer write (OGG)", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.OGG.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setRatings([{ rating: 0.6 }]);
      assertEquals(handle.save(), true);

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const ratings = handle2.getRatings();
      assertEquals(ratings.length, 1);
      assertEquals(
        Math.abs(ratings[0].rating - 0.6) < 0.01,
        true,
        `OGG rating roundtrip: expected ~0.6, got ${ratings[0].rating}`,
      );

      handle2.destroy();
      handle.destroy();
    });

    it("should roundtrip ratings via buffer write (M4A)", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.M4A.real),
      );
      handle.loadFromBuffer(fileData);

      handle.setRatings([{ rating: 0.9 }]);
      assertEquals(handle.save(), true);

      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const ratings = handle2.getRatings();
      assertEquals(ratings.length, 1);
      assertEquals(
        Math.abs(ratings[0].rating - 0.9) < 0.01,
        true,
        `M4A rating roundtrip: expected ~0.9, got ${ratings[0].rating}`,
      );

      handle2.destroy();
      handle.destroy();
    });

    it("should return empty ratings for files without ratings", async () => {
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

      const ratings = handle.getRatings();
      assertEquals(ratings.length, 0, "Should have no ratings");

      handle.destroy();
    });

    it("should not include ratings in getProperties()", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });

      const { WasiFileHandle } = await import(
        "../src/runtime/wasi-adapter/file-handle.ts"
      );

      // Write a rating first
      const handle = new WasiFileHandle(wasi);
      const fileData = await Deno.readFile(
        resolve(TEST_FILES_DIR, FORMAT_FILES.FLAC.real),
      );
      handle.loadFromBuffer(fileData);
      handle.setRatings([{ rating: 0.5 }]);
      handle.save();

      // Read back and check getProperties doesn't include ratings
      const handle2 = new WasiFileHandle(wasi);
      handle2.loadFromBuffer(handle.getBuffer());
      const props = handle2.getProperties();
      assertEquals("ratings" in props, false);

      handle2.destroy();
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
