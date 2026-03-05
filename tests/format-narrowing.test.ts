/**
 * @fileoverview Type-level and runtime tests for format-specific property key narrowing.
 *
 * Type-level tests use @ts-expect-error to verify that invalid property keys
 * are rejected at compile time. Runtime tests verify isFormat() behavior.
 */

import { assert, assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { TypedAudioFile } from "../src/taglib/audio-file-interface.ts";
import type { FormatPropertyKey } from "../src/types/format-property-keys.ts";
import { TagLib } from "../src/taglib.ts";
import { fileExists, FIXTURE_PATH } from "./shared-fixtures.ts";

describe("FormatPropertyKey type narrowing", () => {
  describe("MP3 (ID3v2)", () => {
    it("accepts basic and ID3v2-supported properties", () => {
      void ((_f: TypedAudioFile<"MP3">) => {
        _f.getProperty("title");
        _f.getProperty("artist");
        _f.getProperty("albumArtist");
        _f.getProperty("composer");
        _f.getProperty("bpm");
        _f.getProperty("musicbrainzTrackId");
        _f.getProperty("replayGainTrackGain");
      });
    });

    it("rejects Vorbis-only properties", () => {
      void ((_f: TypedAudioFile<"MP3">) => {
        // @ts-expect-error: lyricist is Vorbis-only
        _f.getProperty("lyricist");
        // @ts-expect-error: mood is Vorbis-only
        _f.getProperty("mood");
        // @ts-expect-error: publisher is Vorbis-only
        _f.getProperty("publisher");
      });
    });
  });

  describe("WAV", () => {
    it("accepts only basic 7 properties", () => {
      void ((_f: TypedAudioFile<"WAV">) => {
        _f.getProperty("title");
        _f.getProperty("artist");
        _f.getProperty("album");
        _f.getProperty("date");
        _f.getProperty("trackNumber");
        _f.getProperty("genre");
        _f.getProperty("comment");
      });
    });

    it("rejects extended properties", () => {
      void ((_f: TypedAudioFile<"WAV">) => {
        // @ts-expect-error: albumArtist not supported on WAV
        _f.getProperty("albumArtist");
        // @ts-expect-error: bpm not supported on WAV
        _f.getProperty("bpm");
        // @ts-expect-error: discNumber not supported on WAV
        _f.getProperty("discNumber");
      });
    });
  });

  describe("FLAC (Vorbis)", () => {
    it("accepts all properties including Vorbis-exclusive", () => {
      void ((_f: TypedAudioFile<"FLAC">) => {
        _f.getProperty("title");
        _f.getProperty("albumArtist");
        _f.getProperty("lyricist");
        _f.getProperty("mood");
        _f.getProperty("publisher");
        _f.getProperty("musicbrainzTrackId");
      });
    });
  });

  describe("MP4", () => {
    it("accepts MP4-supported properties", () => {
      void ((_f: TypedAudioFile<"MP4">) => {
        _f.getProperty("title");
        _f.getProperty("albumArtist");
        _f.getProperty("bpm");
        _f.getProperty("musicbrainzTrackId");
      });
    });

    it("rejects Vorbis-only properties", () => {
      void ((_f: TypedAudioFile<"MP4">) => {
        // @ts-expect-error: lyricist is Vorbis-only
        _f.getProperty("lyricist");
        // @ts-expect-error: mood is Vorbis-only
        _f.getProperty("mood");
      });
    });
  });

  describe("AIFF (shares ID3v2 with MP3)", () => {
    it("accepts same keys as MP3", () => {
      void ((_f: TypedAudioFile<"AIFF">) => {
        _f.getProperty("title");
        _f.getProperty("albumArtist");
        _f.getProperty("replayGainTrackGain");
      });
    });

    it("rejects Vorbis-only properties", () => {
      void ((_f: TypedAudioFile<"AIFF">) => {
        // @ts-expect-error: lyricist is Vorbis-only
        _f.getProperty("lyricist");
      });
    });
  });

  describe("setProperty narrowing", () => {
    it("rejects invalid keys for setProperty on WAV", () => {
      void ((_f: TypedAudioFile<"WAV">) => {
        _f.setProperty("title", "test");
        // @ts-expect-error: albumArtist not supported on WAV
        _f.setProperty("albumArtist", "test");
      });
    });
  });

  describe("FormatPropertyKey utility type", () => {
    it("maps FileType to correct key sets", () => {
      const _mp3Key: FormatPropertyKey<"MP3"> = "albumArtist";
      const _wavKey: FormatPropertyKey<"WAV"> = "title";
      const _flacKey: FormatPropertyKey<"FLAC"> = "lyricist";
      void [_mp3Key, _wavKey, _flacKey];
    });

    it("rejects invalid keys at type level", () => {
      // @ts-expect-error: lyricist not valid for MP3
      const _bad1: FormatPropertyKey<"MP3"> = "lyricist";
      // @ts-expect-error: albumArtist not valid for WAV
      const _bad2: FormatPropertyKey<"WAV"> = "albumArtist";
      void [_bad1, _bad2];
    });
  });
});

describe("isFormat runtime behavior", () => {
  let taglib: TagLib;

  beforeAll(async () => {
    taglib = await TagLib.initialize({ forceBufferMode: true });
  });

  afterAll(() => {
    // TagLib instances don't need explicit disposal
  });

  it("returns true for matching format", async () => {
    if (!fileExists(FIXTURE_PATH.mp3)) return;
    const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
    using file = await taglib.open(buffer);
    assertEquals(file.isFormat("MP3"), true);
  });

  it("returns false for non-matching format", async () => {
    if (!fileExists(FIXTURE_PATH.mp3)) return;
    const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
    using file = await taglib.open(buffer);
    assertEquals(file.isFormat("FLAC"), false);
  });

  it("narrows type for property access after isFormat check", async () => {
    if (!fileExists(FIXTURE_PATH.mp3)) return;
    const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
    using file = await taglib.open(buffer);
    if (file.isFormat("MP3")) {
      const title = file.getProperty("title");
      assert(title === undefined || typeof title === "string");
    }
  });

  it("returns true for FLAC format", async () => {
    if (!fileExists(FIXTURE_PATH.flac)) return;
    const buffer = await Deno.readFile(FIXTURE_PATH.flac);
    using file = await taglib.open(buffer);
    assertEquals(file.isFormat("FLAC"), true);
    assertEquals(file.isFormat("MP3"), false);
  });
});
