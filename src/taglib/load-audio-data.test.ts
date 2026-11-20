import { describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadAudioData } from "./load-audio-data.ts";

const TEST_MP3 = resolve(
  process.cwd(),
  "tests/test-files/mp3/kiss-snippet.mp3",
);

describe("loadAudioData", () => {
  const defaultOpts = {
    partial: true,
    maxHeaderSize: 1024 * 1024,
    maxFooterSize: 128 * 1024,
  };

  /** Append a 32-byte APEv2 footer declaring a `tagSize`-byte tag. */
  function withApeFooter(
    content: Uint8Array<ArrayBuffer>,
    tagSize: number,
  ): Uint8Array<ArrayBuffer> {
    const at = content.length - 32;
    content.set(new TextEncoder().encode("APETAGEX"), at);
    content[at + 8] = 0xe8; // version 2000, little-endian (not validated)
    content[at + 9] = 0x07;
    content[at + 12] = tagSize & 0xff;
    content[at + 13] = (tagSize >>> 8) & 0xff;
    content[at + 14] = (tagSize >>> 16) & 0xff;
    content[at + 15] = (tagSize >>> 24) & 0xff;
    return content;
  }

  /**
   * `size` bytes beginning with an ID3v2.3 header whose tag ends at
   * `10 + declaredTagSize`. Partial loading is only allowed when it can prove
   * the metadata ends inside the header window, so a fixture of arbitrary
   * bytes is now (correctly) loaded in full — it has to look like something.
   */
  function id3File(
    size: number,
    declaredTagSize: number,
  ): Uint8Array<ArrayBuffer> {
    const content = Uint8Array.from({ length: size }, (_, i) => i);
    content.set(new TextEncoder().encode("ID3"), 0);
    content[3] = 3;
    content[4] = 0;
    content[5] = 0;
    content[6] = (declaredTagSize >>> 21) & 0x7f;
    content[7] = (declaredTagSize >>> 14) & 0x7f;
    content[8] = (declaredTagSize >>> 7) & 0x7f;
    content[9] = declaredTagSize & 0x7f;
    return content;
  }

  describe("Uint8Array input", () => {
    it("should return the buffer directly without partial loading", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await loadAudioData(data, defaultOpts);
      expect(result.data).toStrictEqual(data);
      expect(result.isPartiallyLoaded).toStrictEqual(false);
    });
  });

  describe("ArrayBuffer input", () => {
    it("should convert ArrayBuffer to Uint8Array", async () => {
      const buf = new Uint8Array([10, 20, 30]).buffer;
      const result = await loadAudioData(buf, defaultOpts);
      expect(result.data).toStrictEqual(new Uint8Array([10, 20, 30]));
      expect(result.isPartiallyLoaded).toStrictEqual(false);
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
      expect(result.data).toStrictEqual(content);
      expect(result.isPartiallyLoaded).toStrictEqual(false);
    });

    it("should partially load large File combining header and footer", async () => {
      const size = 100;
      const headerSize = 20;
      const footerSize = 10;
      // Tag ends at byte 11, leaving room in the 20-byte header window to check
      // what follows it. A tag ending within 8 bytes of the window end cannot be
      // vouched for — the container behind it would be unreadable — so it falls
      // back to a full read instead; that is a slower answer, never a wrong one.
      const content = id3File(size, 1);
      const file = new File([content], "large.mp3");

      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: headerSize,
        maxFooterSize: footerSize,
      });

      expect(result.isPartiallyLoaded).toStrictEqual(true);
      expect(result.data.length).toStrictEqual(headerSize + footerSize);
      expect(result.data.slice(0, headerSize)).toStrictEqual(
        content.slice(0, headerSize),
      );
      expect(result.data.slice(headerSize)).toStrictEqual(
        content.slice(size - footerSize),
      );
    });

    it("should fully load a File whose metadata overruns the header window", async () => {
      // taglib-f5hp: splicing here would cut the tag mid-structure and join
      // footer bytes onto the cut, which TagLib then misreads. Correct answer
      // is to give up the optimisation and read the whole file.
      const content = id3File(100, 60); // tag ends at 70, past the 20-byte window
      const file = new File([content], "bigtag.mp3");

      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: 20,
        maxFooterSize: 10,
      });

      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data).toStrictEqual(content);
    });

    it("should fully load a File whose container it cannot bound", async () => {
      // No recognised magic: nothing proves where the metadata ends, so partial
      // loading is not safe to attempt.
      const content = Uint8Array.from({ length: 100 }, (_, i) => i);
      const file = new File([content], "unknown.bin");

      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: 20,
        maxFooterSize: 10,
      });

      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data).toStrictEqual(content);
    });

    it("should fully load a File whose APE tag overruns the footer window", async () => {
      // An APE tag larger than the footer window is spliced so TagLib computes
      // its start inside the header's audio and reads nothing (taglib-f5hp).
      // The header half is valid, so only the trailer guard can catch this.
      const content = withApeFooter(id3File(1000, 1), 4096);
      const file = new File([content], "ape.mp3");

      const result = await loadAudioData(file, {
        partial: true,
        maxHeaderSize: 64,
        maxFooterSize: 64,
      });

      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data).toStrictEqual(content);
    });

    it("should fully load File when partial is false", async () => {
      const content = Uint8Array.from({ length: 100 }, (_, i) => i);
      const file = new File([content], "full.mp3");
      const result = await loadAudioData(file, {
        partial: false,
        maxHeaderSize: 10,
        maxFooterSize: 10,
      });
      expect(result.data).toStrictEqual(content);
      expect(result.isPartiallyLoaded).toStrictEqual(false);
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
      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data).toStrictEqual(content);
    });
  });

  describe("string path input with partial loading", () => {
    it("should fully load file when size <= header + footer", async () => {
      const fileSize = (await stat(TEST_MP3)).size;
      const result = await loadAudioData(TEST_MP3, {
        partial: true,
        maxHeaderSize: fileSize,
        maxFooterSize: fileSize,
      });
      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data.length).toStrictEqual(fileSize);
    });

    it("should partially load file when size > header + footer", async () => {
      const headerSize = 1024;
      const footerSize = 512;
      const fullData = new Uint8Array(await readFile(TEST_MP3));

      const result = await loadAudioData(TEST_MP3, {
        partial: true,
        maxHeaderSize: headerSize,
        maxFooterSize: footerSize,
      });
      expect(result.isPartiallyLoaded).toStrictEqual(true);
      expect(result.data.length).toStrictEqual(headerSize + footerSize);
      expect(result.data.slice(0, headerSize)).toStrictEqual(
        fullData.slice(0, headerSize),
      );
      expect(result.data.slice(headerSize)).toStrictEqual(
        fullData.slice(fullData.length - footerSize),
      );
    });

    it("should fully load a path whose APE tag overruns the footer window", async () => {
      const content = withApeFooter(id3File(1000, 1), 4096);
      const dir = await mkdtemp(join(tmpdir(), "load-audio-data-"));
      const path = join(dir, "ape.mp3");
      await writeFile(path, content);
      try {
        const result = await loadAudioData(path, {
          partial: true,
          maxHeaderSize: 64,
          maxFooterSize: 64,
        });
        expect(result.isPartiallyLoaded).toStrictEqual(false);
        expect(new Uint8Array(result.data)).toStrictEqual(content);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it("should fully load file when partial is false", async () => {
      const fileSize = (await stat(TEST_MP3)).size;
      const result = await loadAudioData(TEST_MP3, {
        partial: false,
        maxHeaderSize: 64,
        maxFooterSize: 64,
      });
      expect(result.isPartiallyLoaded).toStrictEqual(false);
      expect(result.data.length).toStrictEqual(fileSize);
    });
  });
});
