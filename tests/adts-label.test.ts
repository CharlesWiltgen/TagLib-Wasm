/// <reference lib="deno.ns" />

/**
 * @fileoverview ADTS / raw AAC must not be labelled MP3.
 *
 * TagLib parses ADTS through MPEG::File (`MPEG::Header::isADTS()`,
 * lib/taglib/taglib/mpeg/mpegheader.cpp:113-117; fileref.cpp:159 maps the .AAC
 * extension to MPEG::File). Both taglib-wasm shims skipped the isADTS() check
 * and hardcoded codec/container "MP3" for every MPEG::File, so properties of an
 * .aac file claimed to be an MP3 (taglib-v4n).
 *
 * Fixture: lib/taglib's own tests/data/empty1s.aac — 147 bytes, MPEG-4 ADTS
 * AAC-LC, 11.025 kHz, mono.
 *
 * Observed failing against the pre-fix binaries (2026-09-17): with the committed
 * build/taglib-web.wasm (sha256 149ab5d1…) and build/taglib-wasi.wasm
 * (3a33b89d…) both backends read codec "MP3" — and container/format "MP3" too.
 */

import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { forEachBackend } from "./backend-adapter.ts";
import { TagLib } from "../src/taglib.ts";

const FIXTURE = join("tests", "test-files", "aac", "empty1s.aac");

forEachBackend("ADTS / raw AAC labels", (adapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  it("reports codec AAC, container ADTS, and format AAC", async () => {
    const buffer = await Deno.readFile(FIXTURE);

    const props = await adapter.readExtendedAudioProperties(buffer, "aac");
    assertEquals(props.codec, "AAC");
    assertEquals(props.containerFormat, "ADTS");

    assertEquals(await adapter.readFormat(buffer, "aac"), "AAC");
  });
});

// The identity change has a blast radius beyond the labels: gates that keyed on
// FileType "MP3" now see "AAC". Chapter writes were one of them — the guard
// accepted only MP3/MP4, so setChapters (and clearTags, which calls it with [])
// regressed to UnsupportedFormatError on .aac files on BOTH backends, where it
// previously worked (found by independent review; verified against the pre-fix
// binaries, where fmt read "MP3" and this same round-trip succeeded).
for (const backend of ["wasi", "emscripten"] as const) {
  it(`[${backend}] keeps chapter writes working on ADTS`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const file = await taglib.open(await Deno.readFile(FIXTURE));
    let out: Uint8Array;
    try {
      assertEquals(file.getFormat(), "AAC");
      file.setChapters([
        { startTimeMs: 0, title: "A" },
        { startTimeMs: 1000, title: "B" },
      ]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }

    const reopened = await taglib.open(out);
    try {
      assertEquals(reopened.getChapters().map((c) => c.title), ["A", "B"]);
    } finally {
      reopened.dispose();
    }
  });
}
