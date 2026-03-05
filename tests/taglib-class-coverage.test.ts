import { assert, assertEquals } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

let taglib: TagLib;

beforeAll(async () => {
  taglib = await TagLib.initialize({ forceBufferMode: true });
});

describe("TagLib.edit() with buffer input", () => {
  it("should return modified Uint8Array when editing a buffer", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);

    const result = await taglib.edit(
      new Uint8Array(original),
      (file) => {
        file.tag().setTitle("Buffer Edit Test").setArtist("Test Artist");
      },
    );

    assertInstanceOf(result, Uint8Array);
  });

  it("should return modified buffer with ArrayBuffer input", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);

    const result = await taglib.edit(
      original.buffer,
      (file) => {
        file.tag().setAlbum("New Album");
      },
    );

    assertInstanceOf(result, Uint8Array);
  });

  it("should reflect tag changes in the returned buffer", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.ogg);

    const modified = await taglib.edit(
      new Uint8Array(original),
      (file) => {
        file.tag().setTitle("Roundtrip Test").setYear(2025);
      },
    );

    const verifyFile = await taglib.open(modified);
    try {
      assertEquals(
        { title: verifyFile.tag().title, year: verifyFile.tag().year },
        { title: "Roundtrip Test", year: 2025 },
      );
    } finally {
      verifyFile.dispose();
    }
  });
});

describe("TagLib.edit() with partial tag updates", () => {
  it("should preserve untouched fields when updating one field", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);

    const modified = await taglib.edit(
      new Uint8Array(original),
      (file) => {
        file.tag()
          .setTitle("Original")
          .setArtist("Original Artist")
          .setAlbum("Original Album");
      },
    );

    const remodified = await taglib.edit(
      modified,
      (file) => {
        file.tag().setTitle("Only Title Changed");
      },
    );

    const verifyFile = await taglib.open(remodified);
    try {
      const tag = verifyFile.tag();
      assertEquals(
        { title: tag.title, artist: tag.artist, album: tag.album },
        {
          title: "Only Title Changed",
          artist: "Original Artist",
          album: "Original Album",
        },
      );
    } finally {
      verifyFile.dispose();
    }
  });

  it("should handle year and track as numeric fields", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.flac);

    const modified = await taglib.edit(
      new Uint8Array(original),
      (file) => {
        file.tag().setYear(1999).setTrack(7);
      },
    );

    const verifyFile = await taglib.open(modified);
    try {
      assertEquals(
        { year: verifyFile.tag().year, track: verifyFile.tag().track },
        { year: 1999, track: 7 },
      );
    } finally {
      verifyFile.dispose();
    }
  });
});

describe("updateFile with extended fields", () => {
  it("should write albumArtist through updateFile", async () => {
    const tmpFile = await Deno.makeTempFile({ suffix: ".flac" });
    try {
      await Deno.copyFile(FIXTURE_PATH.flac, tmpFile);

      await taglib.updateFile(tmpFile, {
        title: "Test Title",
        albumArtist: "Various Artists",
        composer: "Test Composer",
      });

      const verifyFile = await taglib.open(tmpFile);
      try {
        assertEquals(verifyFile.tag().title, "Test Title");
        assertEquals(verifyFile.getProperty("albumArtist"), "Various Artists");
        assertEquals(verifyFile.getProperty("composer"), "Test Composer");
      } finally {
        verifyFile.dispose();
      }
    } finally {
      await Deno.remove(tmpFile);
    }
  });

  it("should write numeric extended fields through updateFile", async () => {
    const tmpFile = await Deno.makeTempFile({ suffix: ".flac" });
    try {
      await Deno.copyFile(FIXTURE_PATH.flac, tmpFile);

      await taglib.updateFile(tmpFile, {
        discNumber: 2,
        totalTracks: 12,
        bpm: 128,
        compilation: true,
      });

      const verifyFile = await taglib.open(tmpFile);
      try {
        assertEquals(verifyFile.getProperty("discNumber"), "2");
        assertEquals(verifyFile.getProperty("TRACKTOTAL"), "12");
        assertEquals(verifyFile.getProperty("bpm"), "128");
        assertEquals(verifyFile.getProperty("COMPILATION"), "1");
      } finally {
        verifyFile.dispose();
      }
    } finally {
      await Deno.remove(tmpFile);
    }
  });
});

describe("TagLib.version()", () => {
  it("should return version with TagLib version", () => {
    const version = taglib.version();
    assert(
      /^\d+\.\d+\.\d+\S* \(TagLib \d+\.\d+\.\d+\)$/.test(version),
      `Version should match format 'X.Y.Z (TagLib X.Y.Z)', got: ${version}`,
    );
  });
});
