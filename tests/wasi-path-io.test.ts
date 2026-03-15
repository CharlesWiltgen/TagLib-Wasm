/**
 * @fileoverview Tests for WASI path-based I/O
 *
 * Verifies that the WASI backend reads/writes audio files directly via
 * filesystem syscalls instead of loading entire files into memory.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { TagLib } from "../index.ts";
import { applyTagsToFile, readTags } from "../simple.ts";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import {
  readTagsFromWasmPath,
  writeTagsToWasmPath,
} from "../src/runtime/wasi-adapter/wasm-io.ts";
import type { ExtendedTag } from "../src/types.ts";

const TEST_FILES_DIR = resolve("tests/test-files");
const WASM_PATH = resolve("build/taglib_wasi.wasm");
describe("WASI path-based I/O", () => {
  describe("readTagsFromWasmPath", () => {
    it("reads tags from MP3 via path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });
      const result = readTagsFromWasmPath(wasi, "/test/mp3/kiss-snippet.mp3");
      assertExists(result);
      assertEquals(result.length > 0, true);
    });

    it("reads tags from M4A via path", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });
      const result = readTagsFromWasmPath(wasi, "/test/mp4/kiss-snippet.m4a");
      assertExists(result);
    });

    it("throws on nonexistent file", async () => {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/test": TEST_FILES_DIR },
      });
      let threw = false;
      try {
        readTagsFromWasmPath(wasi, "/test/nonexistent.mp3");
      } catch (e) {
        threw = true;
        assertEquals(
          (e as Error).message.includes("/test/nonexistent.mp3"),
          true,
        );
      }
      assertEquals(threw, true);
    });
  });

  describe("writeTagsToWasmPath", () => {
    it("writes tags and re-reads via path", async () => {
      const tmpPath = resolve(TEST_FILES_DIR, "../path-write-test.mp3");
      try {
        await Deno.copyFile(
          resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
          tmpPath,
        );
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": resolve(TEST_FILES_DIR, "..") },
        });

        const tags: ExtendedTag = {
          title: ["Written Via Path"],
          artist: ["WASI Test"],
        };
        writeTagsToWasmPath(wasi, "/tmp/path-write-test.mp3", tags);

        const result = readTagsFromWasmPath(
          wasi,
          "/tmp/path-write-test.mp3",
        );
        assertExists(result);
      } finally {
        try {
          await Deno.remove(tmpPath);
        } catch { /* cleanup */ }
      }
    });
  });

  describe("TagLib.open path mode", () => {
    it("opens file by path and reads tags", async () => {
      const taglib = await TagLib.initialize();
      const mp3Path = resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
      using file = await taglib.open(mp3Path);
      assertEquals(file.tag().title, "Kiss");
      assertEquals(file.tag().artist, "Prince");
    });

    it("opens file by relative path", async () => {
      const taglib = await TagLib.initialize();
      using file = await taglib.open("tests/test-files/mp3/kiss-snippet.mp3");
      assertEquals(file.tag().title, "Kiss");
    });

    it("returns correct audio properties", async () => {
      const taglib = await TagLib.initialize();
      const mp3Path = resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
      using file = await taglib.open(mp3Path);
      const props = file.audioProperties();
      assertExists(props);
      assertExists(props!.duration);
      assertExists(props!.bitrate);
      assertExists(props!.sampleRate);
    });

    it("save() writes in-place for path-opened files", async () => {
      const tmpPath = resolve(TEST_FILES_DIR, "../path-save-test.mp3");
      try {
        await Deno.copyFile(
          resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
          tmpPath,
        );
        const taglib = await TagLib.initialize();
        {
          using file = await taglib.open(tmpPath);
          file.tag().setTitle("Path Save");
          assertEquals(file.save(), true);
        }
        {
          using file = await taglib.open(tmpPath);
          assertEquals(file.tag().title, "Path Save");
        }
      } finally {
        try {
          await Deno.remove(tmpPath);
        } catch { /* cleanup */ }
      }
    });
  });

  describe("Simple API with path mode", () => {
    it("readTags works with file paths", async () => {
      const mp3Path = resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
      const tags = await readTags(mp3Path);
      assertEquals(tags.title?.[0], "Kiss");
      assertEquals(tags.artist?.[0], "Prince");
    });

    it("applyTagsToFile writes and persists", async () => {
      const tmpPath = resolve(TEST_FILES_DIR, "../simple-path-test.mp3");
      try {
        await Deno.copyFile(
          resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
          tmpPath,
        );
        await applyTagsToFile(tmpPath, {
          title: "Simple Path Write",
          artist: "Test",
        });
        const tags = await readTags(tmpPath);
        assertEquals(tags.title?.[0], "Simple Path Write");
        assertEquals(tags.artist?.[0], "Test");
      } finally {
        try {
          await Deno.remove(tmpPath);
        } catch { /* cleanup */ }
      }
    });
  });
});
