import { assert, assertEquals, assertRejects } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { describe, it } from "@std/testing/bdd";
import {
  applyTags,
  applyTagsToFile,
  clearTags,
  readFormat,
  readTags,
  setBufferMode,
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

describe("applyTags", () => {
  it("should throw InvalidFormatError for corrupted buffer", async () => {
    await assertRejects(
      () => applyTags(makeCorruptedBuffer(), { title: "Test" }),
      InvalidFormatError,
    );
  });

  it("should return a valid buffer when applying tags to valid file", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const result = await applyTags(new Uint8Array(original), {
      title: "Modified Title",
    });
    assertInstanceOf(result, Uint8Array);
    assert(result.length > 0);
  });
});

describe("applyTagsToFile error paths", () => {
  it("should throw FileOperationError when given a buffer instead of path", async () => {
    const buffer = new Uint8Array(100);
    await assertRejects(
      // deno-lint-ignore no-explicit-any
      () => applyTagsToFile(buffer as any, { title: "Test" }),
      FileOperationError,
      "requires a file path string",
    );
  });

  it("should throw FileOperationError when given an ArrayBuffer instead of path", async () => {
    const buffer = new ArrayBuffer(100);
    await assertRejects(
      // deno-lint-ignore no-explicit-any
      () => applyTagsToFile(buffer as any, { title: "Test" }),
      FileOperationError,
      "requires a file path string",
    );
  });
});

describe("clearTags", () => {
  for (const format of ["flac", "mp3", "ogg"] as const) {
    it(`should clear extended fields and pictures for ${format.toUpperCase()}`, async () => {
      const original = await Deno.readFile(FIXTURE_PATH[format]);

      const withExtended = await applyTags(new Uint8Array(original), {
        title: "Test Title",
        artist: "Test Artist",
        albumArtist: "Various Artists",
        composer: "Test Composer",
        musicbrainzTrackId: "abc-123",
        replayGainTrackGain: "-6.54 dB",
      });

      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const withPicture = await taglib.edit(withExtended, (file) => {
        file.addPicture({
          mimeType: "image/png",
          data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
          type: "FrontCover",
        });
      });

      const cleared = await clearTags(withPicture);

      const verifyFile = await taglib.open(cleared);
      try {
        assertEquals(verifyFile.tag().title, "");
        assertEquals(verifyFile.tag().artist, "");
        assertEquals(verifyFile.getProperty("albumArtist"), undefined);
        assertEquals(verifyFile.getProperty("composer"), undefined);
        assertEquals(verifyFile.getProperty("musicbrainzTrackId"), undefined);
        assertEquals(
          verifyFile.getProperty("replayGainTrackGain"),
          undefined,
        );
        assertEquals(verifyFile.getPictures().length, 0);
      } finally {
        verifyFile.dispose();
      }
    });
  }
});

describe("readTags extended fields", () => {
  it("should return extended fields from readTags", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);
    const withExtended = await applyTags(new Uint8Array(original), {
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
    assertEquals(tags.albumArtist, ["Various Artists"]);
    assertEquals(tags.composer, ["Test Composer"]);
    assertEquals(tags.discNumber, 2);
    assertEquals(tags.totalTracks, 12);
    assertEquals(tags.bpm, 128);
    assertEquals(tags.compilation, true);
    assertEquals(tags.musicbrainzTrackId, ["abc-123"]);
    assertEquals(tags.replayGainTrackGain, ["-6.54 dB"]);
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
