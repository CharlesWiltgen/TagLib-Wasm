/// <reference lib="deno.ns" />

/**
 * @fileoverview MP4 codec mapping across the extended Codec enum (taglib 2.3.2).
 *
 * TagLib 2.3.2 detects AC-3/E-AC-3/DTS/FLAC/Opus sample entries in MP4; before
 * that every non-ALAC track read as "AAC" on the WASI shim and "unknown" on
 * Emscripten. Both shims now map the full enum (src/capi/taglib_audio_props.cpp
 * and build/taglib_embind.cpp — twins, kept in sync).
 *
 * Fixtures are 0.2s of silence muxed by ffmpeg; regenerate with
 * `tests/test-files/_gen/make-mp4-codec-fixtures.sh --regen`. DTS has no
 * fixture: ffmpeg's mov muxer cannot emit a dtsc/dtse/dtsh/dtsl sample entry
 * (it falls back to a generic mp4a+esds, which TagLib reads as AAC), so that
 * enum branch is exercised by the same switch without a real file.
 *
 * Observed failing against the pre-fix binaries (2026-09-16): with HEAD's
 * build/taglib-web.wasm (sha256 389636f5…) and build/taglib-wasi.wasm
 * (d4662048…) all eight instances read "AAC"/"unknown" instead.
 */

import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { forEachBackend } from "./backend-adapter.ts";

const FIXTURE_DIR = join("tests", "test-files", "mp4");

const CASES = [
  { file: "ac3.m4a", codec: "AC-3", isLossless: false },
  { file: "eac3.m4a", codec: "E-AC-3", isLossless: false },
  { file: "flac.m4a", codec: "FLAC", isLossless: true },
  { file: "opus.m4a", codec: "Opus", isLossless: false },
] as const;

forEachBackend("MP4 codec mapping", (adapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  for (const { file, codec, isLossless } of CASES) {
    it(`reports ${codec} for an MP4 carrying a ${codec} track`, async () => {
      const buffer = await Deno.readFile(join(FIXTURE_DIR, file));
      const props = await adapter.readExtendedAudioProperties(buffer, "m4a");
      assertEquals(props.containerFormat, "MP4");
      assertEquals(props.codec, codec);
      assertEquals(props.isLossless, isLossless);
    });
  }
});
