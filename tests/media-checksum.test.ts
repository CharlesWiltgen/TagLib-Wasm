/**
 * @fileoverview `mediaChecksum()` across both backends: tag-edit stability per
 * format, frame-edit sensitivity, FLAC's PCM digest, and the whole-file
 * fallback's honesty about what it hashed.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { type BackendAdapter, forEachBackend } from "./backend-adapter.ts";
import { flacStreamInfoMd5, walkWav } from "../src/taglib/media-ranges.ts";
import { mediaChecksum } from "../src/taglib/audio-file-checksum.ts";
import { getPlatformIO } from "../src/runtime/platform-io.ts";
import { MetadataError, UnsupportedFormatError } from "../src/errors.ts";
import { TagLib } from "../src/taglib.ts";

const CASES: Array<[string, string]> = [
  ["mp3", "tests/test-files/mp3/kiss-snippet.mp3"],
  ["flac", "tests/test-files/flac/kiss-snippet.flac"],
  ["m4a", "tests/test-files/mp4/kiss-snippet.m4a"],
  ["wav", "tests/test-files/wav/kiss-snippet.wav"],
];

// The two fixtures the surface group opens by path. `basis: "pcm"` resolves the
// digest through the handle's *source*, so the handle has to be the thing that
// supplies the bytes — on WASI a path handle holds none at all.
const FLAC_PATH = "tests/test-files/flac/kiss-snippet.flac";
const MP3_PATH = "tests/test-files/mp3/kiss-snippet.mp3";

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
      // The value comes from the file's own STREAMINFO block, read by the walk —
      // not from the bytes the handle happens to hold.
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
