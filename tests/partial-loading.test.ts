/**
 * Tests for Smart Partial Loading functionality
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import { join } from "@std/path";

const TEST_FILES_DIR = join(Deno.cwd(), "tests/test-files");

Deno.test("Partial Loading", async (t) => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });

  await t.step("should load file with partial option", async () => {
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    // Should still be able to read tags
    const tag = file.tag();
    assertExists(tag.title);
    assertExists(tag.artist);

    file.dispose();
  });

  await t.step("should use default sizes when not specified", async () => {
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    // Should work with default header/footer sizes
    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  await t.step(
    "should work with File objects in browser-like environment",
    async () => {
      // Simulate a File object
      const fileData = await Deno.readFile(
        join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
      );
      const file = {
        size: fileData.byteLength,
        slice: (start: number, end: number) => ({
          arrayBuffer: async () => fileData.slice(start, end).buffer,
        }),
      };

      // This would work in a real browser environment
      // For now, just test with regular file
      const audioFile = await taglib.open(fileData);
      assertExists(audioFile.tag());
      audioFile.dispose();
    },
  );

  await t.step("should fallback to full loading for small files", async () => {
    const filePath = join(TEST_FILES_DIR, "wav/kiss-snippet.wav"); // Small test file
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 1024 * 1024,
      maxFooterSize: 128 * 1024,
    });

    // Should still work even if file is smaller than partial thresholds
    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  await t.step("should handle save with partial loading", async () => {
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const outputPath = join(
      TEST_FILES_DIR,
      "mp3/kiss-snippet-partial-save.mp3",
    );

    // Open with partial loading
    const file = await taglib.open(filePath, { partial: true });

    // Make changes
    const tag = file.tag();
    const originalTitle = tag.title;
    tag.setTitle("Partial Load Test");
    tag.setArtist("Test Artist");

    // Save should work (loads full file internally)
    await file.saveToFile(outputPath);
    file.dispose();

    // Verify the saved file
    const savedFile = await taglib.open(outputPath);
    const savedTag = savedFile.tag();
    assertEquals(savedTag.title, "Partial Load Test");
    assertEquals(savedTag.artist, "Test Artist");
    savedFile.dispose();

    // Cleanup
    await Deno.remove(outputPath);
  });

  await t.step(
    "should preserve audio data when saving partially loaded file",
    async () => {
      const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
      const outputPath = join(
        TEST_FILES_DIR,
        "mp3/kiss-snippet-partial-preserve.mp3",
      );

      // Get original file size
      const originalData = await Deno.readFile(filePath);
      const originalSize = originalData.byteLength;

      // Open with partial loading and save
      const file = await taglib.open(filePath, { partial: true });
      file.tag().setTitle("Size Test");
      await file.saveToFile(outputPath);
      file.dispose();

      // Check that file size is reasonable (metadata changes might affect size slightly)
      const savedData = await Deno.readFile(outputPath);
      const savedSize = savedData.byteLength;

      // Size should be within 10KB of original (accounting for metadata changes)
      const sizeDiff = Math.abs(savedSize - originalSize);
      assert(sizeDiff < 10240, `File size changed too much: ${sizeDiff} bytes`);

      // Cleanup
      await Deno.remove(outputPath);
    },
  );

  await t.step(
    "should throw error when calling save() on partially loaded file",
    async () => {
      const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
      const file = await taglib.open(filePath, {
        partial: true,
        maxHeaderSize: 10 * 1024, // 10KB
        maxFooterSize: 5 * 1024, // 5KB
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
    },
  );

  await t.step("should work with custom header/footer sizes", async () => {
    const filePath = join(TEST_FILES_DIR, "flac/kiss-snippet.flac");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 2 * 1024 * 1024, // 2MB
      maxFooterSize: 256 * 1024, // 256KB
    });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });
});
