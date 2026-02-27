import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  clearPictures,
  clearTags,
  findPictureByType,
  isValidAudioFile,
  readMetadataBatch,
  readPictureMetadata,
  readPictures,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  setBufferMode,
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

    assertEquals(findPictureByType(pictures, "BackCover"), null);
  });

  it("should return null for empty array", () => {
    assertEquals(findPictureByType([], "FrontCover"), null);
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
});

describe("setBufferMode", () => {
  it("should toggle buffer mode", () => {
    setBufferMode(true);
    setBufferMode(false);
    setBufferMode(true); // restore for other tests
  });
});
