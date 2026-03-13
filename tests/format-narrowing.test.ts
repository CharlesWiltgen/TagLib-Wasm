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
import type { TypedAudioProperties } from "../src/types/audio-formats.ts";
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
    taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
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

describe("TypedAudioProperties narrowing", () => {
  describe("type-level tests", () => {
    it("MP3 requires mpegVersion and mpegLayer", () => {
      void ((_p: TypedAudioProperties<"MP3">) => {
        const _version: number = _p.mpegVersion;
        const _layer: number = _p.mpegLayer;
        void [_version, _layer];
      });
    });

    it("AIFF has no extra required fields", () => {
      void ((_p: TypedAudioProperties<"AIFF">) => {
        const _mpegVersion: number | undefined = _p.mpegVersion;
        void _mpegVersion;
      });
    });

    it("MP4 requires isEncrypted", () => {
      void ((_p: TypedAudioProperties<"MP4">) => {
        const _encrypted: boolean = _p.isEncrypted;
        void _encrypted;
      });
    });

    it("ASF requires isEncrypted", () => {
      void ((_p: TypedAudioProperties<"ASF">) => {
        const _encrypted: boolean = _p.isEncrypted;
        void _encrypted;
      });
    });

    it("APE requires formatVersion", () => {
      void ((_p: TypedAudioProperties<"APE">) => {
        const _version: number = _p.formatVersion;
        void _version;
      });
    });

    it("WAV has no extra required fields", () => {
      void ((_p: TypedAudioProperties<"WAV">) => {
        // @ts-expect-error: mpegVersion is optional on WAV, not assignable to number
        const _mpegVersion: number = _p.mpegVersion;
        // @ts-expect-error: isEncrypted is optional on WAV, not assignable to boolean
        const _isEncrypted: boolean = _p.isEncrypted;
        // @ts-expect-error: formatVersion is optional on WAV, not assignable to number
        const _formatVersion: number = _p.formatVersion;
        void [_mpegVersion, _isEncrypted, _formatVersion];
      });
    });

    it("FLAC has no extra required fields", () => {
      void ((_p: TypedAudioProperties<"FLAC">) => {
        const _mpegVersion: number | undefined = _p.mpegVersion;
        void _mpegVersion;
      });
    });

    it("TypedAudioFile audioProperties returns narrowed type", () => {
      void ((_f: TypedAudioFile<"MP3">) => {
        const props = _f.audioProperties();
        if (props) {
          const _version: number = props.mpegVersion;
          const _layer: number = props.mpegLayer;
          void [_version, _layer];
        }
      });
    });
  });

  for (
    const backend of ["wasi", "emscripten"] as const
  ) {
    describe(`runtime tests (${backend})`, () => {
      let taglib: TagLib;

      beforeAll(async () => {
        taglib = await TagLib.initialize({ forceWasmType: backend });
      });

      it("MP3 audioProperties has mpegVersion after isFormat narrowing", async () => {
        if (!fileExists(FIXTURE_PATH.mp3)) return;
        const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
        using file = await taglib.open(buffer);
        if (file.isFormat("MP3")) {
          const props = file.audioProperties();
          assert(props !== undefined);
          assertEquals(typeof props.mpegVersion, "number");
          assertEquals(typeof props.mpegLayer, "number");
        }
      });

      it("MP4 audioProperties has isEncrypted after isFormat narrowing", async () => {
        if (!fileExists(FIXTURE_PATH.m4a)) return;
        const buffer = await Deno.readFile(FIXTURE_PATH.m4a);
        using file = await taglib.open(buffer);
        if (file.isFormat("MP4")) {
          const props = file.audioProperties();
          assert(props !== undefined);
          assertEquals(typeof props.isEncrypted, "boolean");
        }
      });
    });
  }
});
