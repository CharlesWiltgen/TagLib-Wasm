/// <reference lib="deno.ns" />

/**
 * @fileoverview Consolidated test suite for TagLib-Wasm
 * Combines format testing, API testing, and edge cases with proper Deno test assertions
 *
 * Run with: deno test --allow-read tests/taglib.test.ts
 * Or: npm test
 */

import {
  assert,
  assertEquals,
  assertExists,
  type assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/mod.ts";
import type { AudioFile } from "../src/mod.ts";
import {
  applyTagsToBuffer,
  isValidAudioFile,
  readFormat,
  readProperties,
  readTags,
  setBufferMode,
} from "../src/simple/index.ts";
import { EXPECTED_FORMATS, TEST_FILES } from "./test-utils.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

describe("Initialization", () => {
  it("TagLib: Initialization", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    assertExists(taglib, "TagLib instance should exist after init");
  });
});

describe("Full API", () => {
  it("Basic Operations", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    assertExists(taglib, "TagLib instance should exist");

    const version = taglib.version();
    assertEquals(version, "2.1.0", "Should return correct TagLib version");
  });

  it("Format Detection", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    for (const [format, path] of Object.entries(TEST_FILES)) {
      const audioData = await Deno.readFile(path);
      const file = await taglib.open(audioData.buffer);

      assertEquals(file.isValid(), true, `${format} file should be valid`);
      assertEquals(
        file.getFormat(),
        EXPECTED_FORMATS[format as keyof typeof EXPECTED_FORMATS],
        `Should detect ${format} format correctly`,
      );

      file.dispose();
    }
  });

  it("Audio Properties", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);
    const file = await taglib.open(audioData.buffer);

    const props = file.audioProperties();
    assertExists(props, "Should have audio properties");
    assert(props.duration > 0, "Duration should be positive");
    assert(props.bitrate > 0, "Bitrate should be positive");
    assert(props.sampleRate > 0, "Sample rate should be positive");
    assert(props.channels > 0, "Channels should be positive");

    file.dispose();
  });

  it("Tag Reading", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);
    const file = await taglib.open(audioData.buffer);

    const tags = file.tag();
    assertExists(tags, "Should have tags");
    assertEquals(typeof tags.title, "string", "Title should be string");
    assertEquals(typeof tags.artist, "string", "Artist should be string");
    assertEquals(typeof tags.album, "string", "Album should be string");
    assertEquals(typeof tags.year, "number", "Year should be number");
    assertEquals(typeof tags.track, "number", "Track should be number");
    assertEquals(typeof tags.genre, "string", "Genre should be string");
    assertEquals(typeof tags.comment, "string", "Comment should be string");

    file.dispose();
  });

  it("Tag Writing", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);
    const file = await taglib.open(audioData.buffer);

    const tag = file.tag();
    tag.setTitle("Test Title");
    tag.setArtist("Test Artist");
    tag.setAlbum("Test Album");
    tag.setYear(2024);
    tag.setTrack(1);
    tag.setGenre("Test Genre");
    tag.setComment("Test Comment");

    const updatedTags = file.tag();
    assertEquals(updatedTags.title, "Test Title", "Title should be updated");
    assertEquals(
      updatedTags.artist,
      "Test Artist",
      "Artist should be updated",
    );
    assertEquals(updatedTags.album, "Test Album", "Album should be updated");
    assertEquals(updatedTags.year, 2024, "Year should be updated");
    assertEquals(updatedTags.track, 1, "Track should be updated");
    assertEquals(updatedTags.genre, "Test Genre", "Genre should be updated");
    assertEquals(
      updatedTags.comment,
      "Test Comment",
      "Comment should be updated",
    );

    file.dispose();
  });

  it("Extended Tag Support", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);
    const file = await taglib.open(audioData.buffer);

    const tags = file.tag();
    assertExists(tags, "Should have tags object");

    file.dispose();
  });

  it("Memory Management", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    for (let i = 0; i < 10; i++) {
      const audioData = await Deno.readFile(TEST_FILES.mp3);
      const file = await taglib.open(audioData.buffer);
      assert(file.isValid(), `File ${i} should be valid`);
      file.dispose();
    }

    assert(true, "Memory management test passed");
  });

  it("Symbol.dispose enables using statement", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);

    let fileRef: AudioFile | null = null;
    {
      using file = await taglib.open(audioData.buffer);
      assert(file.isValid(), "File should be valid inside using block");
      fileRef = file;
    }
    let threw = false;
    try {
      fileRef!.isValid();
    } catch {
      threw = true;
    }
    assert(threw, "Calling isValid() on disposed file should throw");
  });

  it("Double disposal is safe", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);

    {
      using file = await taglib.open(audioData.buffer);
      assert(file.isValid(), "File should be valid");
      file.dispose();
    }
  });

  it("Symbol.dispose cleans up on exception", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioData = await Deno.readFile(TEST_FILES.mp3);

    let fileRef: AudioFile | null = null;
    try {
      using file = await taglib.open(audioData.buffer);
      fileRef = file;
      throw new Error("Simulated error");
    } catch {
      // Expected
    }
    let threw = false;
    try {
      fileRef!.isValid();
    } catch {
      threw = true;
    }
    assert(threw, "File should be disposed after exception");
  });
});

describe("Simple API", () => {
  it("File Validation", async () => {
    for (const [format, path] of Object.entries(TEST_FILES)) {
      const isValid = await isValidAudioFile(path);
      assertEquals(isValid, true, `${format} file should be valid`);
    }

    const isValid = await isValidAudioFile("./package.json");
    assertEquals(isValid, false, "Non-audio file should be invalid");
  });

  it("Format Detection", async () => {
    for (const [format, path] of Object.entries(TEST_FILES)) {
      const detectedFormat = await readFormat(path);
      assertEquals(
        detectedFormat,
        EXPECTED_FORMATS[format as keyof typeof EXPECTED_FORMATS],
        `Should detect ${format} format correctly`,
      );
    }
  });

  it("Tag Reading", async () => {
    const tags = await readTags(TEST_FILES.mp3);
    assertExists(tags, "Should return tags object");
    assert(Array.isArray(tags.title), "Title should be string[]");
    assert(Array.isArray(tags.artist), "Artist should be string[]");
    assert(Array.isArray(tags.album), "Album should be string[]");
    assertEquals(typeof tags.year, "number", "Year should be number");
    assertEquals(typeof tags.track, "number", "Track should be number");
    assert(Array.isArray(tags.genre), "Genre should be string[]");
    assert(
      tags.comment === undefined || Array.isArray(tags.comment),
      "Comment should be string[] or undefined",
    );
  });

  it("Tag Writing", async () => {
    const modifiedBuffer = await applyTagsToBuffer(TEST_FILES.mp3, {
      title: "Simple API Test",
      artist: "Test Suite",
      album: "Test Album",
      year: 2024,
      track: 5,
      genre: "Electronic",
      comment: "Modified by Simple API",
    });

    assert(modifiedBuffer.length > 0, "Modified buffer should have content");
    assert(modifiedBuffer.length > 0, "Should return a buffer");
  });

  it("Audio Properties", async () => {
    const props = await readProperties(TEST_FILES.mp3);
    assertExists(props, "Should return properties");
    assert(props.duration > 0, "Duration should be positive");
    assert(props.bitrate > 0, "Bitrate should be positive");
    assert(props.sampleRate > 0, "Sample rate should be positive");
    assert(props.channels > 0, "Channels should be positive");
  });

  it("Buffer Input", async () => {
    const tagsFromPath = await readTags(TEST_FILES.mp3);
    assertExists(tagsFromPath, "Should read tags from path");

    const buffer = await Deno.readFile(TEST_FILES.mp3);
    const tagsFromBuffer = await readTags(buffer);
    assertExists(tagsFromBuffer, "Should read tags from buffer");

    assertEquals(
      tagsFromPath.genre,
      tagsFromBuffer.genre,
      "Genre should match between path and buffer",
    );
  });
});

describe("Error Handling", () => {
  it("Non-existent File", async () => {
    try {
      await readTags("non-existent-file.mp3");
      assert(false, "Should have thrown an error");
    } catch (error) {
      assert(error instanceof Error, "Should throw Error");
      assert(
        error.message.includes("No such file") ||
          error.message.includes("ENOENT"),
        "Error should indicate file not found",
      );
    }
  });

  it("Invalid Audio Data", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);

    try {
      const file = await taglib.open(invalidData.buffer);
      assertEquals(file.isValid(), false, "Invalid data should not be valid");
      file.dispose();
    } catch (error) {
      assert(error instanceof Error, "Should throw Error for invalid data");
      assert(
        error.message.includes("Failed to load"),
        "Error should indicate load failure",
      );
    }
  });

  it("Empty Buffer", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const emptyData = new Uint8Array(0);

    try {
      const file = await taglib.open(emptyData.buffer);
      assertEquals(file.isValid(), false, "Empty buffer should not be valid");
      file.dispose();
    } catch (error) {
      assert(error instanceof Error, "Should throw Error for empty buffer");
      assert(
        error.message.includes("Failed to load"),
        "Error should indicate load failure",
      );
    }
  });
});

describe("Performance", () => {
  it("Format Processing Speed", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const results: Record<string, number> = {};

    for (const [format, path] of Object.entries(TEST_FILES)) {
      const start = performance.now();
      const audioData = await Deno.readFile(path);
      const file = await taglib.open(audioData.buffer);

      file.tag();
      file.audioProperties();
      file.dispose();

      results[format] = performance.now() - start;
    }

    console.log("Format processing times:", results);

    const totalMs = Object.values(results).reduce((a, b) => a + b, 0);
    assert(
      totalMs < 5000,
      `All formats should process in under 5s. Total: ${totalMs}ms`,
    );
  });

  it("API Comparison", async () => {
    const audioData = await Deno.readFile(TEST_FILES.mp3);

    const coreStart = performance.now();
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const file = await taglib.open(audioData.buffer);
    file.tag();
    file.dispose();
    const coreTime = performance.now() - coreStart;

    const simpleStart = performance.now();
    await readTags(TEST_FILES.mp3);
    const simpleTime = performance.now() - simpleStart;

    console.log(`Full API: ${coreTime.toFixed(2)}ms`);
    console.log(`Simple API: ${simpleTime.toFixed(2)}ms`);

    assert(coreTime < 1000, "Full API should be fast");
    assert(simpleTime < 1000, "Simple API should be fast");
  });
});

describe("Format Tests", () => {
  it("File Headers", async () => {
    const expectedHeaders: Record<string, string> = {
      wav: "52 49 46 46", // RIFF
      mp3: "ff fb", // MP3 sync word (may also be ID3)
      flac: "66 4c 61 43", // fLaC
      ogg: "4f 67 67 53", // OggS
      m4a: "00 00 00", // MP4/M4A (variable)
    };

    for (const [format, path] of Object.entries(TEST_FILES)) {
      const audioData = await Deno.readFile(path);
      const header = Array.from(audioData.slice(0, 4))
        .map((b: number) => b.toString(16).padStart(2, "0"))
        .join(" ");

      if (format === "mp3") {
        assert(
          header.startsWith("ff fb") || header.startsWith("49 44 33"),
          `${format} should have valid header`,
        );
      } else if (format === "m4a") {
        assert(audioData.length > 0, `${format} should have content`);
      } else {
        assert(
          header.startsWith(expectedHeaders[format]),
          `${format} should have expected header: ${
            expectedHeaders[format]
          }, got ${header}`,
        );
      }
    }
  });

  it("Systematic All Formats", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const results: Record<string, boolean> = {};

    console.log("\n🎵 Systematic Format Testing");
    console.log("=".repeat(50));

    for (const [format, path] of Object.entries(TEST_FILES)) {
      console.log(`\n🔍 Testing ${format.toUpperCase()} format...`);

      try {
        const audioData = await Deno.readFile(path);
        console.log(`📊 File size: ${audioData.length} bytes`);

        const file = await taglib.open(audioData.buffer);

        if (file.isValid()) {
          console.log(`✅ SUCCESS: ${format} loaded successfully`);

          const detectedFormat = file.getFormat();
          const props = file.audioProperties();
          const tags = file.tag();

          console.log(`📄 Format: ${detectedFormat}`);
          console.log(
            `🎧 Properties: ${props?.duration ?? 0}s, ${
              props?.bitrate ?? 0
            }kbps, ${props?.sampleRate ?? 0}Hz`,
          );
          console.log(
            `🏷️  Tags: "${tags.title || "(empty)"}" by ${
              tags.artist || "(empty)"
            }`,
          );

          results[format] = true;
          file.dispose();
        } else {
          console.log(`❌ FAILED: ${format} is not valid`);
          results[format] = false;
        }
      } catch (error) {
        console.log(`❌ ERROR: ${(error as Error).message}`);
        results[format] = false;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📋 Test Results Summary:");

    let passedTests = 0;
    const totalTests = Object.keys(results).length;

    for (const [format, success] of Object.entries(results)) {
      if (success) passedTests++;
      const status = success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${format.toUpperCase()}`);
    }

    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} formats working`);
    assertEquals(passedTests, totalTests, "All formats should be working");
  });
});

describe("Integration", () => {
  it("Complete Workflow", async () => {
    const isValid = await isValidAudioFile(TEST_FILES.mp3);
    assertEquals(isValid, true, "File should be valid");

    const format = await readFormat(TEST_FILES.mp3);
    assertEquals(format, "MP3", "Should detect MP3 format");

    const props = await readProperties(TEST_FILES.mp3);
    assert(props.bitrate > 0, "Should have valid properties");

    const originalTags = await readTags(TEST_FILES.mp3);
    assertExists(originalTags, "Should read original tags");

    const newTags = {
      title: "Integration Test",
      artist: "Test Suite",
      year: 2024,
    };
    const modifiedBuffer = await applyTagsToBuffer(TEST_FILES.mp3, newTags);

    assert(modifiedBuffer.length > 0, "Should return a buffer");
  });

  it("All Formats", async () => {
    for (const [format, path] of Object.entries(TEST_FILES)) {
      const isValid = await isValidAudioFile(path);
      assertEquals(isValid, true, `${format} should be valid`);

      const tags = await readTags(path);
      assertExists(tags, `${format} should have tags`);

      const props = await readProperties(path);
      assert(props.duration > 0, `${format} should have duration`);

      try {
        const modified = await applyTagsToBuffer(path, {
          title: `${format} Test`,
        });
        assert(modified.length > 0, `${format} should support writing`);
      } catch {
        console.log(`Note: ${format} might not support tag writing`);
      }
    }
  });

  it("Music Library Processing", async () => {
    const { applyTagsToBuffer, readTags, applyCoverArt } = await import(
      "../src/simple/index.ts"
    );
    const { RED_PNG, createTestFiles, measureTime } = await import(
      "./test-utils.ts"
    );

    const albumFiles = await createTestFiles(5, "mp3");
    const albumMetadata = {
      album: "Integration Test Album",
      artist: "Test Artist",
      year: 2024,
      genre: "Electronic",
    };

    const processedFiles = await Promise.all(
      albumFiles.map(async (buffer, index) => {
        const trackTags = {
          ...albumMetadata,
          title: `Track ${index + 1}`,
          track: index + 1,
        };

        const tagged = await applyTagsToBuffer(buffer, trackTags);

        if (index === 0) {
          return await applyCoverArt(tagged, RED_PNG, "image/png");
        } else {
          return tagged;
        }
      }),
    );

    for (let i = 0; i < processedFiles.length; i++) {
      const tags = await readTags(processedFiles[i]);
      assertEquals(tags.album, [albumMetadata.album]);
      assertEquals(tags.artist, [albumMetadata.artist]);
      assertEquals(tags.track, i + 1);
    }
  });

  it("Batch Tag Updates", async () => {
    const { applyTagsToBuffer, readTags } = await import(
      "../src/simple/index.ts"
    );
    const { createTestFiles } = await import("./test-utils.ts");

    const files = await createTestFiles(10, "flac");

    const updates = {
      genre: "Updated Genre",
      year: 2025,
      comment: "Batch updated",
    };

    const updatedFiles = await Promise.all(
      files.map((buffer) => applyTagsToBuffer(buffer, updates)),
    );

    for (const buffer of updatedFiles) {
      const tags = await readTags(buffer);
      assertEquals(tags.genre, [updates.genre]);
      assertEquals(tags.year, updates.year);
      assertEquals(tags.comment, [updates.comment]);
    }
  });

  it("Cross-Format Tag Transfer", async () => {
    const { readTags, applyTagsToBuffer } = await import(
      "../src/simple/index.ts"
    );
    const { readFileData } = await import("../src/utils/file.ts");
    const { TEST_TAGS } = await import("./test-utils.ts");

    const sourceBuffer = await readFileData(TEST_FILES.mp3);
    const sourceWithTags = await applyTagsToBuffer(
      sourceBuffer,
      TEST_TAGS.basic,
    );
    const sourceTags = await readTags(sourceWithTags);

    const targetBuffer = await readFileData(TEST_FILES.flac);
    const targetWithTags = await applyTagsToBuffer(targetBuffer, sourceTags);

    const targetTags = await readTags(targetWithTags);
    assertEquals(targetTags.title, sourceTags.title);
    assertEquals(targetTags.artist, sourceTags.artist);
    assertEquals(targetTags.album, sourceTags.album);
  });

  it({
    name: "Concurrent Operations",
    ignore: Deno.env.get("CI") === "true",
    fn: async () => {
      let taglib: TagLib | undefined;
      try {
        taglib = await TagLib.initialize({ forceBufferMode: true });
        const { createTestFiles, measureTime } = await import(
          "./test-utils.ts"
        );

        const files = await createTestFiles(20, "mp3");

        const { timeMs } = await measureTime(async () => {
          await Promise.all(
            files.map(async (buffer) => {
              const file = await taglib!.open(buffer);
              try {
                const tag = file.tag();
                tag.setTitle(`Concurrent ${Math.random()}`);
                file.save();
              } finally {
                file.dispose();
              }
            }),
          );
        });

        const timeLimit = 4000;
        assert(
          timeMs < timeLimit,
          `Concurrent operations took ${timeMs}ms (limit: ${timeLimit}ms)`,
        );
      } catch (error) {
        console.error("Error in concurrent operations test:", error);
        throw error;
      }
    },
  });

  it("readMetadataBatch - includes cover art and dynamics data", async () => {
    const { readMetadataBatch } = await import("../src/simple/index.ts");

    const testFiles = [
      "./tests/test-files/mp3/kiss-snippet.mp3",
      "./tests/test-files/flac/kiss-snippet.flac",
      "./tests/test-files/mp4/kiss-snippet.m4a",
    ];

    const result = await readMetadataBatch(testFiles, {
      concurrency: 3,
    });

    assertEquals(result.items.length, testFiles.length);
    assertEquals(result.items.every((item) => item.status === "ok"), true);

    for (const item of result.items) {
      if (item.status !== "ok") continue;
      assertExists(item.data.tags);
      assertExists(item.data.properties);
      assertEquals(typeof item.data.hasCoverArt, "boolean");

      if (item.data.dynamics) {
        assertEquals(typeof item.data.dynamics, "object");

        if (item.data.dynamics.replayGainTrackGain) {
          assertEquals(typeof item.data.dynamics.replayGainTrackGain, "string");
        }
        if (item.data.dynamics.appleSoundCheck) {
          assertEquals(typeof item.data.dynamics.appleSoundCheck, "string");
        }
      }

      console.log(
        `${item.path}: hasCoverArt=${item.data.hasCoverArt}, dynamics=${
          item.data.dynamics ? "yes" : "no"
        }`,
      );
    }
  });

  it("readMetadataBatch - processes files with dynamics metadata", async () => {
    const { readMetadataBatch } = await import(
      "../src/simple/index.ts"
    );
    const { TagLib } = await import("../src/taglib.ts");

    const tempFile = await Deno.makeTempFile({ suffix: ".mp3" });
    const testData = await Deno.readFile(
      "./tests/test-files/mp3/kiss-snippet.mp3",
    );
    await Deno.writeFile(tempFile, testData);

    try {
      const taglib = await TagLib.initialize({ forceBufferMode: true });
      const audioFile = await taglib.open(tempFile);
      audioFile.setProperty("REPLAYGAIN_TRACK_GAIN", "-6.5 dB");
      audioFile.setProperty("REPLAYGAIN_TRACK_PEAK", "0.95");
      audioFile.save();
      await audioFile.saveToFile(tempFile);
      audioFile.dispose();

      const result = await readMetadataBatch([tempFile]);

      assertEquals(result.items.length, 1);
      assertEquals(result.items[0].status, "ok");
      if (result.items[0].status === "ok") {
        const data = result.items[0].data;

        assertExists(data.dynamics);
        assertEquals(data.dynamics.replayGainTrackGain, "-6.5 dB");
        assertEquals(data.dynamics.replayGainTrackPeak, "0.95");
      }
    } finally {
      await Deno.remove(tempFile);
    }
  });
});
