#!/usr/bin/env -S deno test --allow-read --allow-run

/**
 * Integration tests for Simple and Core API styles
 */

import { assertEquals, assertExists, assert } from "@std/assert";

// We'll test with the NPM version since JSR version has import issues
const isNode = typeof process !== 'undefined' && process.versions?.node;
const isBun = typeof (globalThis as any).Bun !== 'undefined';
const isDeno = typeof Deno !== 'undefined';

// Import appropriate modules based on runtime
const runtime = isDeno ? "deno" : isNode ? "node" : isBun ? "bun" : "unknown";
console.log(`Running on: ${runtime}`);

// Test file with actual metadata
const TEST_MP3 = "./tests/test-files/mp3/kiss-snippet.mp3";
const TEST_FLAC = "./tests/test-files/flac/kiss-snippet.flac";

Deno.test("Simple API: Basic Operations", async () => {
  const { readTags, writeTags, readProperties, getFormat, isValidAudioFile } = await import("../src/simple.ts");
  
  // Test validation
  const isValid = await isValidAudioFile(TEST_MP3);
  assertEquals(isValid, true, "MP3 should be valid");
  
  // Test format detection
  const format = await getFormat(TEST_MP3);
  assertEquals(format, "MP3", "Should detect MP3 format");
  
  // Test reading tags
  const tags = await readTags(TEST_MP3);
  assertExists(tags, "Should return tags object");
  assertEquals(typeof tags.year, "number", "Year should be a number");
  
  // Test reading properties
  const props = await readProperties(TEST_MP3);
  assertExists(props, "Should return properties");
  assert(props.length > 0, "Duration should be positive");
  assert(props.bitrate > 0, "Bitrate should be positive");
  assert(props.sampleRate > 0, "Sample rate should be positive");
  
  // Test writing tags
  const modifiedBuffer = await writeTags(TEST_MP3, {
    title: "Integration Test",
    artist: "Test Suite"
  });
  assert(modifiedBuffer.length > 0, "Modified buffer should have content");
});

Deno.test("Core API: Full Control", async () => {
  const { TagLib } = await import("../index.ts");
  
  // Initialize TagLib
  const taglib = await TagLib.initialize();
  
  // Open file
  const fileData = await Deno.readFile(TEST_MP3);
  const file = taglib.openFile(fileData);
  
  // Test file validity
  assertEquals(file.isValid(), true, "File should be valid");
  assertEquals(file.format(), "MP3", "Should detect MP3 format");
  
  // Test reading tags
  const tags = file.tag();
  assertExists(tags, "Should have tags");
  
  // Test audio properties
  const props = file.audioProperties();
  assert(props.length > 0, "Duration should be positive");
  assert(props.bitrate > 0, "Bitrate should be positive");
  assert(props.sampleRate > 0, "Sample rate should be positive");
  
  // Test modifying tags
  file.setTitle("Core Test");
  file.setArtist("Core Artist");
  const modifiedData = file.save();
  assert(modifiedData.length > 0, "Modified data should exist");
  
  // Cleanup
  file.dispose();
  taglib.destroy();
});

Deno.test("Multiple Formats Support", async () => {
  const { readTags, getFormat } = await import("../src/simple.ts");
  
  // Test MP3
  const mp3Format = await getFormat(TEST_MP3);
  assertEquals(mp3Format, "MP3", "Should detect MP3");
  
  const mp3Tags = await readTags(TEST_MP3);
  assertExists(mp3Tags, "Should read MP3 tags");
  
  // Test FLAC
  const flacFormat = await getFormat(TEST_FLAC);
  assertEquals(flacFormat, "FLAC", "Should detect FLAC");
  
  const flacTags = await readTags(TEST_FLAC);
  assertExists(flacTags, "Should read FLAC tags");
});

Deno.test("Error Handling", async () => {
  const { readTags, isValidAudioFile } = await import("../src/simple.ts");
  
  // Test invalid file
  const isValid = await isValidAudioFile("./package.json");
  assertEquals(isValid, false, "Non-audio file should be invalid");
  
  // Test non-existent file
  try {
    await readTags("non-existent-file.mp3");
    assert(false, "Should throw for non-existent file");
  } catch (error) {
    assert(error instanceof Error, "Should throw Error");
  }
});

Deno.test("Memory Management", async () => {
  const { TagLib } = await import("../index.ts");
  
  // Initialize once
  const taglib = await TagLib.initialize();
  
  // Test multiple file operations
  for (let i = 0; i < 10; i++) {
    const fileData = await Deno.readFile(TEST_MP3);
    const file = taglib.openFile(fileData);
    assert(file.isValid(), `File ${i} should be valid`);
    file.dispose();
  }
  
  // Cleanup
  taglib.destroy();
});

Deno.test("Performance Comparison", async () => {
  console.log("\n⏱️  Performance Comparison:");
  
  // Core API timing
  const { TagLib } = await import("../index.ts");
  const coreStart = performance.now();
  const taglib = await TagLib.initialize();
  const fileData = await Deno.readFile(TEST_MP3);
  const file = taglib.openFile(fileData);
  file.tag();
  file.dispose();
  taglib.destroy();
  const coreTime = performance.now() - coreStart;
  
  // Simple API timing
  const { readTags } = await import("../src/simple.ts");
  const simpleStart = performance.now();
  await readTags(TEST_MP3);
  const simpleTime = performance.now() - simpleStart;
  
  console.log(`Core API: ${coreTime.toFixed(2)}ms`);
  console.log(`Simple API: ${simpleTime.toFixed(2)}ms`);
});

Deno.test("Extended Tag Support", async () => {
  const { TagLib } = await import("../index.ts");
  
  const taglib = await TagLib.initialize();
  const fileData = await Deno.readFile(TEST_MP3);
  const file = taglib.openFile(fileData);
  
  // Test extended tags
  const extendedTags = file.extendedTag();
  assertExists(extendedTags, "Should have extended tags");
  
  // Test setting extended tags
  file.setExtendedTag({
    albumArtist: "Test Album Artist",
    bpm: 120,
    compilation: true
  });
  
  const updatedExtended = file.extendedTag();
  assertEquals(updatedExtended.albumArtist, "Test Album Artist");
  assertEquals(updatedExtended.bpm, 120);
  assertEquals(updatedExtended.compilation, true);
  
  // Cleanup
  file.dispose();
  taglib.destroy();
});

Deno.test("Buffer vs File Path", async () => {
  const { readTags } = await import("../src/simple.ts");
  
  // Test with file path
  const tagsFromPath = await readTags(TEST_MP3);
  assertExists(tagsFromPath, "Should read tags from path");
  
  // Test with buffer
  const buffer = await Deno.readFile(TEST_MP3);
  const tagsFromBuffer = await readTags(buffer);
  assertExists(tagsFromBuffer, "Should read tags from buffer");
  
  // Both should have similar data
  assertEquals(tagsFromPath.genre, tagsFromBuffer.genre, "Genre should match");
});