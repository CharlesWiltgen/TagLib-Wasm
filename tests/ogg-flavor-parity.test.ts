/// <reference lib="deno.ns" />

/**
 * @fileoverview Ogg flavors: getFormat() distinguishes Vorbis, FLAC, Speex and
 * Opus inside the Ogg container.
 *
 * `FileType` declares "OGG" (Vorbis), "OggFLAC" and "SPEEX" as distinct
 * members (src/types/audio-formats.ts), but both backends reported "OGG" for
 * FLAC-in-Ogg and Speex, making the two declared members unreachable and an
 * Ogg FLAC file indistinguishable from Ogg Vorbis through `getFormat()`
 * (taglib-f6a3).
 *
 * The WASI shim reports container "OGG" with codec "FLAC"/"Speex" for those
 * branches (src/capi/taglib_audio_props.cpp:146-159); the Emscripten binding
 * maps TagLib::Ogg::FLAC::File / Ogg::Speex::File to the OGG file type
 * (build/taglib_embind.cpp, post-35c7621). The fix derives the file type from
 * the reported codec on WASI and splits the container mapping on Emscripten.
 *
 * Fixtures are 2s of kiss-snippet run through ffmpeg + flac --ogg / speexenc;
 * regenerate with `tests/test-files/_gen/make-codec-identity-fixtures.sh`.
 *
 * Observed failing against the pre-fix sources/binaries (2026-09-18): both
 * backends returned "OGG" for kiss-snippet-flac.oga and kiss-snippet.spx — see
 * the ticket's recorded output.
 */

import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { forEachBackend } from "./backend-adapter.ts";

const FIXTURE_DIR = join("tests", "test-files");

/** One case per Ogg sub-codec, all four sharing the OGG container. */
const CASES = [
  {
    file: join("ogg", "kiss-snippet.ogg"),
    ext: "ogg",
    format: "OGG",
    codec: "Vorbis",
    isLossless: false,
  },
  {
    file: join("oga", "kiss-snippet-flac.oga"),
    ext: "oga",
    format: "OggFLAC",
    codec: "FLAC",
    isLossless: true,
  },
  {
    file: join("speex", "kiss-snippet.spx"),
    ext: "spx",
    format: "SPEEX",
    codec: "Speex",
    isLossless: false,
  },
  {
    file: join("opus", "kiss-snippet.opus"),
    ext: "opus",
    format: "OPUS",
    codec: "Opus",
    isLossless: false,
  },
] as const;

forEachBackend("Ogg flavor labels", (adapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  for (const { file, ext, format, codec, isLossless } of CASES) {
    it(`reports ${format} for ${file}`, async () => {
      const buffer = await Deno.readFile(join(FIXTURE_DIR, file));

      const props = await adapter.readExtendedAudioProperties(buffer, ext);
      assertEquals(props.containerFormat, "OGG");
      assertEquals(props.codec, codec);
      assertEquals(props.isLossless, isLossless);

      assertEquals(await adapter.readFormat(buffer, ext), format);
    });
  }
});
