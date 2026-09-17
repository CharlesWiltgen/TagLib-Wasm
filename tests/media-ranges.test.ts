import { assertEquals } from "@std/assert";
import type { ByteRange } from "../src/taglib/media-ranges.ts";
import {
  flacStreamInfoMd5,
  trailingTagStart,
  walkFlac,
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
