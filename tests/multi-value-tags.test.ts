/**
 * @fileoverview Tests for multi-value Tag string fields (zm5).
 * Tag string fields (title, artist, album, comment, genre) always return string[].
 * Write functions accept both string and string[] via TagInput.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  applyTagsToBuffer,
  clearTags,
  readTags,
  setBufferMode,
} from "../src/simple/index.ts";
import type { Tag, TagInput } from "../src/types.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

setBufferMode(true);

describe("readTags multi-value", () => {
  it("should return string[] for title, artist, album, comment, genre", async () => {
    const tags = await readTags(FIXTURE_PATH.mp3);

    assertExists(tags.title);
    assertEquals(Array.isArray(tags.title), true);

    assertExists(tags.artist);
    assertEquals(Array.isArray(tags.artist), true);

    assertExists(tags.album);
    assertEquals(Array.isArray(tags.album), true);
  });

  it("should return number for year and track (unchanged)", async () => {
    const tags = await readTags(FIXTURE_PATH.mp3);

    if (tags.year !== undefined) {
      assertEquals(typeof tags.year, "number");
    }
    if (tags.track !== undefined) {
      assertEquals(typeof tags.track, "number");
    }
  });

  it("should wrap single-value files in arrays", async () => {
    const tags = await readTags(FIXTURE_PATH.mp3);

    assertExists(tags.title);
    assertEquals(tags.title, ["Kiss"]);

    assertExists(tags.artist);
    assertEquals(tags.artist, ["Prince"]);
  });

  it("should return arrays across all formats", async () => {
    for (
      const format of ["mp3", "flac", "ogg", "m4a", "wav"] as const
    ) {
      const tags = await readTags(FIXTURE_PATH[format]);
      assertExists(tags.title, `${format}: title missing`);
      assertEquals(
        Array.isArray(tags.title),
        true,
        `${format}: title should be an array`,
      );
    }
  });
});

describe("applyTagsToBuffer with TagInput", () => {
  it("should accept single strings", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const input: Partial<TagInput> = { title: "New Title" };

    const modified = await applyTagsToBuffer(new Uint8Array(original), input);
    assertExists(modified);

    const tags = await readTags(modified);
    assertEquals(tags.title, ["New Title"]);
  });

  it("should accept string arrays", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const input: Partial<TagInput> = {
      artist: ["Artist One", "Artist Two"],
    };

    const modified = await applyTagsToBuffer(new Uint8Array(original), input);
    assertExists(modified);

    const tags = await readTags(modified);
    assertEquals(tags.artist, ["Artist One", "Artist Two"]);
  });

  it("should clear field when writing empty array", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      artist: [],
    });
    const tags = await readTags(modified);

    const isEmpty = (val: string[] | undefined) =>
      val === undefined || val.length === 0 || val.every((s) => s === "");
    assertEquals(isEmpty(tags.artist), true);
  });

  it("should roundtrip many values in a single field", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const artists = Array.from({ length: 20 }, (_, i) => `Artist ${i + 1}`);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      artist: artists,
    });
    const tags = await readTags(modified);
    assertEquals(tags.artist, artists);
  });

  it("should handle mixed string and array fields", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const input: Partial<TagInput> = {
      title: "Single Title",
      genre: ["Rock", "Pop"],
      year: 2025,
    };

    const modified = await applyTagsToBuffer(new Uint8Array(original), input);
    const tags = await readTags(modified);

    assertEquals(tags.title, ["Single Title"]);
    assertEquals(tags.genre, ["Rock", "Pop"]);
    assertEquals(tags.year, 2025);
  });
});

describe("clearTags", () => {
  it("should clear all string fields", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const cleared = await clearTags(new Uint8Array(original));
    const tags = await readTags(cleared);

    const isEmpty = (val: string[] | undefined) =>
      val === undefined || val.length === 0 ||
      val.every((s) => s === "");

    assertEquals(isEmpty(tags.title), true);
    assertEquals(isEmpty(tags.artist), true);
    assertEquals(isEmpty(tags.album), true);
  });
});
