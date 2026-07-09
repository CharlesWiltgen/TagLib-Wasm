/**
 * @fileoverview Raw ID3v2 frame API tests (taglib-b67).
 *
 * Layered: wasm-io boundary tests (WASI), msgpack write-contract tests
 * (WASI), then public-API parity scenarios on both backends.
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import {
  readId3v2FramesFromWasm,
  writeTagsToWasm,
} from "../src/runtime/wasi-adapter/wasm-io.ts";
import { UnsupportedFormatError } from "../src/errors/classes.ts";
import type { ExtendedTag } from "../src/types/tags.ts";
import type { RawId3v2Frame } from "../src/wasm.ts";

const MP3_FIXTURE = "tests/test-files/mp3/kiss-snippet.mp3";
const FLAC_FIXTURE = "tests/test-files/flac/kiss-snippet.flac";

describe("readId3v2FramesFromWasm (wasm-io boundary)", () => {
  it("returns a TIT2 frame after a title write", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const tagged = writeTagsToWasm(
      wasi,
      buffer,
      { title: "Frame Test" } as unknown as ExtendedTag,
    );
    assert(tagged, "seeding title via writeTagsToWasm failed");
    const frames = readId3v2FramesFromWasm(wasi, tagged);
    const tit2 = frames.filter((f: RawId3v2Frame) => f.id === "TIT2");
    assertEquals(tit2.length, 1);
    assert(tit2[0].data.length > 0, "TIT2 body must be non-empty");
    assert(tit2[0].data instanceof Uint8Array);
  });

  it("id filter returns only matching frames", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const tagged = writeTagsToWasm(
      wasi,
      buffer,
      { title: "T", artist: "A" } as unknown as ExtendedTag,
    );
    assert(tagged);
    const frames = readId3v2FramesFromWasm(wasi, tagged, "TPE1");
    assert(frames.length >= 1);
    assert(frames.every((f: RawId3v2Frame) => f.id === "TPE1"));
  });

  it("MP3 without an ID3v2 tag yields an empty array (not an error)", async () => {
    using wasi = await loadWasiHost({});
    // bitrate-mode fixtures are tagless LAME frames
    const bare = await Deno.readFile(
      "tests/test-files/mp3/bitrate-mode/no-xing.mp3",
    );
    assertEquals(readId3v2FramesFromWasm(wasi, bare), []);
  });

  it("non-MP3 buffer throws UnsupportedFormatError", async () => {
    using wasi = await loadWasiHost({});
    const flac = await Deno.readFile(FLAC_FIXTURE);
    assertThrows(
      () => readId3v2FramesFromWasm(wasi, flac),
      UnsupportedFormatError,
    );
  });
});
