import { assertEquals } from "@std/assert";
import type { ByteRange } from "../src/taglib/media-ranges.ts";
import { trailingTagStart, walkMpeg } from "../src/taglib/media-ranges.ts";

// TagLib's own test data is the oracle: lib/taglib/tests/test_mpeg.cpp:135-137
// asserts lastFrameOffset()==28213 and frameLength()==209 for bladeenc.mp3
// (file size 28422), and :165-171 asserts 136 + 11 == 147 for empty1s.aac.
const ORACLE_DIR = "lib/taglib/tests/data";

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
// lastFrameOffset() + frameLength() (:135-137 → 28213 + 209, :165-171 → 136 +
// 11), because there the asserted offset is the successor-less last frame's own
// start — the test constructs an MPEG::Header at it to read that length. The 58
// bytes between the frame end and the tag start are not frame data, so they are
// deliberately not hashed.
Deno.test("APEv2 + ID3v1 trailers are excluded from the range", () => {
  const bytes = Deno.readFileSync(`${ORACLE_DIR}/ape-id3v1.mp3`);
  assertEquals(trailingTagStart(bytes), 8208);
  assertEquals(walkMpeg(bytes).ranges, [{ offset: 0, length: 8150 }]);
});
