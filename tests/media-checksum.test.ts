/**
 * @fileoverview `mediaChecksum()` across both backends: tag-edit stability per
 * format, frame-edit sensitivity, FLAC's PCM digest, and the whole-file
 * fallback's honesty about what it hashed. The last group covers the Simple
 * API, where a path and a buffer must describe the same file.
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import {
  type BackendAdapter,
  forEachBackend,
  HAS_EMSCRIPTEN,
  HAS_WASI,
} from "./backend-adapter.ts";
import {
  flacStreamInfoMd5,
  mediaRanges,
  walkWav,
} from "../src/taglib/media-ranges.ts";
import type { ByteRange } from "../src/taglib/media-ranges.ts";
import { mediaChecksum } from "../src/taglib/audio-file-checksum.ts";
import { getPlatformIO } from "../src/runtime/platform-io.ts";
import type { PlatformIO } from "../src/runtime/platform-io.ts";
import { MetadataError, UnsupportedFormatError } from "../src/errors.ts";
import { TagLib } from "../src/taglib.ts";
import { readMediaChecksum } from "../src/simple/index.ts";

const CASES: Array<[string, string]> = [
  ["mp3", "tests/test-files/mp3/kiss-snippet.mp3"],
  ["flac", "tests/test-files/flac/kiss-snippet.flac"],
  ["m4a", "tests/test-files/mp4/kiss-snippet.m4a"],
  ["wav", "tests/test-files/wav/kiss-snippet.wav"],
];

// The two fixtures the groups below open by path. `basis: "pcm"` resolves the
// digest through the handle's *source*, so the handle has to be the thing that
// supplies the bytes — on WASI a path handle holds none at all.
const FLAC_PATH = "tests/test-files/flac/kiss-snippet.flac";
const MP3_PATH = "tests/test-files/mp3/kiss-snippet.mp3";

/** Hex SHA-256 of a byte string: what this file's assertions compare in. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** `sha256Hex` over a walk's ranges, joined by hand — the test-side statement of
 * what hashing some *other* bytes would produce, without the module's private
 * `joinRanges`. */
async function hashRanges(
  bytes: Uint8Array,
  ranges: ByteRange[],
): Promise<string> {
  const payload = new Uint8Array(ranges.reduce((n, r) => n + r.length, 0));
  let at = 0;
  for (const r of ranges) {
    payload.set(bytes.subarray(r.offset, r.offset + r.length), at);
    at += r.length;
  }
  return await sha256Hex(payload);
}

forEachBackend("mediaChecksum", (adapter: BackendAdapter) => {
  beforeAll(async () => {
    await adapter.init();
  });
  afterAll(async () => {
    await adapter.dispose();
  });

  for (const [ext, path] of CASES) {
    it(`survives a tag edit on ${ext}`, async () => {
      const original = Deno.readFileSync(path);
      const before = await adapter.mediaChecksum(original, ext);
      assertEquals(before.source, "audio-payload");
      const edited = await adapter.writeTags(original, {
        title: "Checksum Spike",
      }, ext);
      assertExists(edited, `${ext}: writeTags returned null`);
      const after = await adapter.mediaChecksum(edited, ext);
      assertEquals(
        after.hex,
        before.hex,
        `${ext}: hash must survive a tag edit`,
      );
      assertEquals(
        after.bytesHashed,
        before.bytesHashed,
        `${ext}: bytesHashed`,
      );
    });
  }

  it("changes when a payload byte changes", async () => {
    const original = Deno.readFileSync("tests/test-files/wav/kiss-snippet.wav");
    const before = await adapter.mediaChecksum(original, "wav");
    const range = walkWav(original).ranges[0]; // the derived range, not a guess
    const mutated = original.slice();
    mutated[range.offset + 10] ^= 0xff;
    assertNotEquals(
      (await adapter.mediaChecksum(mutated, "wav")).hex,
      before.hex,
    );
  });

  it("checksums ADTS/AAC as payload, not as a file", async () => {
    const aac = Deno.readFileSync("tests/test-files/aac/empty1s.aac");
    const sum = await adapter.mediaChecksum(aac, "aac");
    // The fixture is exactly the payload (TagLib asserts last frame 136 + 11 =
    // 147 at test_mpeg.cpp:165-171), so `bytesHashed` alone cannot distinguish a
    // walk from a whole-file fallback — but `source` can, and must: a walk that
    // cannot see ADTS headers answers "file" here. Task 2's oracle pins the range.
    assertEquals(sum.source, "audio-payload");
    assertEquals(sum.bytesHashed, 147);
  });

  it("returns FLAC's STREAMINFO digest for basis: pcm, and throws elsewhere", async () => {
    const flac = Deno.readFileSync("tests/test-files/flac/kiss-snippet.flac");
    const pcm = await adapter.mediaChecksum(flac, "flac", { basis: "pcm" });
    assertEquals(pcm.source, "flac-streaminfo-md5");
    assertEquals(pcm.algorithm, "md5");
    assertEquals(pcm.bytesHashed, 16);
    const mp3 = Deno.readFileSync("tests/test-files/mp3/kiss-snippet.mp3");
    await assertRejects(
      () => adapter.mediaChecksum(mp3, "mp3", { basis: "pcm" }),
      UnsupportedFormatError,
    );
  });

  // The docs page's reworded guarantee: FLAC's STREAMINFO MD5 digests the
  // *uncompressed* stream, so it is tag-stable in exactly the way the encoded
  // payload is — a tag write must not move it, and only `source: "file"` is the
  // weaker promise. That is this test's whole claim; a tag write that DID move
  // the digest would mean TagLib re-encoded the stream on save, i.e. the doc
  // would be wrong rather than this test.
  it("keeps FLAC's STREAMINFO digest across a tag edit", async () => {
    const flac = Deno.readFileSync(FLAC_PATH);
    const before = await adapter.mediaChecksum(flac, "flac", { basis: "pcm" });
    assertEquals(before.source, "flac-streaminfo-md5");
    const edited = await adapter.writeTags(
      flac,
      { title: "Checksum Spike" },
      "flac",
    );
    assertExists(edited, "flac: writeTags returned null");
    // Not decoration: if the write returned the input bytes (or dropped the
    // tag), the stability assertion below would hold for the wrong reason.
    assertEquals(
      (await adapter.readTags(edited, "flac")).title,
      "Checksum Spike",
      "the tag edit must actually have landed",
    );
    const after = await adapter.mediaChecksum(edited, "flac", { basis: "pcm" });
    assertEquals(
      after.hex,
      before.hex,
      "a tag edit must not move the STREAMINFO digest",
    );
    assertEquals(after.bytesHashed, 16);
  });

  it("falls back to a whole-file hash, and the fallback is honest about it", async () => {
    const ogg = Deno.readFileSync("tests/test-files/ogg/kiss-snippet.ogg");
    const sum = await adapter.mediaChecksum(ogg, "ogg");
    assertEquals(sum.source, "file");
    assertEquals(sum.bytesHashed, ogg.length);
    // The spec's fallback-honesty guard: the weaker guarantee means a tag edit
    // DOES move this hash, where source: "audio-payload" promises it cannot.
    const edited = await adapter.writeTags(
      ogg,
      { title: "Checksum Spike" },
      "ogg",
    );
    assertExists(edited, "ogg: writeTags returned null");
    assertNotEquals(
      (await adapter.mediaChecksum(edited, "ogg")).hex,
      sum.hex,
      "a whole-file hash must change when the file changes",
    );
  });

  // The adapter tests above hand the module a buffer, so they cannot see the
  // source rule at work. These two run through the AudioFile surface, where the
  // handle — not the caller — owns the bytes: on WASI a path handle holds none
  // at all, so `basis: "pcm"` can only answer from a header window or a file
  // read, and the encoded route can only answer by reading the file back.
  it("resolves the digest for an AudioFile opened from a path", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: adapter.kind });
    const path = resolve(FLAC_PATH);
    const file = await taglib.open(path);
    try {
      if (adapter.kind === "wasi") {
        // A precondition, not decoration: this group exists to cover the handle
        // that holds no bytes, so if WASI ever starts keeping the file in memory
        // this fails instead of quietly asserting something weaker. The one
        // private field this file reaches for — and it is the claim itself.
        const handle = (file as unknown as {
          fileHandle: { getBuffer(): Uint8Array };
        }).fileHandle;
        assertEquals(
          handle.getBuffer().length,
          0,
          "WASI path mode must hold no bytes",
        );
      }

      const pcm = await file.mediaChecksum({ basis: "pcm" });
      assertEquals(pcm.source, "flac-streaminfo-md5");
      assertEquals(pcm.algorithm, "md5");
      assertEquals(pcm.bytesHashed, 16);
      // The value comes from the file's own STREAMINFO block, read by
      // flacStreamInfoMd5 — not from the bytes the handle happens to hold.
      assertEquals(pcm.hex, flacStreamInfoMd5(Deno.readFileSync(path)));

      // Same file, encoded basis, through the same handle: the digest must equal
      // the one the buffer route answers, or the path route read something else.
      const fromPath = await file.mediaChecksum();
      const fromBuffer = await adapter.mediaChecksum(
        Deno.readFileSync(path),
        "flac",
      );
      assertEquals(fromPath.source, "audio-payload");
      assertEquals(fromPath.hex, fromBuffer.hex);
    } finally {
      file.dispose();
    }
  });

  it("rejects basis: pcm off FLAC through the AudioFile surface", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: adapter.kind });
    const file = await taglib.open(resolve(MP3_PATH));
    try {
      await assertRejects(
        () => file.mediaChecksum({ basis: "pcm" }),
        UnsupportedFormatError,
      );
    } finally {
      file.dispose();
    }
  });
});

// The source rule, asserted on the module that owns it. The AudioFile surface
// can only build the descriptors its own inputs allow, so `path` → `blob` → the
// caller's bytes → throw is not reachable from a test through it: these are
// synthetic descriptors on purpose, since the point is which source wins.
Deno.test("the source rule prefers the file over the handle's image", async () => {
  const bytes = Deno.readFileSync(MP3_PATH);
  const path = await Deno.makeTempFile({ suffix: ".mp3" });
  try {
    await Deno.writeFile(path, bytes);
    const io = getPlatformIO();
    const fromBytes = await mediaChecksum(
      { bytes, partiallyLoaded: false },
      "mp3",
      io,
    );

    // A spliced header+footer image is what a partial handle holds. It must not
    // be what gets hashed while the handle can still reach the real file — a
    // checksum of the image is a checksum of a file that does not exist.
    const image = bytes.slice(0, 1024);
    const viaPath = await mediaChecksum(
      { bytes: image, path, partiallyLoaded: true },
      "mp3",
      io,
    );
    assertEquals(viaPath.hex, fromBytes.hex);
    assertEquals(viaPath.bytesHashed, fromBytes.bytesHashed);

    // No path, but a Blob: the only way back to a partial File's bytes.
    const viaBlob = await mediaChecksum(
      { bytes: image, blob: new Blob([bytes]), partiallyLoaded: true },
      "mp3",
      io,
    );
    assertEquals(viaBlob.hex, fromBytes.hex);

    // Neither: the image would be hashed as a truncated file while the result
    // claims source: "audio-payload", so this case refuses instead.
    await assertRejects(
      () => mediaChecksum({ bytes: image, partiallyLoaded: true }, "mp3", io),
      MetadataError,
    );
  } finally {
    await Deno.remove(path).catch(() => {});
  }
});

// Several ranges, through the digest. `walkMp4`'s rules are pinned in
// tests/media-ranges.test.ts, but nothing there goes from more than one range to
// a *digest*, so an implementation that dropped, reordered or padded a range
// would have passed every test in this repo. Module-level rather than in the
// adapter block above: the fixture is a synthetic container that `TagLib.open()`
// may not accept, while `mediaChecksum` reads bytes it is handed without opening
// anything — the gap is the join, not the walk.
Deno.test("several payload ranges join in order into one digest", async () => {
  const bytes = Deno.readFileSync("tests/test-files/mp4/synth-multi-mdat.mp4");
  const walk = mediaRanges("MP4", bytes);
  assertEquals(walk.kind, "ranges");
  assertEquals(walk.ranges, [
    { offset: 48, length: 32 },
    { offset: 96, length: 24 },
    { offset: 160, length: 16 },
  ]);

  // The expected payload, laid out by hand in walk order — explicit `subarray`
  // calls, never anything the module exports, so the expectation cannot inherit
  // the bug it is meant to catch.
  const expected = new Uint8Array(72);
  expected.set(bytes.subarray(48, 48 + 32), 0);
  expected.set(bytes.subarray(96, 96 + 24), 32);
  expected.set(bytes.subarray(160, 160 + 16), 56);

  // A call whose sources are in hand with no path, no blob and no partial flag
  // must not touch IO at all: the stub throwing on either read is the
  // assertion, and it is cast because the interface's other members are
  // unreachable from here.
  const io = {
    readFile: () => {
      throw new Error("in-hand sources must not read the file");
    },
    readPartial: () => {
      throw new Error("in-hand sources must not read a window");
    },
  } as unknown as PlatformIO;

  const sum = await mediaChecksum(
    { bytes, partiallyLoaded: false },
    "MP4",
    io,
  );
  assertEquals(sum.source, "audio-payload");
  assertEquals(sum.bytesHashed, 72);
  assertEquals(sum.hex, await sha256Hex(expected));
});

/** The digest the synthesized fixture's STREAMINFO block carries. */
const PCM_DIGEST_HEX = "42434445464748494a4b4c4d4e4f5051";

const be32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

function flacBlock(
  type: number,
  isLast: boolean,
  payload: number[],
): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = (isLast ? 0x80 : 0x00) | type;
  out[1] = (payload.length >>> 16) & 0xff;
  out[2] = (payload.length >>> 8) & 0xff;
  out[3] = payload.length & 0xff;
  out.set(payload, 4);
  return out;
}

/**
 * `fLaC`, a STREAMINFO block carrying `PCM_DIGEST_HEX`, an 80 KiB cover picture,
 * then a frame sync: a metadata chain whose implied end runs well past the
 * 64 KiB window a path-mode handle reads. Cover art of this size is ordinary.
 */
function flacWithOversizedMetadata(): Uint8Array {
  const streamInfo = new Array<number>(34).fill(0);
  // The digest sits at payload bytes 18..33 — where the digest lives, and
  // inside the window whatever the rest of the chain declares.
  for (let i = 0; i < 16; i++) streamInfo[18 + i] = 0x42 + i;

  const mime = [...new TextEncoder().encode("image/jpeg")];
  const picture = [
    0x00,
    0x00,
    0x00,
    0x03, // picture type 3 — front cover
    ...be32(mime.length),
    ...mime,
    ...be32(0), // empty description
    ...be32(0),
    ...be32(0),
    ...be32(0),
    ...be32(0), // width, height, depth, colours
    ...be32(80 * 1024),
    ...new Array<number>(80 * 1024).fill(0x5a),
  ];

  const parts = [
    new TextEncoder().encode("fLaC"),
    flacBlock(0, false, streamInfo),
    flacBlock(6, true, picture),
    new Uint8Array([0xff, 0xf8, 0x69, 0x18, 0x00, 0x00]),
  ];
  const out = new Uint8Array(
    parts.reduce((n, part) => n + part.length, 0),
  );
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// The PCM digest comes from FLAC's first metadata block, so it must not depend
// on a range walk of whatever bytes the handle holds: a path-mode handle holds
// none, and the module reads a 64 KiB window instead. A cover picture larger
// than that window makes the metadata chain's *implied* end run past the bytes
// in hand, which is where a walk gives up — even though STREAMINFO, the only
// block the digest needs, is inside the window.
Deno.test("basis: pcm reads STREAMINFO past a metadata chain larger than the header window", async () => {
  const dir = await Deno.makeTempDir();
  const path = resolve(dir, "oversized-metadata.flac");
  const backends = [
    ...(HAS_WASI ? (["wasi"] as const) : []),
    ...(HAS_EMSCRIPTEN ? (["emscripten"] as const) : []),
  ];
  try {
    const fixture = flacWithOversizedMetadata();
    assertEquals(
      fixture.length > 65536,
      true,
      "fixture must exceed the window",
    );
    await Deno.writeFile(path, fixture);

    for (const backend of backends) {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const file = await taglib.open(path);
      try {
        const pcm = await file.mediaChecksum({ basis: "pcm" });
        assertEquals(pcm.source, "flac-streaminfo-md5", backend);
        assertEquals(pcm.hex, PCM_DIGEST_HEX, backend);
        assertEquals(pcm.bytesHashed, 16, backend);
      } finally {
        file.dispose();
      }
    }
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
});

/** ID3v2's syncsafe integer: 28 bits, seven per byte. */
const syncsafe = (value: number): number[] => [
  (value >> 21) & 0x7f,
  (value >> 14) & 0x7f,
  (value >> 7) & 0x7f,
  value & 0x7f,
];

/**
 * A FLAC's own bytes behind a 70,000-byte ID3v2.4 tag: the tag alone is larger
 * than the 64 KiB window a path-mode handle reads, so the `fLaC` marker sits past
 * everything the window can reach. A tag that size is routine once it carries
 * cover art.
 */
function flacBehindLargeId3v2(flac: Uint8Array): Uint8Array {
  const tagLength = 70_000;
  const out = new Uint8Array(tagLength + flac.length);
  // "ID3", version 2.4, no flags, then the size of what follows the 10-byte
  // header — here all padding.
  out.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, ...syncsafe(tagLength - 10)], 0);
  out.set(flac, tagLength);
  return out;
}

// The window is a *header* window, so a tag prepended to the file can push the
// marker out of it — a shape the oversized-*metadata* test above cannot see,
// since there the marker is at offset 0 and only the chain after it is large.
// STREAMINFO is present either way, so the digest must come from a whole-source
// read rather than fail the file.
Deno.test("basis: pcm reads STREAMINFO past a prepended tag larger than the header window", async () => {
  const dir = await Deno.makeTempDir();
  const path = resolve(dir, "large-id3v2.flac");
  const backends = [
    ...(HAS_WASI ? (["wasi"] as const) : []),
    ...(HAS_EMSCRIPTEN ? (["emscripten"] as const) : []),
  ];
  try {
    const flac = Deno.readFileSync(FLAC_PATH);
    const fixture = flacBehindLargeId3v2(flac);
    assertEquals(
      fixture.length > 65536,
      true,
      "fixture must exceed the window",
    );
    await Deno.writeFile(path, fixture);

    // The digest the untagged fixture answers: the prepended tag is not audio,
    // so it must not move the digest.
    const expected = flacStreamInfoMd5(flac);
    assertExists(expected);

    for (const backend of backends) {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const file = await taglib.open(path);
      try {
        const pcm = await file.mediaChecksum({ basis: "pcm" });
        assertEquals(pcm.source, "flac-streaminfo-md5", backend);
        assertEquals(pcm.hex, expected, backend);
        assertEquals(pcm.bytesHashed, 16, backend);
      } finally {
        file.dispose();
      }
    }
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
});

// The Simple API opens the file itself, so both input forms reach a handle that
// describes the same bytes: the digest belongs to the file, not to the input
// form, and that is what makes them agree.
Deno.test("readMediaChecksum accepts a path and a buffer", async () => {
  const byPath = await readMediaChecksum(MP3_PATH);
  const byBuffer = await readMediaChecksum(Deno.readFileSync(MP3_PATH));
  assertEquals(byPath.hex, byBuffer.hex);
  assertEquals(byPath.source, "audio-payload");
});

// A caller's own bytes can sit on a SharedArrayBuffer, and the WASI handle
// stores that view verbatim — so the single-range fast path, which returns a
// `subarray` of the caller's buffer, can hand Web Crypto a shared-buffer view
// it refuses. FLAC walks one range, so it reaches that path. The hash must be
// the same one the ArrayBuffer-backed copy produces, not a TypeError.
Deno.test("a SharedArrayBuffer-backed input hashes like an ordinary buffer", async () => {
  const full = Deno.readFileSync(FLAC_PATH);
  const sab = new Uint8Array(new SharedArrayBuffer(full.length));
  sab.set(full);

  const bySab = await readMediaChecksum(sab);
  const byArrayBuffer = await readMediaChecksum(full);
  assertEquals(bySab.hex, byArrayBuffer.hex);
  assertEquals(bySab.bytesHashed, byArrayBuffer.bytesHashed);
  assertEquals(bySab.source, "audio-payload");
});

// `basis: "pcm"` on the path form: the wrapper hands the open handle a path, so
// this is the input form the digest's source rule has to survive.
Deno.test("readMediaChecksum returns the FLAC PCM digest for basis: pcm", async () => {
  const sum = await readMediaChecksum(FLAC_PATH, { basis: "pcm" });
  assertEquals(sum.source, "flac-streaminfo-md5");
  assertEquals(sum.algorithm, "md5");
  assertEquals(sum.bytesHashed, 16);
});

/**
 * The one fixture large enough to make `TagLib.open` splice a header+footer
 * image out of a `File` instead of reading it whole: the loader's window is
 * 1 MiB + 128 KiB (taglib-class.ts:133-135) and this file clears it by 862
 * bytes. Built by `make-media-range-fixtures.py --large`.
 */
const LARGE_PATH = "tests/test-files/mp3/large-1_2MiB.mp3";

// The spec's item 3 — a File, a Uint8Array and a path must agree — asserted
// where it can actually fail: on a fixture that splices. On a small file the
// loader hands the handle the whole file and all three forms agree by
// construction, which is a parity instance that cannot fail.
Deno.test("a partial handle hashes the file, not its window image", async () => {
  const full = Deno.readFileSync(LARGE_PATH);

  const byBuffer = await readMediaChecksum(full);
  assertEquals(byBuffer.source, "audio-payload");

  // Only the backends this checkout can load: build/taglib-web.js and the WASI
  // dist are build output, so an unconditional loop would die with a wasm-load
  // error where a skip is what the checkout deserves — the convention the
  // repo's own harness follows (tests/backend-adapter.ts exports these flags).
  const backends = [
    ...(HAS_WASI ? (["wasi"] as const) : []),
    ...(HAS_EMSCRIPTEN ? (["emscripten"] as const) : []),
  ];
  assert(backends.length > 0, "no wasm backend available to test");

  for (const forceWasmType of backends) {
    const taglib = await TagLib.initialize({ forceWasmType });
    // A File is what splices: `loadAudioData` cuts a header and a footer window
    // for any File larger than them whose metadata provably fits inside.
    const file = new File([full], "large.mp3");
    using handle = await taglib.open(file);

    const loaded = handle.getFileBuffer();
    assert(
      loaded.length < full.length,
      `${forceWasmType}: fixture did not partial-load (${loaded.length} of ${full.length} bytes) — fix the fixture size or format, not the source rule`,
    );

    const byHandle = await handle.mediaChecksum();
    assertEquals(byHandle.source, "audio-payload", `${forceWasmType}: source`);
    assertEquals(
      byHandle.hex,
      byBuffer.hex,
      `${forceWasmType}: File vs buffer`,
    );

    // The control: the ranges derived from the *image the handle holds*, hashed
    // over that image, must land somewhere else. That is the subtler wrong
    // implementation — deriving ranges from the in-hand bytes instead of the
    // file — which is what a whole-image hash cannot catch: the image is a
    // spliced header+footer, so a correct implementation's digest can only
    // coincide with it by accident (and on this fixture it does not).
    const imageWalk = mediaRanges("MP3", loaded);
    assertNotEquals(
      await hashRanges(loaded, imageWalk.ranges),
      byHandle.hex,
      `${forceWasmType}: derived the ranges from the window image, not the file`,
    );
  }

  // The third input form the spec's item 3 names.
  assertEquals(
    (await readMediaChecksum(LARGE_PATH)).hex,
    byBuffer.hex,
    "path vs buffer",
  );
});
