/**
 * @fileoverview Regression guard for taglib-pf2.
 *
 * The Emscripten backend builds with ALLOW_MEMORY_GROWTH (16MB initial /
 * 4GB max). Under Emscripten 6.0.2 the GROWABLE_ARRAYBUFFERS default was
 * auto-enabled, whose resizable heap had an upstream UTF8ToString bug
 * (fixed in 6.0.3, default reverted to 0 for Web API compatibility).
 * Every string tag read goes through that decoding path, so pin it: force
 * heap growth past the initial memory, then round-trip multibyte tags.
 * Looped over both backends per the parity convention.
 */

import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { TagLib } from "../src/taglib.ts";

const INITIAL_HEAP_BYTES = 16 * 1024 * 1024; // Emscripten default, no INITIAL_MEMORY override in build-wasm.sh
const GROWTH_FORCING_BYTES = INITIAL_HEAP_BYTES + 4 * 1024 * 1024;
const MULTIBYTE_TITLE = "テスト🎵 Ünïcode Grôwth";
const MULTIBYTE_ARTIST = "アーティスト 🎤";

/** Minimal valid PCM WAV: 44-byte canonical header + silent data chunk. */
function makeWav(dataBytes: number): Uint8Array {
  const buf = new Uint8Array(44 + dataBytes);
  const dv = new DataView(buf.buffer);
  buf.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  dv.setUint32(4, 36 + dataBytes, true);
  buf.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  buf.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  dv.setUint32(16, 16, true); // fmt chunk size (PCM)
  dv.setUint16(20, 1, true); // audio format: PCM
  dv.setUint16(22, 2, true); // channels
  dv.setUint32(24, 44100, true); // sample rate
  dv.setUint32(28, 44100 * 2 * 2, true); // byte rate
  dv.setUint16(32, 4, true); // block align
  dv.setUint16(34, 16, true); // bits per sample
  buf.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  dv.setUint32(40, dataBytes, true);
  return buf;
}

describe("wasm heap growth", () => {
  it("round-trips multibyte tags after forcing heap growth past initial memory (taglib-pf2)", async () => {
    const wav = makeWav(GROWTH_FORCING_BYTES);
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(wav);
      let roundTripped: Uint8Array;
      try {
        const tag = file.tag();
        tag.setTitle(MULTIBYTE_TITLE);
        tag.setArtist(MULTIBYTE_ARTIST);
        file.save();
        roundTripped = new Uint8Array(file.getFileBuffer());
      } finally {
        file.dispose();
      }

      const reopened = await tl.open(roundTripped);
      try {
        assertEquals(
          { title: reopened.tag().title, artist: reopened.tag().artist },
          { title: MULTIBYTE_TITLE, artist: MULTIBYTE_ARTIST },
          `${backend}: multibyte tags corrupted after heap growth`,
        );
      } finally {
        reopened.dispose();
      }
    }
  });
});
