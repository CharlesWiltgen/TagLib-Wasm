#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Simple API Examples for TagLib-Wasm
 *
 * This demonstrates the go-taglib inspired simple API that provides
 * a minimal, easy-to-use interface for common operations.
 */

import {
  applyTags,
  clearTags,
  isValidAudioFile,
  readFormat,
  readProperties,
  readTags,
} from "../src/simple/index.ts";

// For go-taglib style constants
import * as taglib from "../../src/simple/index.ts";

async function demonstrateSimpleAPI() {
  console.log("🎵 TagLib-Wasm - Simple API Examples");
  console.log("=".repeat(50));

  const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";

  // Example 1: Read tags (go-taglib style)
  console.log("\n📖 Example 1: Reading tags");
  const tags = await readTags(testFile);
  console.log("Title:", tags.title);
  console.log("Artist:", tags.artist);
  console.log("Album:", tags.album);
  console.log("Year:", tags.year);

  // Example 2: Using constants (go-taglib compatibility)
  console.log("\n📖 Example 2: Using field constants");
  console.log(`${taglib.Title}:`, tags.title);
  console.log(`${taglib.Artist}:`, tags.artist);
  console.log(`${taglib.Album}:`, tags.album);

  // Example 3: Read audio properties
  console.log("\n🎧 Example 3: Reading audio properties");
  const props = await readProperties(testFile);
  console.log(`Duration: ${props.length} seconds`);
  console.log(`Bitrate: ${props.bitrate} kbps`);
  console.log(`Sample rate: ${props.sampleRate} Hz`);
  console.log(`Channels: ${props.channels}`);

  // Example 4: Check if file is valid
  console.log("\n✅ Example 4: Validation");
  const isValid = await isValidAudioFile(testFile);
  console.log(`Is valid audio file: ${isValid}`);

  const invalidFile = "./package.json";
  const isInvalid = await isValidAudioFile(invalidFile);
  console.log(`Is package.json an audio file: ${isInvalid}`);

  // Example 5: Get format
  console.log("\n📄 Example 5: Format detection");
  const format = await readFormat(testFile);
  console.log(`File format: ${format}`);

  // Example 6: Apply tags (in-memory only)
  console.log("\n✏️ Example 6: Applying tags");
  console.log("Note: Changes are in-memory only");

  const modifiedBuffer = await applyTags(testFile, {
    title: "Simple API Demo",
    artist: "TagLib-Wasm",
    album: "Examples Album",
    year: 2025,
    track: 1,
    genre: "Demo",
  });

  console.log("Tags applied successfully (in memory)");
  console.log("Modified buffer size:", modifiedBuffer.length, "bytes");

  // Example 7: Clear all tags
  console.log("\n🧹 Example 7: Clearing tags");
  const cleanBuffer = await clearTags(testFile);
  console.log("All tags cleared (in memory)");
  console.log("Clean buffer size:", cleanBuffer.length, "bytes");
}

async function demonstrateBatchProcessing() {
  console.log("\n" + "=".repeat(50));
  console.log("📚 Batch Processing with Simple API");
  console.log("=".repeat(50));

  const files = [
    "./tests/test-files/wav/kiss-snippet.wav",
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/flac/kiss-snippet.flac",
    "./tests/test-files/ogg/kiss-snippet.ogg",
    "./tests/test-files/mp4/kiss-snippet.m4a",
  ];

  console.log("\nProcessing multiple files:");

  for (const file of files) {
    try {
      const format = await readFormat(file);
      const props = await readProperties(file);
      const tags = await readTags(file);

      console.log(`\n📁 ${file}`);
      console.log(`  Format: ${format}`);
      console.log(`  Duration: ${props.length}s`);
      console.log(`  Bitrate: ${props.bitrate} kbps`);
      console.log(`  Title: "${tags.title || "(none)"}""`);
      console.log(`  Artist: "${tags.artist || "(none)"}""`);
    } catch (error) {
      console.log(`\n❌ ${file}: ${error.message}`);
    }
  }
}

async function demonstrateRealWorldUsage() {
  console.log("\n" + "=".repeat(50));
  console.log("🌍 Real-World Usage Patterns");
  console.log("=".repeat(50));

  const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";

  // Pattern 1: Quick tag check
  console.log("\n🔍 Pattern 1: Quick tag check");
  const { title, artist, album } = await readTags(testFile);
  if (!title || !artist || !album) {
    console.log("Missing metadata detected!");
  } else {
    console.log("All basic metadata present ✅");
  }

  // Pattern 2: Format-specific processing
  console.log("\n🎯 Pattern 2: Format-specific processing");
  const format = await readFormat(testFile);
  switch (format) {
    case "MP3":
      console.log("Processing MP3 file...");
      // MP3-specific logic
      break;
    case "FLAC":
      console.log("Processing FLAC file...");
      // FLAC-specific logic
      break;
    default:
      console.log(`Processing ${format} file...`);
  }

  // Pattern 3: Validation before processing
  console.log("\n🛡️ Pattern 3: Safe processing");
  async function processAudioFile(file: string) {
    if (!await isValidAudioFile(file)) {
      throw new Error("Not a valid audio file");
    }

    const tags = await readTags(file);
    const props = await readProperties(file);

    return {
      metadata: tags,
      duration: props.length,
      quality: props.bitrate >= 256 ? "high" : "standard",
    };
  }

  try {
    const result = await processAudioFile(testFile);
    console.log("File processed successfully:", result);
  } catch (error) {
    console.error("Processing failed:", error.message);
  }

  // Pattern 4: Bulk metadata update
  console.log("\n📝 Pattern 4: Bulk metadata update");
  const filesToUpdate = [
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/flac/kiss-snippet.flac",
  ];

  for (const file of filesToUpdate) {
    try {
      await applyTags(file, {
        album: "Bulk Update Album",
        year: 2025,
        genre: "Updated",
      });
      console.log(`✅ Updated: ${file}`);
    } catch (error) {
      console.log(`❌ Failed: ${file} - ${error.message}`);
    }
  }
}

// Run all examples
if (import.meta.main) {
  await demonstrateSimpleAPI();
  await demonstrateBatchProcessing();
  await demonstrateRealWorldUsage();

  console.log("\n✨ Simple API examples completed!");
}
