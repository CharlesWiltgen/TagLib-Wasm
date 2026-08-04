/**
 * @fileoverview EBU R128 loudness (RFC 7845) typed properties (taglib-2ii2).
 *
 * R128_TRACK_GAIN / R128_ALBUM_GAIN are Vorbis comment fields whose values
 * are signed Q7.8 integers (dB x 256, e.g. -573 = -2.23828125 dB). The raw
 * property surface passes the integer through verbatim (like ReplayGain);
 * the typed surface (ExtendedTag/readTags/TagInput) carries DECIBEL numbers
 * with the Q7.8 conversion, lossless for file-derived values.
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { applyTags, readTags } from "../src/simple/index.ts";
import {
  mapPropertiesToExtendedTag,
  normalizeTagInput,
} from "../src/utils/tag-mapping.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
const OTHER: Record<string, "wasi" | "emscripten"> = {
  wasi: "emscripten",
  emscripten: "wasi",
};

// RFC 7845's own example: -573 Q7.8 == -2.23828125 dB.
const INT_TRACK = "-573";
const DB_TRACK = -573 / 256; // -2.23828125
const INT_ALBUM = "-331";
const DB_ALBUM = -331 / 256;

describe("R128 Q7.8 conversion (taglib-2ii2)", () => {
  it("read: Q7.8 int -> decibel number", () => {
    const tag = mapPropertiesToExtendedTag({
      R128_TRACK_GAIN: [INT_TRACK],
      R128_ALBUM_GAIN: [INT_ALBUM],
    });
    assertEquals(tag.r128TrackGain, DB_TRACK);
    assertEquals(tag.r128AlbumGain, DB_ALBUM);
  });

  it("write: decibel number -> Q7.8 int, rounded", () => {
    const props = normalizeTagInput({ r128TrackGain: DB_TRACK });
    assertEquals(props.r128TrackGain, [INT_TRACK]);
  });

  it("write: -7.03 dB rounds to -1800", () => {
    const props = normalizeTagInput({ r128TrackGain: -7.03 });
    assertEquals(props.r128TrackGain, ["-1800"]);
  });

  it("write: string[] passes the raw wire integer verbatim", () => {
    const props = normalizeTagInput({ r128AlbumGain: [INT_ALBUM] });
    assertEquals(props.r128AlbumGain, [INT_ALBUM]);
  });

  it("absent when not present", () => {
    const tag = mapPropertiesToExtendedTag({ TITLE: ["Kiss"] });
    assertEquals(tag.r128TrackGain, undefined);
    assertEquals(tag.r128AlbumGain, undefined);
  });
});

async function rawRoundTrip(
  backend: "wasi" | "emscripten",
  format: "opus" | "flac" | "wma",
): Promise<{
  readBack: Record<string, string[]>;
  sameHandle: Record<string, string[]>;
  buffer: Uint8Array;
}> {
  const src = await Deno.readFile(FIXTURE_PATH[format]);
  const tl = await TagLib.initialize({ forceWasmType: backend });
  const file = await tl.open(new Uint8Array(src));
  file.setProperties({
    R128_TRACK_GAIN: [INT_TRACK],
    R128_ALBUM_GAIN: [INT_ALBUM],
  });
  file.save();
  const buf = file.getFileBuffer();
  const sameHandle = file.properties() as Record<string, string[]>;
  file.dispose();

  const tlR = await TagLib.initialize({ forceWasmType: OTHER[backend] });
  const reopened = await tlR.open(buf);
  const readBack = reopened.properties() as Record<string, string[]>;
  reopened.dispose();
  return { readBack, sameHandle, buffer: buf };
}

describe("R128 raw property round-trip (taglib-2ii2)", () => {
  for (const backend of BACKENDS) {
    it(`[${backend}] R128 gains survive save and read back verbatim on the other backend`, async () => {
      const { readBack, sameHandle, buffer } = await rawRoundTrip(
        backend,
        "opus",
      );
      // properties() presents known keys in camelCase (like ReplayGain);
      // the Q7.8 integers survive verbatim.
      assertEquals(readBack.r128TrackGain, [INT_TRACK]);
      assertEquals(readBack.r128AlbumGain, [INT_ALBUM]);
      assertEquals(sameHandle.r128TrackGain, [INT_TRACK]);
      // Wire check at the byte level: the OpusTags comment fields are named
      // exactly R128_TRACK_GAIN / R128_ALBUM_GAIN with the raw integer values.
      const text = new TextDecoder().decode(buffer);
      assert(text.includes("R128_TRACK_GAIN=-573"));
      assert(text.includes("R128_ALBUM_GAIN=-331"));
    });

    it(`[${backend}] typed read narrows the Q7.8 int to decibels`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.opus);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ R128_TRACK_GAIN: [INT_TRACK] });
      file.save();
      const tag = mapPropertiesToExtendedTag(file.properties());
      assertEquals(tag.r128TrackGain, DB_TRACK);
      file.dispose();
    });

    it(`[${backend}] clearing removes the attribute entirely`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.opus);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ R128_TRACK_GAIN: [INT_TRACK] });
      file.save();
      file.setProperties({ R128_TRACK_GAIN: [] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const tlR = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const reopened = await tlR.open(buf);
      const props = reopened.properties() as Record<string, string[]>;
      assertEquals(props.R128_TRACK_GAIN, undefined);
      reopened.dispose();
    });
  }

  it("flac (Vorbis comment) carries R128 the same way", async () => {
    const { readBack } = await rawRoundTrip("wasi", "flac");
    assertEquals(readBack.r128AlbumGain, [INT_ALBUM]);
  });

  it("wma carries R128 via the ASF unknown-attribute path (taglib-984r)", async () => {
    const { readBack } = await rawRoundTrip("wasi", "wma");
    assertEquals(readBack.r128TrackGain, [INT_TRACK]);
  });
});

describe("R128 typed simple-API round-trip (taglib-2ii2)", () => {
  it("applyTags(dB number) -> readTags returns the exact decibel value", async () => {
    const src = await Deno.readFile(FIXTURE_PATH.opus);
    const modified = await applyTags(src, { r128TrackGain: DB_TRACK });
    const tags = await readTags(modified);
    assertEquals(tags.r128TrackGain, DB_TRACK);
    // The wire value is the exact Q7.8 integer, not a rounded approximation.
    const tl = await TagLib.initialize();
    const file = await tl.open(modified);
    const raw = file.properties() as Record<string, string[]>;
    assertEquals(raw.r128TrackGain, [INT_TRACK]);
    file.dispose();
  });

  it("readTags -> applyTags round-trips the integer losslessly", async () => {
    const src = await Deno.readFile(FIXTURE_PATH.opus);
    const tags = await readTags(src);
    const withGain = await applyTags(src, {
      ...tags,
      r128TrackGain: -573 / 256,
    });
    const back = await readTags(withGain);
    assertEquals(back.r128TrackGain, -573 / 256);
  });
});
