import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadAudioData } from "./load-audio-data.ts";

const TEST_MP3 = resolve(Deno.cwd(), "tests/test-files/mp3/kiss-snippet.mp3");

describe("loadAudioData", () => {
  const defaultOpts = {
    partial: true,
    maxHeaderSize: 1024 * 1024,
    maxFooterSize: 128 * 1024,
  };

  describe("Uint8Array input", () => {
    it("should return the buffer directly without partial loading", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await loadAudioData(data, defaultOpts);
      assertEquals(result.data, data);
      assertEquals(result.isPartiallyLoaded, false);
    });
  });

  describe("ArrayBuffer input", () => {
    it("should convert ArrayBuffer to Uint8Array", async () => {
      const buf = new Uint8Array([10, 20, 30]).buffer;
      const result = await loadAudioData(buf, defaultOpts);
      assertEquals(result.data, new Uint8Array([10, 20, 30]));
      assertEquals(result.isPartiallyLoaded, false);
    });
  });

  describe("File input with partial loading", () => {
    it("should load entire small File without partial splitting", async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5]);
      const file = new File([content], "small.mp3");
      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: 10,
        maxFooterSize: 10,
      });
      assertEquals(result.data, content);
      assertEquals(result.isPartiallyLoaded, false);
    });

    it("should partially load large File combining header and footer", async () => {
      const size = 100;
      const content = Uint8Array.from({ length: size }, (_, i) => i);
      const file = new File([content], "large.mp3");

      const headerSize = 20;
      const footerSize = 10;
      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: headerSize,
        maxFooterSize: footerSize,
      });

      assertEquals(result.isPartiallyLoaded, true);
      assertEquals(result.data.length, headerSize + footerSize);
      assertEquals(
        result.data.slice(0, headerSize),
        content.slice(0, headerSize),
      );
      assertEquals(
        result.data.slice(headerSize),
        content.slice(size - footerSize),
      );
    });

    it("should fully load File when partial is false", async () => {
      const content = Uint8Array.from({ length: 100 }, (_, i) => i);
      const file = new File([content], "full.mp3");
      const result = await loadAudioData(file, {
        partial: false,
        maxHeaderSize: 10,
        maxFooterSize: 10,
      });
      assertEquals(result.data, content);
      assertEquals(result.isPartiallyLoaded, false);
    });

    it("should clamp header and footer sizes to file size", async () => {
      const content = Uint8Array.from({ length: 50 }, (_, i) => i);
      const file = new File([content], "medium.mp3");

      // headerSize clamped to 50, footerSize clamped to 50 → sum >= file size → full load
      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: 100,
        maxFooterSize: 100,
      });
      assertEquals(result.isPartiallyLoaded, false);
      assertEquals(result.data, content);
    });
  });

  describe("string path input with partial loading", () => {
    it("should fully load file when size <= header + footer", async () => {
      const fileSize = (await Deno.stat(TEST_MP3)).size;
      const result = await loadAudioData(TEST_MP3, {
        partial: true,
        maxHeaderSize: fileSize,
        maxFooterSize: fileSize,
      });
      assertEquals(result.isPartiallyLoaded, false);
      assertEquals(result.data.length, fileSize);
    });

    it("should partially load file when size > header + footer", async () => {
      const headerSize = 1024;
      const footerSize = 512;
      const fullData = await Deno.readFile(TEST_MP3);

      const result = await loadAudioData(TEST_MP3, {
        partial: true,
        maxHeaderSize: headerSize,
        maxFooterSize: footerSize,
      });
      assertEquals(result.isPartiallyLoaded, true);
      assertEquals(result.data.length, headerSize + footerSize);
      assertEquals(
        result.data.slice(0, headerSize),
        fullData.slice(0, headerSize),
      );
      assertEquals(
        result.data.slice(headerSize),
        fullData.slice(fullData.length - footerSize),
      );
    });

    it("should fully load file when partial is false", async () => {
      const fileSize = (await Deno.stat(TEST_MP3)).size;
      const result = await loadAudioData(TEST_MP3, {
        partial: false,
        maxHeaderSize: 64,
        maxFooterSize: 64,
      });
      assertEquals(result.isPartiallyLoaded, false);
      assertEquals(result.data.length, fileSize);
    });
  });
});
