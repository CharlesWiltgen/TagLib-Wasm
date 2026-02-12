/// <reference lib="deno.ns" />

/**
 * @fileoverview Tests for API realignment: renamed functions, edit(), fluent setters
 */

import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { TagLib } from "../src/mod.ts";
import { TEST_FILES, withTempFile } from "./test-utils.ts";
import { readFileData } from "../src/utils/file.ts";
import { setBufferMode } from "../src/simple.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

// =============================================================================
// Renamed Simple API Functions
// =============================================================================

Deno.test("readCoverArt returns same result as deprecated getCoverArt", async () => {
  const {
    readCoverArt,
    getCoverArt,
    applyCoverArt,
    setCoverArt,
  } = await import("../src/simple.ts");
  const { RED_PNG } = await import("./test-utils.ts");

  // Set cover art first
  const buffer = await readFileData(TEST_FILES.mp3);
  const withArt = await applyCoverArt(buffer, RED_PNG, "image/png");

  // Both should return the same data
  const fromNew = await readCoverArt(withArt);
  const fromOld = await getCoverArt(withArt);
  assertEquals(fromNew, fromOld);
});

Deno.test("readFormat returns same result as deprecated getFormat", async () => {
  const { readFormat, getFormat } = await import("../src/simple.ts");

  const fromNew = await readFormat(TEST_FILES.mp3);
  const fromOld = await getFormat(TEST_FILES.mp3);
  assertEquals(fromNew, fromOld);
  assertEquals(fromNew, "MP3");
});

Deno.test("readPictureMetadata returns same result as deprecated getPictureMetadata", async () => {
  const {
    readPictureMetadata,
    getPictureMetadata,
    applyPictures,
  } = await import("../src/simple.ts");
  const { RED_PNG } = await import("./test-utils.ts");

  const buffer = await readFileData(TEST_FILES.mp3);
  const withPic = await applyPictures(buffer, [
    { mimeType: "image/png", data: RED_PNG, type: 3, description: "Cover" },
  ]);

  const fromNew = await readPictureMetadata(withPic);
  const fromOld = await getPictureMetadata(withPic);
  assertEquals(fromNew, fromOld);
});

Deno.test("applyCoverArt returns same result as deprecated setCoverArt", async () => {
  const { applyCoverArt, setCoverArt, readCoverArt } = await import(
    "../src/simple.ts"
  );
  const { RED_PNG } = await import("./test-utils.ts");

  const buffer = await readFileData(TEST_FILES.mp3);
  const fromNew = await applyCoverArt(buffer, RED_PNG, "image/png");
  const fromOld = await setCoverArt(buffer, RED_PNG, "image/png");

  // Both should produce buffers with cover art
  const artNew = await readCoverArt(fromNew);
  const artOld = await readCoverArt(fromOld);
  assertExists(artNew);
  assertExists(artOld);
  assertEquals(artNew!.length, artOld!.length);
});

Deno.test("deprecated getCoverArt still works", async () => {
  const { getCoverArt, setCoverArt } = await import("../src/simple.ts");
  const { RED_PNG } = await import("./test-utils.ts");

  const buffer = await readFileData(TEST_FILES.mp3);
  const withArt = await setCoverArt(buffer, RED_PNG, "image/png");
  const cover = await getCoverArt(withArt);
  assertExists(cover);
});

Deno.test("deprecated getFormat still works", async () => {
  const { getFormat } = await import("../src/simple.ts");
  const format = await getFormat(TEST_FILES.mp3);
  assertEquals(format, "MP3");
});

Deno.test("deprecated getPictureMetadata still works", async () => {
  const { getPictureMetadata, applyPictures } = await import(
    "../src/simple.ts"
  );
  const { RED_PNG } = await import("./test-utils.ts");

  const buffer = await readFileData(TEST_FILES.mp3);
  const withPic = await applyPictures(buffer, [
    { mimeType: "image/png", data: RED_PNG, type: 3, description: "Cover" },
  ]);
  const metadata = await getPictureMetadata(withPic);
  assertEquals(metadata.length, 1);
});

Deno.test("deprecated setCoverArt still works", async () => {
  const { setCoverArt, getCoverArt } = await import("../src/simple.ts");
  const { RED_PNG } = await import("./test-utils.ts");

  const buffer = await readFileData(TEST_FILES.mp3);
  const withArt = await setCoverArt(buffer, RED_PNG, "image/png");
  const cover = await getCoverArt(withArt);
  assertExists(cover);
});

// =============================================================================
// taglib.edit() — Callback-Scoped Write
// =============================================================================

Deno.test("edit(buffer, fn) applies tags and returns modified Uint8Array", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.mp3);

  const result = await taglib.edit(buffer, (file) => {
    file.tag().setTitle("Edited Title").setArtist("Edited Artist");
  });

  assert(
    result instanceof Uint8Array,
    "Should return Uint8Array for buffer input",
  );

  // Verify the tags were written
  const verifyFile = await taglib.open(result!);
  const tags = verifyFile.tag();
  assertEquals(tags.title, "Edited Title");
  assertEquals(tags.artist, "Edited Artist");
  verifyFile.dispose();
});

Deno.test("edit(path, fn) writes to disk and returns void", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const sourceData = await readFileData(TEST_FILES.mp3);

  await withTempFile("test.mp3", sourceData, async (path) => {
    const result = await taglib.edit(path, (file) => {
      file.tag().setTitle("Disk Edit").setYear(2026);
    });

    assertEquals(result, undefined, "Should return void for path input");

    // Verify changes were saved to disk
    const verifyFile = await taglib.open(path);
    const tags = verifyFile.tag();
    assertEquals(tags.title, "Disk Edit");
    assertEquals(tags.year, 2026);
    verifyFile.dispose();
  });
});

Deno.test("edit() supports async callbacks", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.flac);

  const result = await taglib.edit(buffer, async (file) => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
    file.tag().setTitle("Async Edit");
  });

  assertExists(result);
  const verifyFile = await taglib.open(result!);
  assertEquals(verifyFile.tag().title, "Async Edit");
  verifyFile.dispose();
});

Deno.test("edit() disposes file even when callback throws", async () => {
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

// =============================================================================
// Fluent MutableTag Setters
// =============================================================================

Deno.test("MutableTag setters return the tag for chaining", async () => {
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

  // Result should be the same tag object
  assertEquals(result, tag);

  // Verify all values were set
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

Deno.test("fluent setters work inside edit() callback", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.flac);

  const result = await taglib.edit(buffer, (file) => {
    file.tag()
      .setTitle("Chained in Edit")
      .setArtist("Chain Artist")
      .setYear(2026);
  });

  assertExists(result);
  const verifyFile = await taglib.open(result!);
  const tags = verifyFile.tag();
  assertEquals(tags.title, "Chained in Edit");
  assertEquals(tags.artist, "Chain Artist");
  assertEquals(tags.year, 2026);
  verifyFile.dispose();
});
