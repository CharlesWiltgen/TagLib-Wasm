import { assertEquals, assertStringIncludes } from "@std/assert";
import type { ByteRange } from "../src/taglib/media-ranges.ts";
import {
  flacStreamInfoMd5,
  trailingTagStart,
  walkFlac,
  walkMp4,
  walkMpeg,
} from "../src/taglib/media-ranges.ts";

// TagLib's own test data is the oracle: lib/taglib/tests/test_mpeg.cpp:138-139
// asserts lastFrameOffset()==28213 and frameLength()==209 for bladeenc.mp3
// (file size 28422), and :168-169 asserts 136 + 11 == 147 for empty1s.aac.
const ORACLE_DIR = "lib/taglib/tests/data";

const FLAC_DIR = "tests/test-files/flac";

Deno.test("MP3 payload ends exactly at TagLib's asserted last frame boundary", () => {
  const bytes = Deno.readFileSync(`${ORACLE_DIR}/bladeenc.mp3`);
  const walk = walkMpeg(bytes);
  assertEquals(walk.kind, "ranges");
  assertEquals(walk.ranges, [{ offset: 0, length: 28422 }]);
});

// This is the ADTS rule's only end-to-end guard: `empty1s.aac` carries 12
// frames that the MPEG arithmetic cannot see (layer bits 00), so a walk built
// only on `mpegFrameLength` falls back here instead of answering 147.
Deno.test("ADTS/AAC payload matches TagLib's asserted boundary", () => {
  const bytes = Deno.readFileSync(`${ORACLE_DIR}/empty1s.aac`);
  const walk = walkMpeg(bytes);
  assertEquals(walk.kind, "ranges");
  assertEquals(walk.ranges, [{ offset: 0, length: 147 }]);
});

Deno.test("a tags-only file falls back instead of hashing a tail", () => {
  const bytes = Deno.readFileSync("tests/test-files/mp3/tags-only.mp3");
  assertEquals(walkMpeg(bytes).kind, "fallback");
});

// Two facts about one file. The trim finds the APEv2 + ID3v1 tags (start 8208 =
// 8419 − 128-byte ID3v1 − 83-byte APE tag), while the payload range ends at
// 8150 — which is TagLib's asserted lastFrameOffset()==0x1FD6 itself
// (lib/taglib/tests/test_mpeg.cpp:289-295 asserts that offset alone): TagLib's
// lastFrameOffset() is already an exclusive end (mpegfile.cpp:443-455 →
// previousFrameOffset returns position + i + frameLength()). That differs from
// bladeenc.mp3 and empty1s.aac, whose successor-less last frame is pinned as
// lastFrameOffset() + frameLength() (:138-139 → 28213 + 209, :168-169 → 136 +
// 11), because there the asserted offset is the successor-less last frame's own
// start — the test constructs an MPEG::Header at it to read that length. The 58
// bytes between the frame end and the tag start are not frame data, so they are
// deliberately not hashed.
Deno.test("APEv2 + ID3v1 trailers are excluded from the range", () => {
  const bytes = Deno.readFileSync(`${ORACLE_DIR}/ape-id3v1.mp3`);
  assertEquals(trailingTagStart(bytes), 8208);
  assertEquals(walkMpeg(bytes).ranges, [{ offset: 0, length: 8150 }]);
});

/** sha256 over the walk's ranges — the assertion target for tag stability. */
async function payloadHash(
  bytes: Uint8Array,
  ranges: ByteRange[],
): Promise<string> {
  const payload = new Uint8Array(
    ranges.reduce((n, r) => n + r.length, 0),
  );
  let at = 0;
  for (const r of ranges) {
    payload.set(bytes.subarray(r.offset, r.offset + r.length), at);
    at += r.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The headline guarantee: a tag does not change what a FLAC file's audio
// hashes to. Five tag layouts — ID3v2 in front (with and without the v2.4
// footer), ID3v1 and APEv2 behind, and both trailing kinds — must all hash to
// the untagged base's payload.
Deno.test("FLAC tag variants produce identical payload ranges' bytes", async () => {
  const base = Deno.readFileSync(`${FLAC_DIR}/kiss-snippet.flac`);
  const baseWalk = walkFlac(base);
  const baseHash = await payloadHash(base, baseWalk.ranges);
  for (
    const name of [
      "flac-prepended-id3v2.flac",
      "flac-prepended-id3v2-footer.flac",
      "flac-appended-id3v1.flac",
      "flac-appended-ape.flac",
      "flac-both-tags.flac",
    ]
  ) {
    const bytes = Deno.readFileSync(`${FLAC_DIR}/${name}`);
    const walk = walkFlac(bytes);
    assertEquals(walk.kind, "ranges", name);
    assertEquals(await payloadHash(bytes, walk.ranges), baseHash, name);
  }
});

Deno.test("the FLAC walk starts after the block chain and ends at EOF", () => {
  const bytes = Deno.readFileSync(`${FLAC_DIR}/kiss-snippet.flac`);
  // Measured during the spike: marker at 0, first audio byte after the metadata
  // block chain at 323, and no trailing tags, so the range ends at EOF.
  assertEquals(walkFlac(bytes).ranges, [{ offset: 323, length: 245107 }]);
});

Deno.test("FLAC STREAMINFO digest matches metaflac", () => {
  const bytes = Deno.readFileSync(`${FLAC_DIR}/kiss-snippet.flac`);
  // Verified against `metaflac --show-md5sum` during the spike:
  assertEquals(flacStreamInfoMd5(bytes), "ee39b52b9ee2fa1058ebce88297351a9");
});

const MP4_DIR = "tests/test-files/mp4";

Deno.test("MP4 payload is every non-empty top-level mdat, header excluded", () => {
  const bytes = Deno.readFileSync(`${MP4_DIR}/synth-multi-mdat.mp4`);
  // The generator writes seven atoms in this order: ftyp (whole 24), free
  // (whole 16), mdat (32 contents), a 64-bit-size mdat (24 contents), an empty
  // mdat (whole 8), moov (whole 24), mdat (16 contents). An atom's size field
  // counts its header, so the first mdat's contents start at 40 + 8, the 64-bit
  // one's at 80 + 16, and the last one's at 152 + 8 — while the empty mdat at
  // 120..128 contributes nothing.
  assertEquals(walkMp4(bytes).ranges, [
    { offset: 48, length: 32 },
    { offset: 96, length: 24 },
    { offset: 160, length: 16 },
  ]);
});

Deno.test("a real m4a's single mdat is found at its measured offset", () => {
  // Measured during the spike on the repo's own fixture, and re-measured off
  // the atom headers before this test was written: ftyp(32) free(8) mdat(2696)
  // moov(685), so the one mdat's contents start at 48 and run 2688 bytes.
  const bytes = Deno.readFileSync(`${MP4_DIR}/ac3.m4a`);
  assertEquals(walkMp4(bytes).ranges, [{ offset: 48, length: 2688 }]);
});

/** A top-level atom: big-endian size, 4-char type, then `body`. */
function atom(
  size: number,
  type: string,
  body = new Uint8Array(0),
): Uint8Array {
  const bytes = new Uint8Array(8 + body.length);
  new DataView(bytes.buffer).setUint32(0, size, false);
  bytes.set(new TextEncoder().encode(type), 4);
  bytes.set(body, 8);
  return bytes;
}

Deno.test("a size-0 mdat runs to end of file", () => {
  // ftyp (16 bytes) then a 16-byte mdat whose size field is 0: the atom's
  // declared length is everything left, so its contents are the 8 payload bytes
  // after the header.
  const bytes = new Uint8Array([
    ...atom(16, "ftyp", new Uint8Array(8)),
    ...atom(0, "mdat", new Uint8Array(8).fill(7)),
  ]);
  assertEquals(walkMp4(bytes).ranges, [{ offset: 24, length: 8 }]);
});

// Every way the walk can lose track of the byte stream, each one breaking a
// single rule of an otherwise valid file. The stakes are shared: a range that
// ran past the buffer would hash zero padding while bytesHashed counted it as
// payload, and bytes no atom accounts for are not something this walk may call
// audio.
//
// `kind` alone does not discriminate all of these — a walk that loses track
// ends short of EOF too, so the trailing-bytes check shadows several of the
// earlier ones — so each case pins the reason its fallback reports as well.
// That reason is part of the walk's returned contract: the caller threads it
// into its own detail (`"${walked.detail} → whole file"`) rather than inventing
// a message of its own.
Deno.test("MP4 atoms the walk cannot fully account for fall back", () => {
  const synth = Deno.readFileSync(`${MP4_DIR}/synth-multi-mdat.mp4`);
  const patch32 = (at: number, size: number): Uint8Array => {
    const copy = synth.slice();
    new DataView(copy.buffer).setUint32(at, size, false);
    return copy;
  };
  const patch64 = (at: number, size: bigint): Uint8Array => {
    const copy = synth.slice();
    new DataView(copy.buffer).setBigUint64(at, size, false);
    return copy;
  };
  const cases: Array<[string, Uint8Array, string]> = [
    // The first mdat's size field (40 at offset 40) claims 65535 bytes.
    ["a size running past the buffer", patch32(40, 0xFFFF), "oversized"],
    // 4 bytes is less than the 8-byte header that size is meant to include.
    ["a size below its own header", patch32(40, 4), "malformed"],
    // The 64-bit mdat at 80 keeps its size-1 marker while the 16 bytes that
    // marker promises are not there: the buffer ends mid-header.
    ["a truncated 64-bit header", synth.slice(0, 90), "malformed"],
    // A 64-bit size no float64 can hold exactly, so reading it would round the
    // atom's length rather than report it.
    [
      "a 64-bit size past the safe range",
      patch64(88, 2n ** 53n + 1n),
      "malformed",
    ],
    // Four bytes after the last atom, which ends at 176.
    ["trailing bytes", new Uint8Array([...synth, 0, 0, 0, 0]), "trailing"],
    // ftyp + moov and no mdat: a "ranges" answer here would hash nothing.
    [
      "no mdat at all",
      new Uint8Array([
        ...atom(16, "ftyp", new Uint8Array(8)),
        ...atom(8, "moov"),
      ]),
      "no non-empty mdat",
    ],
  ];
  for (const [name, bytes, reason] of cases) {
    const walk = walkMp4(bytes);
    assertEquals(walk.kind, "fallback", name);
    assertStringIncludes(walk.detail, reason, name);
  }
});
