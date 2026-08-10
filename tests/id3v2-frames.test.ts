/**
 * @fileoverview Raw ID3v2 frame API tests (taglib-b67).
 *
 * Layered: wasm-io boundary tests (WASI), msgpack write-contract tests
 * (WASI), then public-API parity scenarios on both backends.
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import fc from "fast-check";
import { describe, it } from "@std/testing/bdd";
import { encode } from "@msgpack/msgpack";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import {
  readId3v2FramesFromWasm,
  writeTagsToWasm,
} from "../src/runtime/wasi-adapter/wasm-io.ts";
import {
  MetadataError,
  UnsupportedFormatError,
} from "../src/errors/classes.ts";
import type { ExtendedTag } from "../src/types/tags.ts";
import type { RawId3v2Frame } from "../src/wasm.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import type { WasiModule } from "../src/runtime/wasmer-sdk-loader/types.ts";
import { TagLib } from "../src/taglib.ts";
import type { Id3v2Frame } from "../index.ts";

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

  it("a filter shorter than 4 chars matches nothing (no over-read)", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const tagged = writeTagsToWasm(
      wasi,
      buffer,
      { title: "T" } as unknown as ExtendedTag,
    );
    assert(tagged);
    assertEquals(readId3v2FramesFromWasm(wasi, tagged, "TP"), []);
  });
});

/** tl_write_tags with hand-encoded msgpack (bypasses encodeTagData). */
function writeRawTagBytes(
  wasi: WasiModule,
  fileData: Uint8Array,
  tagBytes: Uint8Array,
): Uint8Array | null {
  using arena = new WasmArena(wasi as WasmExports);
  const inputBuf = arena.allocBuffer(fileData);
  const tagBuf = arena.allocBuffer(tagBytes);
  const outBufPtr = arena.allocUint32();
  const outSizePtr = arena.allocUint32();
  const result = wasi.tl_write_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    tagBuf.ptr,
    tagBuf.size,
    outBufPtr.ptr,
    outSizePtr.ptr,
  );
  if (result !== 0) return null;
  const ptr = outBufPtr.readUint32();
  const size = outSizePtr.readUint32();
  if (!ptr || !size) return null;
  const u8 = new Uint8Array(wasi.memory.buffer);
  const out = new Uint8Array(u8.slice(ptr, ptr + size));
  wasi.free(ptr);
  return out;
}

describe("apply_id3v2_frames_from_msgpack (write contract)", () => {
  it("writes two TXXX frames byte-identically via per-ID replace", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const body1 = new Uint8Array([0x03, 0x41, 0x00, 0x42]); // enc, "A", 0, "B"
    const body2 = new Uint8Array([0x03, 0x58, 0x00, 0x59, 0x5a]);
    const out = writeRawTagBytes(
      wasi,
      buffer,
      encode({ id3v2Frames: { TXXX: [body1, body2] } }),
    );
    assert(out, "raw write failed");
    const frames = readId3v2FramesFromWasm(wasi, out, "TXXX");
    assertEquals(frames.length, 2);
    assertEquals([...frames[0].data], [...body1]);
    assertEquals([...frames[1].data], [...body2]);
  });

  it("an unmodeled vendor frame (RGAD) round-trips byte-identically", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const body = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01]);
    const out = writeRawTagBytes(
      wasi,
      buffer,
      encode({ id3v2Frames: { RGAD: [body] } }),
    );
    assert(out);
    const frames = readId3v2FramesFromWasm(wasi, out, "RGAD");
    assertEquals(frames.length, 1);
    assertEquals([...frames[0].data], [...body]);
  });

  it("empty list removes all frames with that ID and preserves others", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const seeded = writeRawTagBytes(
      wasi,
      buffer,
      encode({
        id3v2Frames: {
          RGAD: [new Uint8Array([1, 2])],
          NCON: [new Uint8Array([3, 4])],
        },
      }),
    );
    assert(seeded);
    const removed = writeRawTagBytes(
      wasi,
      seeded,
      encode({ id3v2Frames: { RGAD: [] } }),
    );
    assert(removed);
    assertEquals(readId3v2FramesFromWasm(wasi, removed, "RGAD"), []);
    // Content, not count: a count-only guard stays green while the payload
    // is destroyed (AGENTS.md observed-failing doctrine).
    assertEquals(
      [...readId3v2FramesFromWasm(wasi, removed, "NCON")[0].data],
      [3, 4],
    );
  });

  it("unrelated typed writes preserve existing raw frames", async () => {
    using wasi = await loadWasiHost({});
    const buffer = await Deno.readFile(MP3_FIXTURE);
    const seeded = writeRawTagBytes(
      wasi,
      buffer,
      encode({ id3v2Frames: { NCON: [new Uint8Array([9, 9, 9])] } }),
    );
    assert(seeded);
    const titled = writeTagsToWasm(
      wasi,
      seeded,
      { title: "New Title" } as unknown as ExtendedTag,
    );
    assert(titled);
    const ncon = readId3v2FramesFromWasm(wasi, titled, "NCON");
    assertEquals(ncon.length, 1);
    assertEquals([...ncon[0].data], [9, 9, 9]);
  });
});

// Both backends: the parity matrix for the raw ID3v2 frame API.
const BACKENDS = ["wasi", "emscripten"] as const;

async function openMp3(backend: typeof BACKENDS[number]) {
  const taglib = await TagLib.initialize({ forceWasmType: backend });
  return {
    taglib,
    file: await taglib.open(await Deno.readFile(MP3_FIXTURE)),
  };
}

for (const backend of BACKENDS) {
  Deno.test(`[${backend}] set/save/reopen round-trips vendor frames byte-identically`, async () => {
    const { taglib, file } = await openMp3(backend);
    const body = new Uint8Array([0x10, 0x20, 0x30]);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("RGAD", [body]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    try {
      const frames: Id3v2Frame[] = reopened.getId3v2Frames("RGAD");
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [...body]);
    } finally {
      reopened.dispose();
    }
  });

  Deno.test(`[${backend}] get after set reflects pending (unsaved) raw writes`, async () => {
    const { file } = await openMp3(backend);
    try {
      const body = new Uint8Array([7, 7]);
      file.setId3v2Frames("NCON", [body]);
      const frames = file.getId3v2Frames("NCON");
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [...body]);
    } finally {
      file.dispose();
    }
  });

  // M5: WASI's staged-frame read used to return the staged Uint8Array by
  // reference, so mutating a returned frame's data corrupted internal staged
  // state for later reads/saves. Embind already returns fresh copies.
  Deno.test(`[${backend}] mutating a returned staged frame does not corrupt staged state`, async () => {
    const { file } = await openMp3(backend);
    try {
      const body = new Uint8Array([1, 2, 3]);
      file.setId3v2Frames("NCON", [body]);
      const first = file.getId3v2Frames("NCON");
      first[0].data[0] = 0xff; // mutate the returned copy
      const second = file.getId3v2Frames("NCON");
      assertEquals([...second[0].data], [1, 2, 3]);
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] removeId3v2Frames deletes all instances of the ID`, async () => {
    const { taglib, file } = await openMp3(backend);
    let out: Uint8Array;
    try {
      // Owner-prefixed bodies: PRIV re-normalizes its owner+data framing, so
      // bare payloads would collapse to indistinguishable frames — a count
      // assertion would be the only surviving check (the ast-grep proxy rule).
      file.setId3v2Frames("PRIV", [
        new Uint8Array([0x41, 0x00, 0x01]), // owner "A", data [1]
        new Uint8Array([0x42, 0x00, 0x02]), // owner "B", data [2]
      ]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    let out2: Uint8Array;
    try {
      // Content, not count: both seeded owners AND payloads must survive the
      // round-trip (a count-only guard stays green while payloads are lost).
      assertEquals(
        reopened.getId3v2Frames("PRIV").map((f) => [...f.data]),
        [[65, 0, 1], [66, 0, 2]],
      );
      reopened.removeId3v2Frames("PRIV");
      assertEquals(reopened.getId3v2Frames("PRIV"), []);
      reopened.save();
      out2 = reopened.getFileBuffer();
    } finally {
      reopened.dispose();
    }
    const final = await taglib.open(out2);
    try {
      assertEquals(final.getId3v2Frames("PRIV"), []);
    } finally {
      final.dispose();
    }
  });

  Deno.test(`[${backend}] getId3v2Frames() without ID lists standard frames too`, async () => {
    const { file } = await openMp3(backend);
    try {
      file.tag().setTitle("List Test");
      file.save();
      const all = file.getId3v2Frames();
      assert(all.some((f) => f.id === "TIT2"));
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] invalid frame IDs and empty bodies throw typed errors`, async () => {
    const { file } = await openMp3(backend);
    try {
      assertThrows(
        () => file.setId3v2Frames("bad!", [new Uint8Array([1])]),
        MetadataError,
      );
      assertThrows(() => file.getId3v2Frames("toolong"), MetadataError);
      assertThrows(
        () => file.setId3v2Frames("PRIV", [new Uint8Array(0)]),
        MetadataError,
      );
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] non-MP3 files throw UnsupportedFormatError`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const file = await taglib.open(await Deno.readFile(FLAC_FIXTURE));
    try {
      assertThrows(() => file.getId3v2Frames(), UnsupportedFormatError);
      assertThrows(
        () => file.setId3v2Frames("RGAD", [new Uint8Array([1])]),
        UnsupportedFormatError,
      );
    } finally {
      file.dispose();
    }
  });
}

/** Build a minimal ID3v2.3 tag holding one unknown frame, prepended to MP3 audio. */
function buildV23TaggedMp3(audio: Uint8Array): Uint8Array {
  const body = new Uint8Array([0xaa, 0xbb, 0xcc]);
  // v2.3 frame: 4-byte ID + 4-byte PLAIN size (not syncsafe) + 2 flag bytes
  const frame = new Uint8Array(10 + body.length);
  frame.set(new TextEncoder().encode("NCON"), 0);
  new DataView(frame.buffer).setUint32(4, body.length, false);
  frame.set(body, 10);
  // v2.3 header: "ID3" 03 00 flags=0 + syncsafe tag size
  const tagSize = frame.length;
  const header = new Uint8Array([
    0x49,
    0x44,
    0x33,
    0x03,
    0x00,
    0x00,
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ]);
  const out = new Uint8Array(header.length + frame.length + audio.length);
  out.set(header, 0);
  out.set(frame, header.length);
  out.set(audio, header.length + frame.length);
  return out;
}

for (const backend of BACKENDS) {
  Deno.test(`[${backend}] SYTC write/read round-trip (unblocks taglib-hxq)`, async () => {
    const { taglib, file } = await openMp3(backend);
    // SYTC body: timestamp format 0x02 (ms), one tempo change: 120 BPM at 0 ms
    const sytc = new Uint8Array([0x02, 0x78, 0x00, 0x00, 0x00, 0x00]);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("SYTC", [sytc]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    try {
      const frames = reopened.getId3v2Frames("SYTC");
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [...sytc]);
    } finally {
      reopened.dispose();
    }
  });

  Deno.test(`[${backend}] raw TIT2 write is readable as title after save+reload (spec caveat 1)`, async () => {
    const { taglib, file } = await openMp3(backend);
    // TIT2 body: encoding 0x03 (UTF-8) + text
    const body = new Uint8Array([
      0x03,
      ...new TextEncoder().encode("Raw Title"),
    ]);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("TIT2", [body]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    try {
      assertEquals(reopened.tag().title, "Raw Title");
    } finally {
      reopened.dispose();
    }
  });

  // I3: "raw and typed writes compose last-write-wins" is FALSE for
  // raw-then-typed on the same ID. tag.title = "..." calls
  // ID3v2::Tag::setTextFrame(), which does front()->setText() on the existing
  // frame object — a no-op on the raw UnknownFrame — so the typed write is
  // silently discarded and the raw bytes persist through save+reload. See the
  // 2026-07-09 implementation-phase amendment in
  // docs/superpowers/specs/2026-07-09-raw-id3v2-frames-design.md.
  Deno.test(`[${backend}] raw-then-typed write to the same ID: raw wins (I3 spec amendment)`, async () => {
    const { taglib, file } = await openMp3(backend);
    const body = new Uint8Array([
      0x03,
      ...new TextEncoder().encode("Raw Wins"),
    ]);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("TIT2", [body]);
      file.tag().setTitle("Typed Loses");
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    try {
      assertEquals(reopened.tag().title, "Raw Wins");
    } finally {
      reopened.dispose();
    }
  });

  Deno.test(`[${backend}] raw COMM write survives save when the typed comment is empty (C1)`, async () => {
    const { taglib, file } = await openMp3(backend);
    // kiss-snippet.mp3 ships with comment == "" (no COMM frame), the exact
    // condition that let MPEG::File's default Duplicate sync clobber a raw
    // write via ID3v1<->ID3v2 comment mirroring before the C1 fix.
    // Body must be a syntactically valid COMM payload (encoding + 3-byte
    // language + description + \0 + text) — TagLib's frame factory
    // reconstructs a CommentsFrame from these bytes on reopen, so an
    // arbitrary/malformed body would legitimately reparse differently.
    const body = new Uint8Array([
      0x00,
      ...new TextEncoder().encode("eng"),
      0x00,
      ...new TextEncoder().encode("Raw Comment"),
    ]);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("COMM", [body]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    try {
      const frames = reopened.getId3v2Frames("COMM");
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [...body]);
    } finally {
      reopened.dispose();
    }
  });

  Deno.test(`[${backend}] unrelated raw write does not disable ID3v1 title sync`, async () => {
    const { taglib, file } = await openMp3(backend);
    let out: Uint8Array;
    try {
      file.tag().setTitle("Sync Check");
      file.setId3v2Frames("PRIV", [new Uint8Array([1, 2, 3])]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    let v1Only: Uint8Array;
    try {
      reopened.stripId3Tags({ v1: false, v2: true });
      reopened.save();
      v1Only = reopened.getFileBuffer();
    } finally {
      reopened.dispose();
    }
    const v1File = await taglib.open(v1Only);
    try {
      assertEquals(v1File.tag().title, "Sync Check");
    } finally {
      v1File.dispose();
    }
  });

  Deno.test(`[${backend}] removing all raw mapped frames restores ID3v1 sync`, async () => {
    const { taglib, file } = await openMp3(backend);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("TIT2", [new Uint8Array([0x03, 0x58])]);
      file.removeId3v2Frames("TIT2");
      file.tag().setTitle("Restored Sync");
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    let v1Only: Uint8Array;
    try {
      reopened.stripId3Tags({ v1: false, v2: true });
      reopened.save();
      v1Only = reopened.getFileBuffer();
    } finally {
      reopened.dispose();
    }
    const v1File = await taglib.open(v1Only);
    try {
      assertEquals(v1File.tag().title, "Restored Sync");
    } finally {
      v1File.dispose();
    }
  });

  Deno.test(`[${backend}] v2.3-sourced unknown frame survives load (implementation-phase pin)`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    // Strip any existing tag first: use a tagless fixture as the audio body.
    const audio = await Deno.readFile(
      "tests/test-files/mp3/bitrate-mode/no-xing.mp3",
    );
    const file = await taglib.open(buildV23TaggedMp3(audio));
    try {
      const frames = file.getId3v2Frames("NCON");
      // EXPECTED: TagLib's v2.3→v2.4 in-memory conversion preserves unknown
      // frames as UnknownFrame. If this fails, TagLib DROPS unconvertible
      // v2.3 unknown frames: flip the assertion to pin the drop
      // (assertEquals(frames.length, 0)) AND add the caveat to the docs task.
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [0xaa, 0xbb, 0xcc]);
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] frame body bytes round-trip (property)`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const buffer = await Deno.readFile(MP3_FIXTURE);
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 2048 }),
        async (body) => {
          const file = await taglib.open(buffer);
          let out: Uint8Array;
          try {
            file.setId3v2Frames("XXXX", [body]);
            file.save();
            out = file.getFileBuffer();
          } finally {
            file.dispose();
          }
          const reopened = await taglib.open(out);
          try {
            const frames = reopened.getId3v2Frames("XXXX");
            return frames.length === 1 &&
              frames[0].data.length === body.length &&
              frames[0].data.every((b, i) => b === body[i]);
          } finally {
            reopened.dispose();
          }
        },
      ),
      // 40 runs/backend: each run is a full wasm save+parse cycle (~10ms);
      // data integrity here is byte-copying, not algorithmic, so the
      // 1000-run tier for pure-JS roundtrips would buy nothing but time.
      { numRuns: 40 },
    );
  });
}

// Spec test item "flags read from a frame with flags set": hand-build a
// v2.4 tag whose frame carries the tag-alter-preservation status flag
// (0x40 in header byte 8 — safe: unlike compression/grouping bits it does
// not change the body layout).
function buildV24FlaggedMp3(audio: Uint8Array): Uint8Array {
  const body = new Uint8Array([0x01, 0x02, 0x03]);
  const frame = new Uint8Array(10 + body.length);
  frame.set(new TextEncoder().encode("NCON"), 0);
  frame.set(
    [
      (body.length >> 21) & 0x7f,
      (body.length >> 14) & 0x7f,
      (body.length >> 7) & 0x7f,
      body.length & 0x7f,
    ],
    4,
  ); // v2.4 syncsafe frame size
  frame[8] = 0x40; // status flags: tag-alter-preservation
  frame[9] = 0x00;
  frame.set(body, 10);
  const tagSize = frame.length;
  const header = new Uint8Array([
    0x49,
    0x44,
    0x33,
    0x04,
    0x00,
    0x00,
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ]);
  const out = new Uint8Array(header.length + frame.length + audio.length);
  out.set(header, 0);
  out.set(frame, header.length);
  out.set(audio, header.length + frame.length);
  return out;
}

for (const backend of BACKENDS) {
  // TagLib structural limitation, not a shim bug: Frame::Header::render() in
  // lib/taglib/taglib/mpeg/id3v2/id3v2frame.cpp hardcodes blank flag bytes
  // ("just blank for the moment", per TagLib's own comment) whenever a frame
  // is re-rendered, so header flags read from disk can never survive through
  // to the msgpack boundary on either backend. `flags?` stays in the public
  // `Id3v2Frame` type for forward-compat (a future TagLib fix or a shim that
  // reads flags pre-render would populate it) but is currently never set.
  Deno.test(`[${backend}] frame header flags are not surfaced (TagLib blanks flags at render)`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const audio = await Deno.readFile(
      "tests/test-files/mp3/bitrate-mode/no-xing.mp3",
    );
    const file = await taglib.open(buildV24FlaggedMp3(audio));
    try {
      const frames = file.getId3v2Frames("NCON");
      assertEquals(frames.length, 1);
      assertEquals(frames[0].flags, undefined);
    } finally {
      file.dispose();
    }
  });
}

// Registry survival (behavioral): staged raw frames must ride the
// save-as reconstruct (saveViaFreshHandle → copyExtraState → the
// "id3v2Frames" EXTRA_FIELDS entry). Mirrors the taglib-cd0 save-as
// scenario in tests/audio-file-save.test.ts:115.
Deno.test("[wasi] staged raw frames survive save-as reconstruct (extra-state registry)", async () => {
  const taglib = await TagLib.initialize({ forceWasmType: "wasi" });
  const dir = await Deno.makeTempDir();
  try {
    const src = `${dir}/src.mp3`;
    const dst = `${dir}/dst.mp3`;
    await Deno.copyFile(MP3_FIXTURE, src);
    const body = new Uint8Array([0x51, 0x52]);
    const file = await taglib.open(src); // path mode on WASI
    try {
      file.setId3v2Frames("RGAD", [body]);
      await file.saveToFile(dst); // save-as → saveViaFreshHandle reconstruct
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(dst);
    try {
      const frames = reopened.getId3v2Frames("RGAD");
      assertEquals(frames.length, 1);
      assertEquals([...frames[0].data], [...body]);
    } finally {
      reopened.dispose();
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// C2: same registry survival scenario as above, but on Emscripten with an
// explicitly partial-loaded source. Before the fix, wrapEmbindHandle had no
// getStagedId3v2Frames, so the "id3v2Frames" EXTRA_FIELDS entry silently
// no-op'd on saveViaFreshHandle's partial-load reconstruct path, dropping
// the raw write.
Deno.test(
  "[emscripten] staged raw frames survive a partial-load save-as reconstruct (C2)",
  async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const dir = await Deno.makeTempDir();
    try {
      const dst = `${dir}/dst.mp3`;
      const body = new Uint8Array([0x61, 0x62]);
      const file = await taglib.open(MP3_FIXTURE, {
        partial: true,
        maxHeaderSize: 4096,
        maxFooterSize: 1024,
      });
      try {
        file.setId3v2Frames("RGAD", [body]);
        await file.saveToFile(dst); // save-as → saveViaFreshHandle reconstruct
      } finally {
        file.dispose();
      }
      const reopened = await taglib.open(dst);
      try {
        const frames = reopened.getId3v2Frames("RGAD");
        assertEquals(frames.length, 1);
        assertEquals([...frames[0].data], [...body]);
      } finally {
        reopened.dispose();
      }
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
);

// Backend-divergence pin for spec Semantics caveat 3: raw reads of a
// modeled ID after a pending typed edit differ by backend (ADR-001 class).
// Decode a TIT2 body's text portion (skip the 1-byte text-encoding marker).
// The fixture's persisted title and the pending edit below are both plain
// ASCII, so a Latin1/UTF-8 decode is unambiguous either way.
function decodeTit2Text(body: Uint8Array): string {
  return new TextDecoder().decode(body.subarray(1));
}

Deno.test("read-freshness for modeled IDs is pinned per backend (spec caveat 3)", async () => {
  const results: Record<string, string> = {};
  for (const backend of BACKENDS) {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const file = await taglib.open(await Deno.readFile(MP3_FIXTURE));
    try {
      file.tag().setTitle("Pending Edit");
      // No save. Embind mutates live C++ state; WASI stages into tagData.
      const frames = file.getId3v2Frames("TIT2");
      assertEquals(frames.length, 1);
      results[backend] = decodeTit2Text(frames[0].data);
    } finally {
      file.dispose();
    }
  }
  // Embind: live tag already carries the pending mutation.
  assertEquals(results["emscripten"], "Pending Edit");
  // WASI: lazy read sees the fixture's persisted title, not the staged
  // (unsaved) typed edit — this is the actual read/write divergence spec
  // caveat 3 describes; a frame-count comparison alone can't distinguish it
  // from "both backends return 1 frame for unrelated reasons."
  assertEquals(results["wasi"], "Kiss");
});
