/// <reference lib="deno.ns" />

/**
 * @fileoverview FLAC ID3 strip (taglib-y91).
 *
 * Some taggers prepend ID3v2 and/or append ID3v1 tags to FLAC files (FLAC's
 * native metadata format is Vorbis Comments). Decoders skip these spurious
 * tags but they confuse some library tools. These tests verify we can detect
 * and remove them while preserving the file's Vorbis Comments and audio.
 *
 * Fixture is synthesized at runtime by prepending an ID3v2.4 header and
 * appending an ID3v1 trailer to tests/test-files/flac/kiss-snippet.flac.
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { TagLib } from "../src/taglib.ts";

const PLAIN_FLAC = join("tests", "test-files", "flac", "kiss-snippet.flac");
const BACKENDS = ["wasi", "emscripten"] as const;

function syncsafeSize(out: Uint8Array, offset: number, size: number): void {
  out[offset] = (size >> 21) & 0x7F;
  out[offset + 1] = (size >> 14) & 0x7F;
  out[offset + 2] = (size >> 7) & 0x7F;
  out[offset + 3] = size & 0x7F;
}

function makeId3v2(title: string, padding: number): Uint8Array {
  // ID3v2.4 with a real TIT2 frame. A frame-less ID3v2 would get auto-removed
  // by FLAC::File::save() (it strips empty tags), which would defeat partial-
  // strip testing.
  const enc = new TextEncoder().encode(title);
  const frameBodyLen = 1 + enc.length; // 1 encoding byte + UTF-8 text
  const frameLen = 10 + frameBodyLen; // 4 id + 4 size + 2 flags + body
  const payloadLen = frameLen + padding;
  const buf = new Uint8Array(10 + payloadLen);
  // ID3v2.4 header
  buf[0] = 0x49;
  buf[1] = 0x44;
  buf[2] = 0x33; // "ID3"
  buf[3] = 0x04; // version major (2.4)
  buf[4] = 0x00; // version revision
  buf[5] = 0x00; // flags
  syncsafeSize(buf, 6, payloadLen);
  // TIT2 frame
  let o = 10;
  buf[o++] = 0x54;
  buf[o++] = 0x49;
  buf[o++] = 0x54;
  buf[o++] = 0x32; // "TIT2"
  syncsafeSize(buf, o, frameBodyLen);
  o += 4;
  buf[o++] = 0x00;
  buf[o++] = 0x00; // frame flags
  buf[o++] = 0x03; // text encoding: UTF-8
  buf.set(enc, o);
  // remaining bytes stay zero (padding)
  return buf;
}

function makeId3v1(title: string): Uint8Array {
  const buf = new Uint8Array(128);
  buf[0] = 0x54;
  buf[1] = 0x41;
  buf[2] = 0x47; // "TAG"
  const enc = new TextEncoder().encode(title);
  buf.set(enc.subarray(0, Math.min(30, enc.length)), 3);
  buf[127] = 0xFF; // genre = none/unknown
  return buf;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function loadPlainFlac(): Promise<Uint8Array> {
  return await Deno.readFile(PLAIN_FLAC);
}

async function loadFlacWithId3(
  opts: { v1?: boolean; v2?: boolean } = { v1: true, v2: true },
): Promise<Uint8Array> {
  const flac = await loadPlainFlac();
  const parts: Uint8Array[] = [];
  if (opts.v2) parts.push(makeId3v2("y91-id3v2", 32));
  parts.push(flac);
  if (opts.v1) parts.push(makeId3v1("y91-test"));
  return concatBytes(...parts);
}

for (const backend of BACKENDS) {
  Deno.test(
    `[${backend}] FLAC: hasId3Tags returns {v1:false,v2:false} on plain FLAC`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      using f = await taglib.open(await loadPlainFlac());
      assertEquals(f.hasId3Tags(), { v1: false, v2: false });
    },
  );

  Deno.test(
    `[${backend}] FLAC: hasId3Tags detects both v1 and v2`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      using f = await taglib.open(await loadFlacWithId3());
      assertEquals(f.hasId3Tags(), { v1: true, v2: true });
    },
  );

  Deno.test(
    `[${backend}] FLAC: hasId3Tags detects only v2 when v1 absent`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      using f = await taglib.open(await loadFlacWithId3({ v2: true }));
      assertEquals(f.hasId3Tags(), { v1: false, v2: true });
    },
  );

  Deno.test(
    `[${backend}] FLAC: stripId3Tags() removes both`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const f = await taglib.open(await loadFlacWithId3());
      try {
        f.tag().setTitle("kept");
        f.stripId3Tags();
        f.save();
        const out = f.getFileBuffer();
        using reopened = await taglib.open(out);
        assertEquals(reopened.hasId3Tags(), { v1: false, v2: false });
        assertEquals(reopened.tag().title, "kept");
      } finally {
        f.dispose();
      }
    },
  );

  Deno.test(
    `[${backend}] FLAC: stripId3Tags({v1:true,v2:false}) removes only v1`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const f = await taglib.open(await loadFlacWithId3());
      try {
        f.stripId3Tags({ v1: true, v2: false });
        f.save();
        const out = f.getFileBuffer();
        using reopened = await taglib.open(out);
        assertEquals(reopened.hasId3Tags(), { v1: false, v2: true });
      } finally {
        f.dispose();
      }
    },
  );

  Deno.test(
    `[${backend}] non-FLAC: hasId3Tags returns {v1:false,v2:false}`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const mp3Path = join("tests", "test-files", "mp3", "kiss-snippet.mp3");
      using f = await taglib.open(await Deno.readFile(mp3Path));
      assertEquals(f.hasId3Tags(), { v1: false, v2: false });
    },
  );
}
