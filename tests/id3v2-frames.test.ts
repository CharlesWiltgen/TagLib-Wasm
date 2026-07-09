/**
 * @fileoverview Raw ID3v2 frame API tests (taglib-b67).
 *
 * Layered: wasm-io boundary tests (WASI), msgpack write-contract tests
 * (WASI), then public-API parity scenarios on both backends.
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
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
    assertEquals(readId3v2FramesFromWasm(wasi, removed, "NCON").length, 1);
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

// Extended to ["wasi", "emscripten"] when the Embind backend lands (Task 4).
const BACKENDS = ["wasi"] as const;

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

  Deno.test(`[${backend}] removeId3v2Frames deletes all instances of the ID`, async () => {
    const { taglib, file } = await openMp3(backend);
    let out: Uint8Array;
    try {
      file.setId3v2Frames("PRIV", [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]);
      file.save();
      out = file.getFileBuffer();
    } finally {
      file.dispose();
    }
    const reopened = await taglib.open(out);
    let out2: Uint8Array;
    try {
      assertEquals(reopened.getId3v2Frames("PRIV").length, 2);
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
