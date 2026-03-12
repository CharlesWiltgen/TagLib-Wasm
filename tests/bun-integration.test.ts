// @ts-nocheck — Bun-only file; uses bun:test and import.meta.dir
/**
 * @fileoverview Bun integration tests for taglib-wasm.
 *
 * Uses Bun's native test runner (bun:test) with Node.js-compatible file I/O.
 * Validates runtime compatibility across: batch/folder APIs, Full API lifecycle,
 * Picture API, error handling, NamedAudioInput, and audioProperties.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addPicture,
  applyTags,
  clearPictures,
  InvalidFormatError,
  isInvalidFormatError,
  isTagLibError,
  type Picture,
  readMetadata,
  readMetadataBatch,
  readPictures,
  readProperties,
  readTags,
  readTagsBatch,
  scanFolder,
  TagLib,
} from "../index.ts";

const TEST_FILES_DIR = resolve(import.meta.dir, "test-files");

const FIXTURE_PATH = {
  mp3: resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
  flac: resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
  ogg: resolve(TEST_FILES_DIR, "ogg/kiss-snippet.ogg"),
  m4a: resolve(TEST_FILES_DIR, "mp4/kiss-snippet.m4a"),
  wav: resolve(TEST_FILES_DIR, "wav/kiss-snippet.wav"),
  opus: resolve(TEST_FILES_DIR, "opus/kiss-snippet.opus"),
};

const EXPECTED_KISS_TAGS = {
  title: ["Kiss"],
  artist: ["Prince"],
  album: ["Parade - Music from the Motion Picture Under the Cherry Moon"],
} as const;

// 1x1 PNG for picture tests
const TINY_PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x02,
  0x00,
  0x00,
  0x00,
  0x90,
  0x77,
  0x53,
  0xde,
  0x00,
  0x00,
  0x00,
  0x0c,
  0x49,
  0x44,
  0x41,
  0x54,
  0x08,
  0xd7,
  0x63,
  0xf8,
  0xcf,
  0xc0,
  0x00,
  0x00,
  0x00,
  0x02,
  0x00,
  0x01,
  0xe2,
  0x21,
  0xbc,
  0x33,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
]);

// ---------------------------------------------------------------------------
// Batch APIs (existing)
// ---------------------------------------------------------------------------

describe("readTagsBatch", () => {
  it("should read tags from multiple formats", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readTagsBatch(files);

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
    expect(typeof result.duration).toBe("number");

    for (const item of result.items) {
      if (item.status === "ok") {
        expect(item.data.title).toEqual(EXPECTED_KISS_TAGS.title);
        expect(item.data.artist).toEqual(EXPECTED_KISS_TAGS.artist);
        expect(item.data.album).toEqual(EXPECTED_KISS_TAGS.album);
      }
    }
  });

  it("should handle errors with continueOnError", async () => {
    const files = [FIXTURE_PATH.mp3, "/nonexistent/file.mp3"];
    const result = await readTagsBatch(files, { continueOnError: true });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe("ok");
    expect(result.items[1].status).toBe("error");
    expect(result.items[1].path).toBe("/nonexistent/file.mp3");
  });

  it("should respect concurrency option", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readTagsBatch(files, { concurrency: 1 });

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
  });
});

describe("readMetadataBatch", () => {
  it("should read tags and properties in single pass", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readMetadataBatch(files);

    expect(result.items).toHaveLength(3);

    for (const item of result.items) {
      expect(item.status).toBe("ok");
      if (item.status === "ok") {
        expect(item.data.tags.title).toEqual(EXPECTED_KISS_TAGS.title);
        expect(item.data.properties).toBeDefined();
        expect(item.data.properties!.sampleRate).toBe(44100);
        expect(item.data.properties!.channels).toBe(2);
        expect(typeof item.data.hasCoverArt).toBe("boolean");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Folder API (existing)
// ---------------------------------------------------------------------------

describe("scanFolder", () => {
  it("should scan directory recursively", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(5);
    expect(typeof result.duration).toBe("number");

    const okItems = result.items.filter((i) => i.status === "ok");
    expect(okItems.length).toBeGreaterThanOrEqual(5);
  });

  it("should filter by extension", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      extensions: [".mp3"],
      recursive: true,
    });

    for (const item of result.items) {
      expect(item.path.endsWith(".mp3")).toBe(true);
    }
  });

  it("should respect maxFiles limit", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      maxFiles: 2,
      recursive: true,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.status === "ok")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Write roundtrip (existing)
// ---------------------------------------------------------------------------

describe("write roundtrip", () => {
  it("should persist tag changes through write/read cycle", async () => {
    const mp3Buffer = await readFile(FIXTURE_PATH.mp3);

    const modified = await applyTags(new Uint8Array(mp3Buffer), {
      title: "Modified Title",
      artist: "Modified Artist",
    });

    const tags = await readTags(new Uint8Array(modified));
    expect(tags.title).toEqual(["Modified Title"]);
    expect(tags.artist).toEqual(["Modified Artist"]);
    expect(tags.album).toEqual(EXPECTED_KISS_TAGS.album);
  });
});

// ---------------------------------------------------------------------------
// All core formats (new)
// ---------------------------------------------------------------------------

describe("all core formats", () => {
  for (const [format, path] of Object.entries(FIXTURE_PATH)) {
    it(`should read tags from ${format}`, async () => {
      const tags = await readTags(path);
      expect(tags.title).toEqual(["Kiss"]);
      expect(tags.artist).toEqual(["Prince"]);
    });
  }
});

// ---------------------------------------------------------------------------
// Full API lifecycle (new)
// ---------------------------------------------------------------------------

describe("Full API lifecycle", () => {
  it("should initialize, open, read tag, and dispose", async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open(new Uint8Array(buffer));

    expect(file.isValid()).toBe(true);

    const tag = file.tag();
    expect(tag.title).toBe("Kiss");
    expect(tag.artist).toBe("Prince");

    file.dispose();
  });

  it("should modify tags via MutableTag and save to buffer", async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFile(FIXTURE_PATH.flac);
    const file = await taglib.open(new Uint8Array(buffer));

    file.tag().setTitle("Bun Title").setArtist("Bun Artist");
    file.save();
    const modified = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(new Uint8Array(modified));
    expect(file2.tag().title).toBe("Bun Title");
    expect(file2.tag().artist).toBe("Bun Artist");
    expect(file2.tag().album).toBe(
      "Parade - Music from the Motion Picture Under the Cherry Moon",
    );
    file2.dispose();
  });

  it("should read and write properties via getProperty/setProperty", async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open(new Uint8Array(buffer));

    const props = file.properties();
    expect(props.title).toEqual(["Kiss"]);

    file.setProperty("title", "Property Title");
    file.save();
    const modified = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(new Uint8Array(modified));
    expect(file2.getProperty("title")).toBe("Property Title");
    file2.dispose();
  });
});

// ---------------------------------------------------------------------------
// AudioProperties (new)
// ---------------------------------------------------------------------------

describe("audioProperties", () => {
  it("should return complete audio properties", async () => {
    const props = await readProperties(FIXTURE_PATH.mp3);
    expect(props.duration).toBeGreaterThan(0);
    expect(props.bitrate).toBeGreaterThan(0);
    expect(props.sampleRate).toBe(44100);
    expect(props.channels).toBe(2);
    expect(props.codec).toBe("MP3");
    expect(props.containerFormat).toBe("MP3");
    expect(props.isLossless).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// taglib.edit() (new)
// ---------------------------------------------------------------------------

describe("taglib.edit()", () => {
  it("should modify buffer in one-liner and return modified data", async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFile(FIXTURE_PATH.ogg);

    const modified = await taglib.edit(new Uint8Array(buffer), (file) => {
      file.tag().setTitle("Edited via edit()");
    });

    expect(modified).toBeInstanceOf(Uint8Array);
    expect(modified.byteLength).toBeGreaterThan(0);

    const tags = await readTags(modified);
    expect(tags.title).toEqual(["Edited via edit()"]);
    expect(tags.album).toEqual(EXPECTED_KISS_TAGS.album);
  });
});

// ---------------------------------------------------------------------------
// Picture API (new)
// ---------------------------------------------------------------------------

describe("Picture API", () => {
  it("should return empty array when file has no pictures", async () => {
    const pictures = await readPictures(FIXTURE_PATH.mp3);
    expect(pictures).toHaveLength(0);
  });

  it("should add a picture and read it back", async () => {
    const buffer = await readFile(FIXTURE_PATH.mp3);
    const picture: Picture = {
      mimeType: "image/png",
      type: "FrontCover",
      data: TINY_PNG,
      description: "Test cover",
    };

    const modified = await addPicture(new Uint8Array(buffer), picture);
    const pictures = await readPictures(modified);

    expect(pictures.length).toBeGreaterThanOrEqual(1);
    const cover = pictures.find((p) => p.type === "FrontCover");
    expect(cover).toBeDefined();
    expect(cover!.mimeType).toBe("image/png");
    expect(new Uint8Array(cover!.data)).toEqual(TINY_PNG);
  });

  it("should clear all pictures", async () => {
    const buffer = await readFile(FIXTURE_PATH.mp3);
    const picture: Picture = {
      mimeType: "image/png",
      type: "FrontCover",
      data: TINY_PNG,
      description: "",
    };

    const withPic = await addPicture(new Uint8Array(buffer), picture);
    const cleared = await clearPictures(withPic);
    const pictures = await readPictures(cleared);
    expect(pictures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error handling (new)
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("should throw InvalidFormatError for corrupted data", async () => {
    const taglib = await TagLib.initialize();
    const garbage = new Uint8Array(50).fill(0x00);

    try {
      await taglib.open(garbage);
      throw new Error("Expected taglib.open() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidFormatError);
      expect(isInvalidFormatError(error)).toBe(true);
      expect(isTagLibError(error)).toBe(true);
    }
  });

  it("should throw for non-existent file path", async () => {
    try {
      await readTags("/nonexistent/path/file.mp3");
      throw new Error("Expected readTags() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should include buffer size in InvalidFormatError", async () => {
    const taglib = await TagLib.initialize();
    const garbage = new Uint8Array(200).fill(0x00);

    try {
      await taglib.open(garbage);
      throw new Error("Expected taglib.open() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidFormatError);
      const formatError = error as InstanceType<typeof InvalidFormatError>;
      expect(formatError.bufferSize).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// NamedAudioInput (new)
// ---------------------------------------------------------------------------

describe("NamedAudioInput", () => {
  it("should use name for batch result path correlation", async () => {
    const mp3 = await readFile(FIXTURE_PATH.mp3);
    const result = await readTagsBatch([
      { name: "my-song.mp3", data: new Uint8Array(mp3) },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("ok");
    expect(result.items[0].path).toBe("my-song.mp3");
  });

  it("should work with taglib.open()", async () => {
    const taglib = await TagLib.initialize();
    const mp3 = await readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open({
      name: "test.mp3",
      data: new Uint8Array(mp3),
    });

    expect(file.isValid()).toBe(true);
    expect(file.tag().title).toBe("Kiss");
    file.dispose();
  });
});

// ---------------------------------------------------------------------------
// readMetadata single-file (new)
// ---------------------------------------------------------------------------

describe("readMetadata", () => {
  it("should return complete metadata for a single file", async () => {
    const metadata = await readMetadata(FIXTURE_PATH.mp3);

    expect(metadata.tags.title).toEqual(["Kiss"]);
    expect(metadata.tags.artist).toEqual(["Prince"]);
    expect(metadata.properties.duration).toBeGreaterThan(0);
    expect(metadata.properties.sampleRate).toBe(44100);
    expect(metadata.hasCoverArt).toBe(false);
  });
});
