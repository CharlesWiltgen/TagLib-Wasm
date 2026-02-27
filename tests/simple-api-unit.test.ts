import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  addPicture,
  applyCoverArt,
  applyPictures,
  applyTagsToBuffer,
  clearPictures,
  clearTags,
  findPictureByType,
  isValidAudioFile,
  readCoverArt,
  readFormat,
  readMetadata,
  readMetadataBatch,
  readPictureMetadata,
  readPictures,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  replacePictureByType,
  setBufferMode,
  writeTagsToFile,
} from "../src/simple/index.ts";
import type { Picture, PictureType } from "../src/types.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

// Force Emscripten backend
setBufferMode(true);

describe("isValidAudioFile", () => {
  it("should return true for valid audio files", async () => {
    assertEquals(await isValidAudioFile(FIXTURE_PATH.mp3), true);
    assertEquals(await isValidAudioFile(FIXTURE_PATH.flac), true);
    assertEquals(await isValidAudioFile(FIXTURE_PATH.ogg), true);
  });

  it("should return false for invalid data", async () => {
    assertEquals(await isValidAudioFile(new Uint8Array([0, 0, 0, 0])), false);
  });

  it("should return false for non-existent path", async () => {
    assertEquals(await isValidAudioFile("/nonexistent/file.mp3"), false);
  });
});

describe("clearTags", () => {
  it("should return buffer with tags cleared", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const cleared = await clearTags(new Uint8Array(original));

    assertEquals(cleared instanceof Uint8Array, true);
    assertEquals(cleared.length > 0, true);

    // Read back and verify tags are empty
    const tags = await readTags(cleared);
    assertEquals(
      tags.title === undefined || tags.title.length === 0 ||
        tags.title.every((s) => s === ""),
      true,
    );
  });
});

describe("readProperties", () => {
  it("should return audio properties for all formats", async () => {
    const paths = Object.values(FIXTURE_PATH);

    for (const file of paths) {
      const props = await readProperties(file);
      assertExists(props);
      assertEquals(typeof props.duration, "number");
      assertEquals(typeof props.bitrate, "number");
      assertEquals(typeof props.sampleRate, "number");
      assertEquals(typeof props.channels, "number");
    }
  });
});

describe("readPictures", () => {
  it("should return array of pictures from file with cover art", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const pictures = await readPictures(new Uint8Array(mp3));
    assertEquals(Array.isArray(pictures), true);
  });
});

describe("clearPictures", () => {
  it("should return buffer with pictures removed", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const cleared = await clearPictures(new Uint8Array(original));
    assertEquals(cleared instanceof Uint8Array, true);
    assertEquals(cleared.length > 0, true);

    const pictures = await readPictures(cleared);
    assertEquals(pictures.length, 0);
  });
});

describe("readPictureMetadata", () => {
  it("should return metadata without data payload", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const metadata = await readPictureMetadata(new Uint8Array(mp3));
    assertEquals(Array.isArray(metadata), true);

    for (const m of metadata) {
      assertEquals(typeof m.type, "string");
      assertEquals(typeof m.mimeType, "string");
      assertEquals(typeof m.size, "number");
    }
  });
});

describe("findPictureByType", () => {
  it("should find picture by PictureType string", () => {
    const pictures: Picture[] = [
      {
        mimeType: "image/jpeg",
        data: new Uint8Array([1]),
        type: "FrontCover" as PictureType,
      },
      {
        mimeType: "image/png",
        data: new Uint8Array([2]),
        type: "BackCover" as PictureType,
      },
    ];

    const front = findPictureByType(pictures, "FrontCover");
    assertExists(front);
    assertEquals(front!.type, "FrontCover");
  });

  it("should find picture by PictureType value", () => {
    const pictures: Picture[] = [
      {
        mimeType: "image/jpeg",
        data: new Uint8Array([1]),
        type: "FrontCover" as PictureType,
      },
      {
        mimeType: "image/png",
        data: new Uint8Array([2]),
        type: "BackCover" as PictureType,
      },
    ];

    const back = findPictureByType(pictures, "BackCover");
    assertExists(back);
    assertEquals(back!.type, "BackCover");
  });

  it("should return null when type not found", () => {
    const pictures: Picture[] = [
      {
        mimeType: "image/jpeg",
        data: new Uint8Array([1]),
        type: "FrontCover" as PictureType,
      },
    ];

    assertEquals(findPictureByType(pictures, "BackCover"), undefined);
  });

  it("should return undefined for empty array", () => {
    assertEquals(findPictureByType([], "FrontCover"), undefined);
  });
});

describe("readTagsBatch", () => {
  it("should read tags from multiple files", async () => {
    const files = [
      FIXTURE_PATH.mp3,
      FIXTURE_PATH.flac,
      FIXTURE_PATH.ogg,
    ];

    const result = await readTagsBatch(files);
    assertEquals(result.items.length, 3);
    assertEquals(result.items.every((item) => item.status === "ok"), true);
    assertEquals(typeof result.duration, "number");
  });

  it("should handle errors with continueOnError", async () => {
    const files = [
      FIXTURE_PATH.mp3,
      "/nonexistent/file.mp3",
    ];

    const result = await readTagsBatch(files, { continueOnError: true });
    assertEquals(result.items.length, 2);
    assertEquals(result.items[0].status, "ok");
    assertEquals(result.items[0].path, FIXTURE_PATH.mp3);
    assertEquals(result.items[1].status, "error");
    assertEquals(result.items[1].path, "/nonexistent/file.mp3");
  });

  it("should call onProgress callback", async () => {
    const files = [FIXTURE_PATH.mp3];
    const progressCalls: Array<{ processed: number; total: number }> = [];

    await readTagsBatch(files, {
      onProgress: (processed, total) => {
        progressCalls.push({ processed, total });
      },
    });

    assertEquals(progressCalls.length, 1);
    assertEquals(progressCalls[0], { processed: 1, total: 1 });
  });

  it("should respect concurrency option", async () => {
    const files = [
      FIXTURE_PATH.mp3,
      FIXTURE_PATH.flac,
      FIXTURE_PATH.ogg,
      FIXTURE_PATH.m4a,
    ];

    const result = await readTagsBatch(files, { concurrency: 2 });
    assertEquals(result.items.length, 4);
    assertEquals(result.items.every((item) => item.status === "ok"), true);
  });
});

describe("readPropertiesBatch", () => {
  it("should read properties from multiple files", async () => {
    const files = [
      FIXTURE_PATH.mp3,
      FIXTURE_PATH.flac,
    ];

    const result = await readPropertiesBatch(files);
    assertEquals(result.items.length, 2);
    assertEquals(result.items.every((item) => item.status === "ok"), true);

    for (const item of result.items) {
      if (item.status === "ok") {
        assertExists(item.data);
        assertEquals(typeof item.data!.duration, "number");
      }
    }
  });
});

describe("readMetadataBatch", () => {
  it("should read both tags and properties in single pass", async () => {
    const files = [
      FIXTURE_PATH.mp3,
      FIXTURE_PATH.flac,
    ];

    const result = await readMetadataBatch(files);
    assertEquals(result.items.length, 2);

    for (const item of result.items) {
      assertEquals(item.status, "ok");
      if (item.status === "ok") {
        assertExists(item.data.tags);
        assertExists(item.data.properties);
        assertEquals(typeof item.data.hasCoverArt, "boolean");
      }
    }
  });

  it("should handle errors gracefully", async () => {
    const files = ["/nonexistent/file.mp3"];
    const result = await readMetadataBatch(files, { continueOnError: true });
    assertEquals(result.items.length, 1);
    assertEquals(result.items[0].status, "error");
  });

  it("should call onProgress callback", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac];
    const progressCalls: Array<{
      processed: number;
      total: number;
      file: string;
    }> = [];

    await readMetadataBatch(files, {
      onProgress: (processed, total, currentFile) => {
        progressCalls.push({ processed, total, file: currentFile });
      },
    });

    assertEquals(progressCalls.length, 2);
    assertEquals(progressCalls[0].total, 2);
    assertEquals(progressCalls[1].total, 2);
  });

  it("should return empty result for empty input", async () => {
    const result = await readMetadataBatch([]);
    assertEquals(result.items.length, 0);
    assertEquals(result.duration, 0);
  });
});

describe("readTagsBatch AbortSignal", () => {
  it("should abort when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    let threw = false;
    try {
      await readTagsBatch([FIXTURE_PATH.mp3], { signal: controller.signal });
    } catch (error) {
      threw = true;
      assertEquals(error instanceof DOMException, true);
    }
    assertEquals(threw, true);
  });
});

describe("readMetadata", () => {
  it("should return tags, properties, hasCoverArt, and dynamics for a single file", async () => {
    const metadata = await readMetadata(FIXTURE_PATH.mp3);

    assertExists(metadata.tags);
    assertExists(metadata.properties);
    assertEquals(typeof metadata.hasCoverArt, "boolean");
    assertEquals(typeof metadata.properties!.duration, "number");
    assertEquals(typeof metadata.properties!.bitrate, "number");
    // dynamics may be undefined if no ReplayGain/Sound Check tags exist
    assertEquals(
      metadata.dynamics === undefined || typeof metadata.dynamics === "object",
      true,
    );
  });

  it("should return same shape as readMetadataBatch for single file", async () => {
    const single = await readMetadata(FIXTURE_PATH.flac);
    const batch = await readMetadataBatch([FIXTURE_PATH.flac]);

    assertEquals(batch.items.length, 1);
    assertEquals(batch.items[0].status, "ok");
    if (batch.items[0].status === "ok") {
      assertEquals(single.tags, batch.items[0].data.tags);
      assertEquals(single.properties, batch.items[0].data.properties);
      assertEquals(single.hasCoverArt, batch.items[0].data.hasCoverArt);
    }
  });

  it("should throw InvalidFormatError for invalid data", async () => {
    let threw = false;
    try {
      await readMetadata(new Uint8Array([0, 0, 0, 0]));
    } catch (error) {
      threw = true;
      assertEquals(error instanceof Error, true);
    }
    assertEquals(threw, true);
  });
});

describe("readFormat", () => {
  it("should detect MP3 format", async () => {
    const format = await readFormat(FIXTURE_PATH.mp3);
    assertEquals(format, "MP3");
  });

  it("should detect FLAC format", async () => {
    const format = await readFormat(FIXTURE_PATH.flac);
    assertEquals(format, "FLAC");
  });

  it("should detect OGG format", async () => {
    const format = await readFormat(FIXTURE_PATH.ogg);
    assertEquals(format, "OGG");
  });

  it("should detect M4A format", async () => {
    const format = await readFormat(FIXTURE_PATH.m4a);
    assertEquals(format, "MP4");
  });

  it("should detect WAV format", async () => {
    const format = await readFormat(FIXTURE_PATH.wav);
    assertEquals(format, "WAV");
  });

  it("should throw for invalid data", async () => {
    let threw = false;
    try {
      await readFormat(new Uint8Array([0, 0, 0, 0]));
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  });
});

describe("readProperties error handling", () => {
  it("should throw for invalid audio data", async () => {
    let threw = false;
    try {
      await readProperties(new Uint8Array([0, 0, 0, 0]));
    } catch (error) {
      threw = true;
      assertEquals(error instanceof Error, true);
    }
    assertEquals(threw, true);
  });
});

describe("readCoverArt", () => {
  it("should return cover art data from file with pictures", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const coverArt = await readCoverArt(new Uint8Array(mp3));
    // May or may not have pictures, but should not throw
    if (coverArt) {
      assertEquals(coverArt instanceof Uint8Array, true);
      assertEquals(coverArt.length > 0, true);
    }
  });

  it("should return undefined for file with no pictures", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const cleared = await clearPictures(new Uint8Array(mp3));
    const coverArt = await readCoverArt(cleared);
    assertEquals(coverArt, undefined);
  });
});

describe("applyCoverArt", () => {
  it("should embed a front cover image and return modified buffer", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const fakeImage = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const result = await applyCoverArt(
      new Uint8Array(mp3),
      fakeImage,
      "image/jpeg",
    );
    assertEquals(result instanceof Uint8Array, true);
    assertEquals(result.length > 0, true);

    const pictures = await readPictures(result);
    assertEquals(pictures.length, 1);
    assertEquals(pictures[0].type, "FrontCover");
  });
});

describe("applyPictures", () => {
  it("should replace all pictures with provided set", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const newPictures: Picture[] = [
      {
        mimeType: "image/png",
        data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
        type: "BackCover" as PictureType,
      },
    ];
    const result = await applyPictures(new Uint8Array(mp3), newPictures);
    const pictures = await readPictures(result);
    assertEquals(pictures.length, 1);
    assertEquals(pictures[0].type, "BackCover");
  });
});

describe("addPicture", () => {
  it("should append a picture to existing pictures", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const cleared = await clearPictures(new Uint8Array(mp3));
    const picture: Picture = {
      mimeType: "image/jpeg",
      data: new Uint8Array([0xFF, 0xD8]),
      type: "FrontCover" as PictureType,
    };
    const result = await addPicture(cleared, picture);
    const pictures = await readPictures(result);
    assertEquals(pictures.length >= 1, true);
  });
});

describe("replacePictureByType", () => {
  it("should replace picture of matching type", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    // First add a front cover
    const withCover = await applyCoverArt(
      new Uint8Array(mp3),
      new Uint8Array([0xFF, 0xD8]),
      "image/jpeg",
    );
    // Replace the front cover
    const newPicture: Picture = {
      mimeType: "image/png",
      data: new Uint8Array([0x89, 0x50]),
      type: "FrontCover" as PictureType,
    };
    const result = await replacePictureByType(withCover, newPicture);
    const pictures = await readPictures(result);
    const frontCovers = pictures.filter((p) => p.type === "FrontCover");
    assertEquals(frontCovers.length, 1);
    assertEquals(frontCovers[0].mimeType, "image/png");
  });
});

describe("applyTagsToBuffer", () => {
  it("should apply tag changes and return modified buffer", async () => {
    const mp3 = await Deno.readFile(FIXTURE_PATH.mp3);
    const result = await applyTagsToBuffer(new Uint8Array(mp3), {
      title: "New Title",
      artist: "New Artist",
    });
    assertEquals(result instanceof Uint8Array, true);

    const tags = await readTags(result);
    assertEquals(tags.title?.[0], "New Title");
    assertEquals(tags.artist?.[0], "New Artist");
  });
});

describe("writeTagsToFile", () => {
  it("should write tags to a file on disk", async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".mp3" });
    try {
      await Deno.copyFile(FIXTURE_PATH.mp3, tempFile);
      await writeTagsToFile(tempFile, {
        title: "Written Title",
        artist: "Written Artist",
      });

      const tags = await readTags(tempFile);
      assertEquals(tags.title?.[0], "Written Title");
      assertEquals(tags.artist?.[0], "Written Artist");
    } finally {
      await Deno.remove(tempFile);
    }
  });
});

describe("setBufferMode", () => {
  it("should toggle buffer mode", () => {
    setBufferMode(true);
    setBufferMode(false);
    setBufferMode(true); // restore for other tests
  });
});
