/// <reference lib="deno.ns" />

/**
 * @fileoverview Tests for API realignment: renamed functions, edit(), fluent setters
 */

import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/mod.ts";
import { TEST_FILES, withTempFile } from "./test-utils.ts";
import { readFileData } from "../src/utils/file.ts";
import { setBufferMode } from "../src/simple/index.ts";
import type { PictureType } from "../src/types.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

describe("API Realignment", () => {
  describe("Renamed Simple API Functions", () => {
    it("readFormat detects audio formats", async () => {
      const { readFormat } = await import("../src/simple/index.ts");

      assertEquals(await readFormat(TEST_FILES.mp3), "MP3");
      assertEquals(await readFormat(TEST_FILES.flac), "FLAC");
      assertEquals(await readFormat(TEST_FILES.ogg), "OGG");
    });

    it("readCoverArt reads primary cover art", async () => {
      const { readCoverArt, applyCoverArt } = await import(
        "../src/simple/index.ts"
      );
      const { RED_PNG } = await import("./test-utils.ts");

      const buffer = await readFileData(TEST_FILES.mp3);

      const noCover = await readCoverArt(buffer);
      assertEquals(noCover, undefined);

      const withArt = await applyCoverArt(buffer, RED_PNG, "image/png");
      const cover = await readCoverArt(withArt);
      assertExists(cover);
      assertEquals(cover!.length, RED_PNG.length);
    });

    it("applyCoverArt sets primary cover art", async () => {
      const { applyCoverArt, readCoverArt } = await import(
        "../src/simple/index.ts"
      );
      const { RED_PNG } = await import("./test-utils.ts");

      const buffer = await readFileData(TEST_FILES.mp3);
      const result = await applyCoverArt(buffer, RED_PNG, "image/png");
      assert(result.length > buffer.length);

      const cover = await readCoverArt(result);
      assertExists(cover);
    });

    it("readPictureMetadata returns metadata without data", async () => {
      const { readPictureMetadata, applyPictures } = await import(
        "../src/simple/index.ts"
      );
      const { RED_PNG } = await import("./test-utils.ts");

      const buffer = await readFileData(TEST_FILES.mp3);
      const withPic = await applyPictures(buffer, [
        {
          mimeType: "image/png",
          data: RED_PNG,
          type: "FrontCover" as PictureType,
          description: "Cover",
        },
      ]);

      const metadata = await readPictureMetadata(withPic);
      assertEquals(metadata.length, 1);
      assertEquals(metadata[0].mimeType, "image/png");
      assertEquals(metadata[0].size, RED_PNG.length);
    });
  });

  describe("taglib.edit() - Callback-Scoped Write", () => {
    it("edit(buffer, fn) applies tags and returns modified Uint8Array", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const buffer = await readFileData(TEST_FILES.mp3);

      const result = await taglib.edit(buffer, (file) => {
        file.tag().setTitle("Edited Title").setArtist("Edited Artist");
      });

      // With overload signatures, result is typed as Uint8Array (not void | Uint8Array)
      const verifyFile = await taglib.open(result);
      const tags = verifyFile.tag();
      assertEquals(tags.title, "Edited Title");
      assertEquals(tags.artist, "Edited Artist");
      verifyFile.dispose();
    });

    it("edit(path, fn) writes to disk and returns void", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const sourceData = await readFileData(TEST_FILES.mp3);

      await withTempFile("test.mp3", sourceData, async (path) => {
        const result = await taglib.edit(path, (file) => {
          file.tag().setTitle("Disk Edit").setYear(2026);
        });

        assertEquals(result, undefined, "Should return void for path input");

        const verifyFile = await taglib.open(path);
        const tags = verifyFile.tag();
        assertEquals(tags.title, "Disk Edit");
        assertEquals(tags.year, 2026);
        verifyFile.dispose();
      });
    });

    it("edit() supports async callbacks", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const buffer = await readFileData(TEST_FILES.flac);

      const result = await taglib.edit(buffer, async (file) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        file.tag().setTitle("Async Edit");
      });

      const verifyFile = await taglib.open(result);
      assertEquals(verifyFile.tag().title, "Async Edit");
      verifyFile.dispose();
    });

    it("edit() disposes file even when callback throws", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const buffer = await readFileData(TEST_FILES.mp3);

      await assertRejects(
        () =>
          taglib.edit(buffer, () => {
            throw new Error("Callback error");
          }),
        Error,
        "Callback error",
      );

      // Should not leak — verify we can still open files
      const file = await taglib.open(buffer);
      assert(file.isValid());
      file.dispose();
    });
  });

  describe("Fluent MutableTag Setters", () => {
    it("MutableTag setters return the tag for chaining", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const buffer = await readFileData(TEST_FILES.mp3);
      const file = await taglib.open(buffer);

      const tag = file.tag();
      const result = tag
        .setTitle("Fluent Title")
        .setArtist("Fluent Artist")
        .setAlbum("Fluent Album")
        .setYear(2026)
        .setTrack(7)
        .setGenre("Electronic")
        .setComment("Fluent comment");

      assertEquals(result, tag);

      const updated = file.tag();
      assertEquals(updated.title, "Fluent Title");
      assertEquals(updated.artist, "Fluent Artist");
      assertEquals(updated.album, "Fluent Album");
      assertEquals(updated.year, 2026);
      assertEquals(updated.track, 7);
      assertEquals(updated.genre, "Electronic");
      assertEquals(updated.comment, "Fluent comment");

      file.dispose();
    });

    it("fluent setters work inside edit() callback", async () => {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const buffer = await readFileData(TEST_FILES.flac);

      const result = await taglib.edit(buffer, (file) => {
        file.tag()
          .setTitle("Chained in Edit")
          .setArtist("Chain Artist")
          .setYear(2026);
      });

      const verifyFile = await taglib.open(result);
      const tags = verifyFile.tag();
      assertEquals(tags.title, "Chained in Edit");
      assertEquals(tags.artist, "Chain Artist");
      assertEquals(tags.year, 2026);
      verifyFile.dispose();
    });
  });
});
