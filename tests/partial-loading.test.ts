/**
 * Tests for Smart Partial Loading functionality
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { join } from "@std/path";

const TEST_FILES_DIR = join(Deno.cwd(), "tests/test-files");

describe("Partial Loading", () => {
  it("should load file with partial option", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    assertExists(tag.title);
    assertExists(tag.artist);

    file.dispose();
  });

  it("should use default sizes when not specified", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  it("should work with File objects in browser-like environment", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const fileData = await Deno.readFile(
      join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
    );
    const file = {
      size: fileData.byteLength,
      slice: (start: number, end: number) => ({
        arrayBuffer: async () => fileData.slice(start, end).buffer,
      }),
    };

    const audioFile = await taglib.open(fileData);
    assertExists(audioFile.tag());
    audioFile.dispose();
  });

  it("should fallback to full loading for small files", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "wav/kiss-snippet.wav");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 1024 * 1024,
      maxFooterSize: 128 * 1024,
    });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  it("should handle save with partial loading", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const outputPath = join(
      TEST_FILES_DIR,
      "mp3/kiss-snippet-partial-save.mp3",
    );

    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    const originalTitle = tag.title;
    tag.setTitle("Partial Load Test");
    tag.setArtist("Test Artist");

    await file.saveToFile(outputPath);
    file.dispose();

    const savedFile = await taglib.open(outputPath);
    const savedTag = savedFile.tag();
    assertEquals(savedTag.title, "Partial Load Test");
    assertEquals(savedTag.artist, "Test Artist");
    savedFile.dispose();

    await Deno.remove(outputPath);
  });

  it("should preserve audio data when saving partially loaded file", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const outputPath = join(
      TEST_FILES_DIR,
      "mp3/kiss-snippet-partial-preserve.mp3",
    );

    const originalData = await Deno.readFile(filePath);
    const originalSize = originalData.byteLength;

    const file = await taglib.open(filePath, { partial: true });
    file.tag().setTitle("Size Test");
    await file.saveToFile(outputPath);
    file.dispose();

    const savedData = await Deno.readFile(outputPath);
    const savedSize = savedData.byteLength;

    const sizeDiff = Math.abs(savedSize - originalSize);
    assert(sizeDiff < 10240, `File size changed too much: ${sizeDiff} bytes`);

    await Deno.remove(outputPath);
  });

  it("should throw error when calling save() on partially loaded file", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 10 * 1024,
      maxFooterSize: 5 * 1024,
    });

    try {
      file.save();
      assert(false, "Should have thrown error");
    } catch (error) {
      assert(error instanceof Error);
      assert(
        error.message.includes("Cannot save partially loaded file directly"),
      );
    }

    file.dispose();
  });

  it("should work with custom header/footer sizes", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const filePath = join(TEST_FILES_DIR, "flac/kiss-snippet.flac");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 2 * 1024 * 1024,
      maxFooterSize: 256 * 1024,
    });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });
});
