#!/usr/bin/env -S deno test --allow-read --allow-run

/**
 * Integration tests for all API styles across different scenarios
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

Deno.test("Auto API: Zero Config", async () => {
  const { TagLib, withFile } = await import("../src/auto.ts");
  
  // Test direct file opening
  const file = await TagLib.openFile(TEST_MP3);
  assertEquals(file.isValid(), true, "File should be valid");
  
  const tags = file.tag();
  assertExists(tags, "Should have tags");
  
  file.dispose();
  
  // Test withFile helper
  const result = await withFile(TEST_MP3, file => {
    const props = file.audioProperties();
    return {
      valid: file.isValid(),
      format: file.format(),
      duration: props.length,
      bitrate: props.bitrate
    };
  });
  
  assertEquals(result.valid, true, "File should be valid in withFile");
  assert(result.duration > 0, "Duration should be positive");
  assert(result.bitrate > 0, "Bitrate should be positive");
});

Deno.test("Fluent API: Method Chaining", async () => {
  const { TagLib } = await import("../src/fluent.ts");
  
  // Test quick operations
  const tags = await TagLib.read(TEST_MP3);
  assertExists(tags, "Quick read should return tags");
  
  const props = await TagLib.properties(TEST_MP3);
  assertExists(props, "Properties should exist");
  assert(props.length > 0, "Duration should be positive");
  
  const format = await TagLib.format(TEST_MP3);
  assertEquals(format, "MP3", "Should detect MP3 format");
  
  // Test chaining
  const file = await TagLib.fromFile(TEST_MP3);
  const updatedTags = await file
    .setTitle("Fluent Test")
    .setArtist("Chain Artist")
    .setAlbum("Chain Album")
    .getTags();
  
  assertEquals(updatedTags.title, "Fluent Test", "Title should be updated");
  assertEquals(updatedTags.artist, "Chain Artist", "Artist should be updated");
  assertEquals(updatedTags.album, "Chain Album", "Album should be updated");
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
  const { TagLib } = await import("../src/auto.ts");
  
  // Test multiple file operations
  for (let i = 0; i < 10; i++) {
    const file = await TagLib.openFile(TEST_MP3);
    assert(file.isValid(), `File ${i} should be valid`);
    file.dispose();
  }
  
  // Test withFile auto-cleanup
  for (let i = 0; i < 10; i++) {
    const { withFile } = await import("../src/auto.ts");
    await withFile(TEST_MP3, file => {
      return file.isValid();
    });
  }
});

Deno.test("Batch Processing", async () => {
  const { TagLib } = await import("../src/fluent.ts");
  
  const files = [TEST_MP3, TEST_FLAC];
  
  const results = await TagLib.batch(files, async file => {
    const format = await file.getFormat();
    const props = await file.getProperties();
    return {
      format,
      duration: props.length,
      bitrate: props.bitrate
    };
  });
  
  assertEquals(results.length, 2, "Should process both files");
  assertEquals(results[0].format, "MP3", "First should be MP3");
  assertEquals(results[1].format, "FLAC", "Second should be FLAC");
  
  results.forEach(result => {
    assert(result.duration > 0, "Duration should be positive");
    assert(result.bitrate > 0, "Bitrate should be positive");
  });
});

// Runtime-specific tests
if (isDeno) {
  Deno.test("Deno: File path reading", async () => {
    const { readTags } = await import("../src/simple.ts");
    
    // Deno can read file paths directly
    const tags = await readTags(TEST_MP3);
    assertExists(tags, "Should read from file path");
  });
}

if (isNode) {
  Deno.test("Node: Buffer compatibility", async () => {
    const { readTags } = await import("../src/simple.ts");
    const fs = await import("fs/promises");
    
    // Node.js Buffer should work
    const buffer = await fs.readFile(TEST_MP3);
    const tags = await readTags(buffer);
    assertExists(tags, "Should read from Node Buffer");
  });
}

// Cross-runtime compatibility test
Deno.test("Cross-runtime: ArrayBuffer support", async () => {
  const { readTags } = await import("../src/simple.ts");
  
  const data = await Deno.readFile(TEST_MP3);
  const arrayBuffer = data.buffer;
  
  const tags = await readTags(arrayBuffer);
  assertExists(tags, "Should read from ArrayBuffer");
});

// Performance comparison (not a strict test, just logging)
Deno.test("Performance: API comparison", async () => {
  const iterations = 10;
  
  // Traditional API
  const { TagLib: TraditionalTagLib } = await import("../index.ts");
  const traditionalStart = performance.now();
  const taglib = await TraditionalTagLib.initialize();
  
  for (let i = 0; i < iterations; i++) {
    const data = await Deno.readFile(TEST_MP3);
    const file = taglib.openFile(data);
    file.tag();
    file.dispose();
  }
  const traditionalTime = performance.now() - traditionalStart;
  
  // Simple API
  const { readTags } = await import("../src/simple.ts");
  const simpleStart = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await readTags(TEST_MP3);
  }
  const simpleTime = performance.now() - simpleStart;
  
  // Auto API
  const { withFile } = await import("../src/auto.ts");
  const autoStart = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await withFile(TEST_MP3, file => file.tag());
  }
  const autoTime = performance.now() - autoStart;
  
  console.log(`\nPerformance (${iterations} iterations):`);
  console.log(`Traditional API: ${traditionalTime.toFixed(2)}ms`);
  console.log(`Simple API: ${simpleTime.toFixed(2)}ms`);
  console.log(`Auto API: ${autoTime.toFixed(2)}ms`);
});