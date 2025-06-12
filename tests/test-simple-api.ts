#!/usr/bin/env -S deno test --allow-read

/**
 * Tests for the simplified API layers
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { readTags, writeTags, readProperties, isValidAudioFile, getFormat } from "../src/simple.ts";
import { TagLib as AutoTagLib, withFile } from "../src/auto.ts";
import { TagLib as FluentTagLib } from "../src/fluent.ts";

const TEST_FILE = "./tests/test-files/mp3/kiss-snippet.mp3";

Deno.test("Simple API: readTags", async () => {
  const tags = await readTags(TEST_FILE);
  
  assertExists(tags);
  assertEquals(typeof tags.title, "string");
  assertEquals(typeof tags.artist, "string");
  assertEquals(typeof tags.album, "string");
});

Deno.test("Simple API: readProperties", async () => {
  const props = await readProperties(TEST_FILE);
  
  assertExists(props);
  assert(props.length > 0, "Duration should be positive");
  assert(props.bitrate > 0, "Bitrate should be positive");
  assert(props.sampleRate > 0, "Sample rate should be positive");
  assert(props.channels > 0, "Channels should be positive");
});

Deno.test("Simple API: isValidAudioFile", async () => {
  const validFile = await isValidAudioFile(TEST_FILE);
  assertEquals(validFile, true);
  
  const invalidFile = await isValidAudioFile("./package.json");
  assertEquals(invalidFile, false);
});

Deno.test("Simple API: getFormat", async () => {
  const format = await getFormat(TEST_FILE);
  assertEquals(format, "MP3");
});

Deno.test("Simple API: writeTags", async () => {
  const newTags = {
    title: "Test Title",
    artist: "Test Artist",
    album: "Test Album",
    year: 2025
  };
  
  const buffer = await writeTags(TEST_FILE, newTags);
  assertExists(buffer);
  assert(buffer.length > 0, "Buffer should have content");
});

Deno.test("Auto API: openFile", async () => {
  const file = await AutoTagLib.openFile(TEST_FILE);
  
  assert(file.isValid(), "File should be valid");
  
  const tags = file.tag();
  assertExists(tags);
  
  file.dispose();
});

Deno.test("Auto API: withFile helper", async () => {
  const result = await withFile(TEST_FILE, file => {
    return {
      valid: file.isValid(),
      format: file.format(),
      title: file.tag().title
    };
  });
  
  assertEquals(result.valid, true);
  assertEquals(result.format, "MP3");
  assertExists(result.title);
});

Deno.test("Auto API: fromBuffer", async () => {
  const buffer = await Deno.readFile(TEST_FILE);
  const file = await AutoTagLib.fromBuffer(buffer);
  
  assert(file.isValid(), "File should be valid");
  assertEquals(file.format(), "MP3");
  
  file.dispose();
});

Deno.test("Fluent API: read tags", async () => {
  const tags = await FluentTagLib.read(TEST_FILE);
  
  assertExists(tags);
  assertEquals(typeof tags.title, "string");
  assertEquals(typeof tags.artist, "string");
});

Deno.test("Fluent API: properties", async () => {
  const props = await FluentTagLib.properties(TEST_FILE);
  
  assertExists(props);
  assert(props.length > 0);
  assert(props.bitrate > 0);
});

Deno.test("Fluent API: format", async () => {
  const format = await FluentTagLib.format(TEST_FILE);
  assertEquals(format, "MP3");
});

Deno.test("Fluent API: chaining", async () => {
  const file = await FluentTagLib.fromFile(TEST_FILE);
  const result = await file
    .setTitle("Fluent Test")
    .setArtist("Fluent Artist")
    .getTags();
  
  assertEquals(result.title, "Fluent Test");
  assertEquals(result.artist, "Fluent Artist");
});

Deno.test("Fluent API: batch processing", async () => {
  const files = [
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/flac/kiss-snippet.flac"
  ];
  
  const results = await FluentTagLib.batch(files, async file => {
    const format = await file.getFormat();
    return format;
  });
  
  assertEquals(results.length, 2);
  assertEquals(results[0], "MP3");
  assertEquals(results[1], "FLAC");
});

// Test different file formats
const formats = [
  { path: "./tests/test-files/wav/kiss-snippet.wav", format: "WAV" },
  { path: "./tests/test-files/mp3/kiss-snippet.mp3", format: "MP3" },
  { path: "./tests/test-files/flac/kiss-snippet.flac", format: "FLAC" },
  { path: "./tests/test-files/ogg/kiss-snippet.ogg", format: "OGG" },
  { path: "./tests/test-files/mp4/kiss-snippet.m4a", format: "MP4" }
];

for (const { path, format } of formats) {
  Deno.test(`Simple API: ${format} format detection`, async () => {
    const detected = await getFormat(path);
    assertEquals(detected, format);
  });
  
  Deno.test(`Simple API: ${format} validation`, async () => {
    const valid = await isValidAudioFile(path);
    assertEquals(valid, true);
  });
}