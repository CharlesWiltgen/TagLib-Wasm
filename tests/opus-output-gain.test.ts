/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { TagLib } from "../src/taglib.ts";
import type { TypedAudioProperties } from "../src/types/audio-formats.ts";

// Compile-time: the OPUS branch of TypedAudioProperties carries
// `outputGainDb: number` (required after narrowing, not `number | undefined`).
const _typecheck: TypedAudioProperties<"OPUS">["outputGainDb"] = 0;
void _typecheck;

const OPUS_DIR = join("tests", "test-files", "opus");
const BACKENDS = ["wasi", "emscripten"] as const;

async function audioProps(backend: typeof BACKENDS[number], file: string) {
  const taglib = await TagLib.initialize({ forceWasmType: backend });
  const buffer = await Deno.readFile(join(OPUS_DIR, file));
  const f = await taglib.open(buffer);
  try {
    return f.audioProperties() as Record<string, unknown> | undefined;
  } finally {
    f.dispose();
  }
}

for (const backend of BACKENDS) {
  // kiss-snippet-gain.opus is kiss-snippet.opus with the OpusHead output-gain
  // field patched to raw Q7.8 -1280 == -5.0 dB (see make-gain-fixture.py).
  Deno.test(`[${backend}] Opus outputGainDb reflects OpusHead gain (-5 dB)`, async () => {
    const p = await audioProps(backend, "kiss-snippet-gain.opus");
    assertEquals(p?.outputGainDb, -5);
  });

  // The unmodified snippet has the usual zero gain — proves the field is
  // present and parsed for real-world Opus files, not just patched ones.
  Deno.test(`[${backend}] Opus outputGainDb is 0 for a normal Opus file`, async () => {
    const p = await audioProps(backend, "kiss-snippet.opus");
    assertEquals(p?.outputGainDb, 0);
  });

  // Non-Opus files must not carry the field at all.
  Deno.test(`[${backend}] non-Opus file has no outputGainDb`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const buffer = await Deno.readFile(
      join("tests", "test-files", "flac", "kiss-snippet.flac"),
    );
    const f = await taglib.open(buffer);
    try {
      const p = f.audioProperties() as Record<string, unknown> | undefined;
      assertEquals("outputGainDb" in (p ?? {}), false);
    } finally {
      f.dispose();
    }
  });

  // The field is OpusHead gain — an Ogg-Opus structure. An MP4 carrying an
  // Opus track reports codec "Opus" but has no OpusHead, so the key must stay
  // absent (the Emscripten adapter used to fabricate 0 for any codec=="Opus"
  // file once the MP4 codec enum was mapped; WASI never did).
  Deno.test(`[${backend}] MP4 with an Opus track has no outputGainDb`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const buffer = await Deno.readFile(
      join("tests", "test-files", "mp4", "opus.m4a"),
    );
    const f = await taglib.open(buffer);
    try {
      const p = f.audioProperties() as Record<string, unknown> | undefined;
      assertEquals(p?.codec, "Opus");
      assertEquals(p?.containerFormat, "MP4");
      assertEquals("outputGainDb" in (p ?? {}), false);
    } finally {
      f.dispose();
    }
  });
}
