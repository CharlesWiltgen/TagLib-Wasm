import { assert, assertEquals, assertRejects } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { describe, it } from "@std/testing/bdd";
import {
  applyTags,
  applyTagsToBuffer,
  clearTags,
  readFormat,
  readTags,
  setBufferMode,
  writeTagsToFile,
} from "../src/simple/index.ts";
import { TagLib } from "../src/taglib.ts";
import { FileOperationError, InvalidFormatError } from "../src/errors.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

setBufferMode(true);

function makeCorruptedBuffer(size = 5000): Uint8Array {
  const buf = new Uint8Array(size);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (i * 17 + 123) % 256;
  }
  return buf;
}

describe("readTags error paths", () => {
  it("should throw InvalidFormatError for corrupted buffer", async () => {
    await assertRejects(
      () => readTags(makeCorruptedBuffer()),
      InvalidFormatError,
    );
  });

  it("should throw InvalidFormatError for tiny buffer", async () => {
    await assertRejects(
      () => readTags(new Uint8Array(10)),
      InvalidFormatError,
    );
  });
});

describe("applyTagsToBuffer", () => {
  it("should throw InvalidFormatError for corrupted buffer", async () => {
    await assertRejects(
      () => applyTagsToBuffer(makeCorruptedBuffer(), { title: "Test" }),
      InvalidFormatError,
    );
  });

  it("should return a valid buffer when applying tags to valid file", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const result = await applyTagsToBuffer(new Uint8Array(original), {
      title: "Modified Title",
    });
    assertInstanceOf(result, Uint8Array);
    assert(result.length > 0);
  });
});

describe("writeTagsToFile error paths", () => {
  it("should throw FileOperationError when given a buffer instead of path", async () => {
    const buffer = new Uint8Array(100);
    await assertRejects(
      // deno-lint-ignore no-explicit-any
      () => writeTagsToFile(buffer as any, { title: "Test" }),
      FileOperationError,
      "requires a file path string",
    );
  });

  it("should throw FileOperationError when given an ArrayBuffer instead of path", async () => {
    const buffer = new ArrayBuffer(100);
    await assertRejects(
      // deno-lint-ignore no-explicit-any
      () => writeTagsToFile(buffer as any, { title: "Test" }),
      FileOperationError,
      "requires a file path string",
    );
  });
});

describe("clearTags", () => {
  it("should clear extended fields and pictures, not just basic 7", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);

    // First, write extended fields
    const withExtended = await applyTagsToBuffer(new Uint8Array(original), {
      title: "Test Title",
      artist: "Test Artist",
      albumArtist: "Various Artists",
      composer: "Test Composer",
      musicbrainzTrackId: "abc-123",
      replayGainTrackGain: "-6.54 dB",
    });

    // Add a picture
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const withPicture = await taglib.edit(withExtended, (file) => {
      file.addPicture({
        mimeType: "image/png",
        data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
        type: "FrontCover",
      });
    });

    // Now clear tags
    const cleared = await clearTags(withPicture);

    // Verify ALL tags are cleared
    const verifyFile = await taglib.open(cleared);
    try {
      assertEquals(verifyFile.tag().title, "");
      assertEquals(verifyFile.tag().artist, "");
      assertEquals(verifyFile.getProperty("ALBUMARTIST"), undefined);
      assertEquals(verifyFile.getProperty("COMPOSER"), undefined);
      assertEquals(verifyFile.getProperty("MUSICBRAINZ_TRACKID"), undefined);
      assertEquals(verifyFile.getProperty("REPLAYGAIN_TRACK_GAIN"), undefined);
      assertEquals(verifyFile.getPictures().length, 0);
    } finally {
      verifyFile.dispose();
    }
  });
});

describe("readTags extended fields", () => {
  it("should return extended fields from readTags", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const withExtended = await applyTagsToBuffer(new Uint8Array(original), {
      title: "Test Title",
      albumArtist: "Various Artists",
      composer: "Test Composer",
      discNumber: 2,
      totalTracks: 12,
      bpm: 128,
      compilation: true,
      musicbrainzTrackId: "abc-123",
      replayGainTrackGain: "-6.54 dB",
    });

    const tags = await readTags(withExtended);
    assertEquals(tags.title, ["Test Title"]);
    // Extended fields should now be present
    assertEquals((tags as Record<string, unknown>).albumArtist, [
      "Various Artists",
    ]);
    assertEquals((tags as Record<string, unknown>).composer, ["Test Composer"]);
    assertEquals((tags as Record<string, unknown>).discNumber, 2);
    assertEquals((tags as Record<string, unknown>).totalTracks, 12);
    assertEquals((tags as Record<string, unknown>).bpm, 128);
    assertEquals((tags as Record<string, unknown>).compilation, true);
    assertEquals((tags as Record<string, unknown>).musicbrainzTrackId, [
      "abc-123",
    ]);
    assertEquals((tags as Record<string, unknown>).replayGainTrackGain, [
      "-6.54 dB",
    ]);
  });
});

describe("applyTags (renamed from applyTagsToBuffer)", () => {
  it("should work identically to applyTagsToBuffer", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const result = await applyTags(new Uint8Array(original), {
      title: "Via applyTags",
    });
    assertInstanceOf(result, Uint8Array);
    assert(result.length > 0);

    const tags = await readTags(result);
    assertEquals(tags.title, ["Via applyTags"]);
  });
});

describe("readFormat edge cases", () => {
  it("should throw InvalidFormatError for corrupted buffer", async () => {
    await assertRejects(
      () => readFormat(makeCorruptedBuffer()),
      InvalidFormatError,
    );
  });

  it("should detect MP3 format for known MP3 file", async () => {
    const format = await readFormat(FIXTURE_PATH.mp3);
    assertEquals(format, "MP3");
  });
});
