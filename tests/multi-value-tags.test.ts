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
  getTagLib,
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

describe("applyTagsToBuffer with extended fields", () => {
  it("should roundtrip extended string fields via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      albumArtist: "Various Artists",
      composer: ["Bach", "Handel"],
      conductor: "Karajan",
    });

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.albumArtist, ["Various Artists"]);
    assertEquals(props.composer, ["Bach", "Handel"]);
    assertEquals(props.conductor, ["Karajan"]);
  });

  it("should roundtrip extended numeric and boolean fields via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      bpm: 128,
      discNumber: 2,
      totalTracks: 12,
      totalDiscs: 3,
      compilation: true,
    });

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.bpm, ["128"]);
    assertEquals(props.discNumber, ["2"]);
    assertEquals(props.totalTracks, ["12"]);
    assertEquals(props.totalDiscs, ["3"]);
    assertEquals(props.compilation, ["1"]);
  });

  it("should roundtrip compilation false via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      compilation: false,
    });

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.compilation, ["0"]);
  });

  it("should roundtrip MusicBrainz and ReplayGain fields via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      musicbrainzTrackId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      replayGainTrackGain: "-6.54 dB",
    });

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.musicbrainzTrackId, [
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    ]);
    assertEquals(props.replayGainTrackGain, ["-6.54 dB"]);
  });

  it("should not drop extended fields when mixed with basic fields", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTagsToBuffer(new Uint8Array(original), {
      title: "Test Title",
      artist: "Test Artist",
      albumArtist: "Album Artist",
      bpm: 140,
      year: 2025,
    });

    const tags = await readTags(modified);
    assertEquals(tags.title, ["Test Title"]);
    assertEquals(tags.artist, ["Test Artist"]);
    assertEquals(tags.year, 2025);

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.albumArtist, ["Album Artist"]);
    assertEquals(props.bpm, ["140"]);
  });
});
