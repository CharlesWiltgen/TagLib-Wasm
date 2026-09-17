/// <reference lib="deno.ns" />

/**
 * @fileoverview Ogg flavors beyond Vorbis/Opus: FLAC-in-Ogg and Speex.
 *
 * The WASI shim maps all four Ogg branches to container "OGG" and reports the
 * codec (src/capi/taglib_audio_props.cpp:146-159). The Emscripten binding knew
 * only Ogg::Vorbis and Ogg::Opus, so FLAC-in-Ogg and Speex fell through to
 * "unknown" for both codec and container (taglib-irp8).
 *
 * Backend instances: the Emscripten instance is the defect. The WASI instance
 * is a BASELINE asserting cross-backend agreement — it already passed before
 * the fix, so it cannot fail on this defect.
 *
 * Fixtures are 2s of kiss-snippet run through ffmpeg + flac --ogg / speexenc;
 * regenerate with `tests/test-files/_gen/make-codec-identity-fixtures.sh`.
 *
 * Observed failing against the pre-fix binaries (2026-09-17): the Emscripten
 * instances read container "unknown" (with codec and format "unknown") for both
 * fixtures under the committed build/taglib-web.wasm (sha256 149ab5d1…). The
 * WASI baseline passed under the committed build/taglib-wasi.wasm (3a33b89d…).
 */

import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { forEachBackend } from "./backend-adapter.ts";

const FIXTURE_DIR = join("tests", "test-files");

const CASES = [
  {
    file: join("oga", "kiss-snippet-flac.oga"),
    ext: "oga",
    codec: "FLAC",
    isLossless: true,
  },
  {
    file: join("speex", "kiss-snippet.spx"),
    ext: "spx",
    codec: "Speex",
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

  for (const { file, ext, codec, isLossless } of CASES) {
    it(`reports ${codec} in an Ogg container for ${file}`, async () => {
      const buffer = await Deno.readFile(join(FIXTURE_DIR, file));

      const props = await adapter.readExtendedAudioProperties(buffer, ext);
      assertEquals(props.containerFormat, "OGG");
      assertEquals(props.codec, codec);
      assertEquals(props.isLossless, isLossless);

      assertEquals(await adapter.readFormat(buffer, ext), "OGG");
    });
  }
});
