/**
 * @fileoverview Tests for multi-value Tag string fields (zm5).
 * Tag string fields (title, artist, album, comment, genre) always return string[].
 * Write functions accept both string and string[] via TagInput.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  applyTags,
  clearTags,
  getTagLib,
  readTags,
  setBufferMode,
} from "../src/simple/index.ts";
import { TagLib } from "../src/taglib.ts";
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

describe("applyTags with TagInput", () => {
  it("should accept single strings", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const input: Partial<TagInput> = { title: "New Title" };

    const modified = await applyTags(new Uint8Array(original), input);
    assertExists(modified);

    const tags = await readTags(modified);
    assertEquals(tags.title, ["New Title"]);
  });

  it("should accept string arrays", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const input: Partial<TagInput> = {
      artist: ["Artist One", "Artist Two"],
    };

    const modified = await applyTags(new Uint8Array(original), input);
    assertExists(modified);

    const tags = await readTags(modified);
    assertEquals(tags.artist, ["Artist One", "Artist Two"]);
  });

  it("should clear field when writing empty array", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTags(new Uint8Array(original), {
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
    const modified = await applyTags(new Uint8Array(original), {
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

    const modified = await applyTags(new Uint8Array(original), input);
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

describe("applyTags with extended fields", () => {
  it("should roundtrip extended string fields via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTags(new Uint8Array(original), {
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
    const modified = await applyTags(new Uint8Array(original), {
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
    const modified = await applyTags(new Uint8Array(original), {
      compilation: false,
    });

    const taglib = await getTagLib();
    using audioFile = await taglib.open(modified);
    const props = audioFile.properties();
    assertEquals(props.compilation, ["0"]);
  });

  it("should roundtrip MusicBrainz and ReplayGain fields via simple API", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTags(new Uint8Array(original), {
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
    const modified = await applyTags(new Uint8Array(original), {
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

const BACKENDS = ["wasi", "emscripten"] as const;

// Formats whose multi-value genre must round-trip in EXACT order. wma is
// covered by a write-side rotation compensation for TagLib's ASF render
// (taglib-ilrg): the render splits a multi-value attribute across the
// Extended Content Description and Metadata Library objects, which parse
// back as a left rotation; the shim applies the inverse on write. If a
// TagLib bump ever fixes the render, the wma instances here go red and the
// compensation must be removed.
const ORDER_PRESERVING_FORMATS = [
  "mp3",
  "m4a",
  "flac",
  "ogg",
  "opus",
  "wv",
  "tta",
  "wav",
  "mka",
  "wma",
] as const;

describe("multi-genre round-trip per format (parity)", () => {
  for (const backend of BACKENDS) {
    for (const format of ORDER_PRESERVING_FORMATS) {
      it(`[${backend}] ${format}: genre ["Pop","Rock"] round-trips in order`, async () => {
        const tl = await TagLib.initialize({ forceWasmType: backend });
        const src = await Deno.readFile(FIXTURE_PATH[format]);
        const file = await tl.open(new Uint8Array(src));
        file.setProperties({ genre: ["Pop", "Rock"] });
        file.save();
        const buf = file.getFileBuffer();
        file.dispose();

        // Read with the OTHER backend so the WASI same-handle cache can
        // never echo un-persisted state.
        const tlR = await TagLib.initialize({
          forceWasmType: backend === "wasi" ? "emscripten" : "wasi",
        });
        const reopened = await tlR.open(buf);
        const props = reopened.properties() as Record<string, string[]>;
        reopened.dispose();
        assertEquals(props.genre, ["Pop", "Rock"]);
      });
    }
  }
});

describe("ASF multi-value rotation compensation (taglib-ilrg)", () => {
  for (const backend of BACKENDS) {
    it(`[${backend}] wma 3-value genre round-trips in exact order`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ genre: ["Pop", "Rock", "Jazz"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const tlR = await TagLib.initialize({
        forceWasmType: backend === "wasi" ? "emscripten" : "wasi",
      });
      const reopened = await tlR.open(buf);
      const props = reopened.properties() as Record<string, string[]>;
      reopened.dispose();
      // TagLib's ASF render+parse left-rotates multi-value attributes by one
      // ([A,B,C] -> [B,C,A]); the write-side compensation must restore the
      // exact order. A naive reversal would give [A,C,B] here.
      assertEquals(props.genre, ["Pop", "Rock", "Jazz"]);
    });

    it(`[${backend}] wma no-op save keeps multi-value order stable`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ genre: ["Pop", "Rock"] });
      file.save();
      const once = file.getFileBuffer();
      file.dispose();

      const tl2 = await TagLib.initialize({
        forceWasmType: backend === "wasi" ? "emscripten" : "wasi",
      });
      const second = await tl2.open(once);
      second.save(); // no-op: no property changed
      const twice = second.getFileBuffer();
      second.dispose();

      const tl3 = await TagLib.initialize({
        forceWasmType: backend === "wasi" ? "emscripten" : "wasi",
      });
      const third = await tl3.open(twice);
      const props = third.properties() as Record<string, string[]>;
      third.dispose();
      assertEquals(props.genre, ["Pop", "Rock"]);
    });
  }
});

describe("embedded-null single-string multi-value (taglib-ktfn)", () => {
  it("'Pop\\0Rock' via setProperty writes byte-identical TCON on both backends and reads back both values", async () => {
    const written: Uint8Array[] = [];
    for (const backend of BACKENDS) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const src = await Deno.readFile(FIXTURE_PATH.mp3);
      const file = await tl.open(new Uint8Array(src));
      file.setProperty("genre", "Pop\u0000Rock");
      file.save();
      const buf = file.getFileBuffer();
      const tcon = file.getId3v2Frames("TCON");
      const body = tcon.length === 1
        ? new Uint8Array(tcon[0].data)
        : new Uint8Array(0);
      file.dispose();
      written.push(body);
      assertEquals(
        new TextDecoder().decode(body),
        "\u0003Pop\u0000Rock",
        `${backend} truncated the value after the embedded null`,
      );
      // The saved file must read back BOTH values (cross-backend read).
      const tlR = await TagLib.initialize({
        forceWasmType: backend === "wasi" ? "emscripten" : "wasi",
      });
      const reopened = await tlR.open(buf);
      const props = reopened.properties() as Record<string, string[]>;
      reopened.dispose();
      assertEquals(props.genre, ["Pop", "Rock"]);
    }
    assertEquals(
      written[0],
      written[1],
      "backends produced different TCON bytes for the same input",
    );
  });
});
