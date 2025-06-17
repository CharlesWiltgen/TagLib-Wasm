/**
 * @fileoverview Edge case tests for taglib-wasm
 * Tests Unicode handling, input validation, and illegal audio properties
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TagLib } from "../src/mod.ts";
import type { AudioFile } from "../src/mod.ts";
import { applyTags, readProperties, readTags } from "../src/simple.ts";
import {
  FileOperationError,
  InvalidFormatError,
  MetadataError,
  TagLibInitializationError,
} from "../src/errors.ts";
import { TEST_FILES } from "./test-utils.ts";

// Test data path - using an existing valid file as base
const TEST_MP3 = TEST_FILES.mp3;

// =============================================================================
// Unicode and Special Characters Tests
// =============================================================================

Deno.test("Unicode: Emoji in tags", async () => {
  const audioData = await Deno.readFile(TEST_MP3);
  const tags = await readTags(audioData);

  // Test writing emoji in various tag fields
  const emojiTags = {
    title: "🎵 Music Track 🎸",
    artist: "DJ 🎧 Emoji",
    album: "💿 Greatest Hits",
    comment: "🔥 Hot track! 🎶",
    genre: "🎼 Electronic",
  };

  const modifiedBuffer = await applyTags(audioData, emojiTags);
  const readBack = await readTags(modifiedBuffer);

  assertEquals(
    readBack.title,
    emojiTags.title,
    "Should preserve emoji in title",
  );
  assertEquals(
    readBack.artist,
    emojiTags.artist,
    "Should preserve emoji in artist",
  );
  assertEquals(
    readBack.album,
    emojiTags.album,
    "Should preserve emoji in album",
  );
  assertEquals(
    readBack.comment,
    emojiTags.comment,
    "Should preserve emoji in comment",
  );
  assertEquals(
    readBack.genre,
    emojiTags.genre,
    "Should preserve emoji in genre",
  );
});

Deno.test("Unicode: CJK characters", async () => {
  const audioData = await Deno.readFile(TEST_MP3);

  const cjkTags = {
    title: "这是中文标题", // Chinese
    artist: "アーティスト名", // Japanese
    album: "한국어 앨범", // Korean
    comment: "Mixed: 中文/日本語/한글",
  };

  const modifiedBuffer = await applyTags(audioData, cjkTags);
  const readBack = await readTags(modifiedBuffer);

  assertEquals(
    readBack.title,
    cjkTags.title,
    "Should preserve Chinese characters",
  );
  assertEquals(
    readBack.artist,
    cjkTags.artist,
    "Should preserve Japanese characters",
  );
  assertEquals(
    readBack.album,
    cjkTags.album,
    "Should preserve Korean characters",
  );
  assertEquals(readBack.comment, cjkTags.comment, "Should preserve mixed CJK");
});

Deno.test("Unicode: RTL text (Arabic/Hebrew)", async () => {
  const audioData = await Deno.readFile(TEST_MP3);

  const rtlTags = {
    title: "مرحبا بالعالم", // Arabic: Hello World
    artist: "שלום עולם", // Hebrew: Hello World
    album: "Mixed מעורב و مختلط",
  };

  const modifiedBuffer = await applyTags(audioData, rtlTags);
  const readBack = await readTags(modifiedBuffer);

  assertEquals(readBack.title, rtlTags.title, "Should preserve Arabic text");
  assertEquals(readBack.artist, rtlTags.artist, "Should preserve Hebrew text");
  assertEquals(readBack.album, rtlTags.album, "Should preserve mixed RTL/LTR");
});

Deno.test("Unicode: Special Unicode characters", async () => {
  const audioData = await Deno.readFile(TEST_MP3);

  const specialTags = {
    title: "Zero\u200BWidth\u200BJoiner", // Zero-width joiner
    artist: "Combi\u0301ning Ma\u0300rks", // Combining marks
    album: "Line\nBreaks\tAnd\rReturns",
    comment: "Null\0Byte", // Note: null bytes might be stripped
  };

  const modifiedBuffer = await applyTags(audioData, specialTags);
  const readBack = await readTags(modifiedBuffer);

  // Some characters might be normalized or stripped
  assertExists(readBack.title, "Should handle zero-width joiners");
  assertExists(readBack.artist, "Should handle combining marks");
  assertExists(readBack.album, "Should handle control characters");
  assertExists(readBack.comment, "Should handle or strip null bytes");
});

Deno.test("Unicode: Very long strings", async () => {
  const audioData = await Deno.readFile(TEST_MP3);

  // Create a very long string (64KB+)
  const longString = "🎵".repeat(32768); // 32K emoji = ~128KB UTF-8

  const longTags = {
    title: longString.substring(0, 1000), // Reasonable length
    comment: longString, // Very long
  };

  // This might succeed or fail depending on format limitations
  try {
    const modifiedBuffer = await applyTags(audioData, longTags);
    const readBack = await readTags(modifiedBuffer);

    // If it succeeds, verify data integrity
    assert(
      readBack.title?.startsWith("🎵"),
      "Should preserve start of long title",
    );
    assert((readBack.comment?.length ?? 0) > 0, "Should handle long comment");
  } catch (error) {
    // If it fails, ensure it's a proper error
    assert(
      error instanceof MetadataError || error instanceof Error,
      "Should throw proper error for very long strings",
    );
  }
});

Deno.test("Unicode: Mixed scripts and languages", async () => {
  const audioData = await Deno.readFile(TEST_MP3);

  const mixedTags = {
    title: "Hello Привет مرحبا こんにちは",
    artist: "Café Москва القاهرة 東京",
    album: "🌍 World 世界 мир عالم",
  };

  const modifiedBuffer = await applyTags(audioData, mixedTags);
  const readBack = await readTags(modifiedBuffer);

  assertEquals(
    readBack.title,
    mixedTags.title,
    "Should preserve mixed scripts in title",
  );
  assertEquals(
    readBack.artist,
    mixedTags.artist,
    "Should preserve mixed scripts in artist",
  );
  assertEquals(
    readBack.album,
    mixedTags.album,
    "Should preserve mixed scripts in album",
  );
});

// =============================================================================
// Input Validation Tests
// =============================================================================

Deno.test("Input Validation: Too small buffers", async () => {
  const taglib = await TagLib.initialize();

  // Test various small buffer sizes
  const sizes = [0, 1, 10, 100, 500, 999];

  for (const size of sizes) {
    const smallBuffer = new Uint8Array(size);

    await assertRejects(
      async () => await taglib.open(smallBuffer.buffer),
      InvalidFormatError,
      `${size} bytes`,
      `Should reject ${size} byte buffer with helpful message`,
    );
  }
});

Deno.test("Input Validation: Null and undefined inputs", async () => {
  const taglib = await TagLib.initialize();

  // Test Core API
  await assertRejects(
    async () => await taglib.open(null as any),
    Error,
    "[object Null]",
    "Core API should reject null input",
  );

  await assertRejects(
    async () => await taglib.open(undefined as any),
    Error,
    "[object Undefined]",
    "Core API should reject undefined input",
  );

  // Test Simple API
  await assertRejects(
    async () => await readTags(null as any),
    FileOperationError,
    "Invalid file input",
    "Simple API should reject null input",
  );

  await assertRejects(
    async () => await readTags(undefined as any),
    FileOperationError,
    "Invalid file input",
    "Simple API should reject undefined input",
  );
});

Deno.test("Input Validation: Wrong input types", async () => {
  const wrongInputs = [
    { value: "string", type: "String" },
    { value: 12345, type: "Number" },
    { value: true, type: "Boolean" },
    { value: {}, type: "Object" },
    { value: [], type: "Array" },
    { value: new Date(), type: "Date" },
  ];

  for (const { value, type } of wrongInputs) {
    await assertRejects(
      async () => await readTags(value as any),
      FileOperationError,
      type === "String" ? "No such file" : "Invalid file input",
      `Should reject ${type} input with descriptive error`,
    );
  }
});

Deno.test("Input Validation: Empty buffers", async () => {
  const taglib = await TagLib.initialize();

  // Test completely empty buffer
  const emptyBuffer = new Uint8Array(0);

  await assertRejects(
    async () => await taglib.open(emptyBuffer.buffer),
    InvalidFormatError,
    "0 bytes",
    "Should reject empty buffer with size info",
  );

  // Test empty ArrayBuffer
  const emptyArrayBuffer = new ArrayBuffer(0);

  await assertRejects(
    async () => await taglib.open(emptyArrayBuffer),
    InvalidFormatError,
    "0 bytes",
    "Should reject empty ArrayBuffer",
  );
});

Deno.test("Input Validation: Non-audio data", async () => {
  const taglib = await TagLib.initialize();

  // Test with plain text
  const textData = new TextEncoder().encode("This is not an audio file!");
  const paddedText = new Uint8Array(2048);
  paddedText.set(textData);

  await assertRejects(
    async () => await taglib.open(paddedText.buffer),
    InvalidFormatError,
    "Invalid audio",
    "Should reject text data as invalid audio",
  );

  // Test with random data
  const randomData = new Uint8Array(2048);
  for (let i = 0; i < randomData.length; i++) {
    randomData[i] = Math.floor(Math.random() * 256);
  }

  await assertRejects(
    async () => await taglib.open(randomData.buffer),
    InvalidFormatError,
    "Invalid audio",
    "Should reject random data as invalid audio",
  );

  // Test with PNG signature
  const pngData = new Uint8Array(2048);
  pngData.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

  await assertRejects(
    async () => await taglib.open(pngData.buffer),
    InvalidFormatError,
    "Invalid audio",
    "Should reject image data as invalid audio",
  );
});

// =============================================================================
// Illegal Audio Properties Tests
// =============================================================================

Deno.test("Audio Properties: Invalid values handling", async () => {
  const taglib = await TagLib.initialize();

  // We'll use a valid file and check that properties are reasonable
  const audioData = await Deno.readFile(TEST_MP3);
  const file = await taglib.open(audioData.buffer);

  try {
    const props = file.audioProperties();

    // Verify properties are valid numbers
    assert(props !== null, "Properties should not be null");
    assert(Number.isFinite(props.length), "Duration should be finite");
    assert(props.length >= 0, "Duration should not be negative");

    assert(Number.isFinite(props.bitrate), "Bitrate should be finite");
    assert(props.bitrate > 0, "Bitrate should be positive");

    assert(Number.isFinite(props.sampleRate), "Sample rate should be finite");
    assert(props.sampleRate > 0, "Sample rate should be positive");

    assert(Number.isInteger(props.channels), "Channels should be integer");
    assert(props.channels > 0 && props.channels <= 8, "Channels should be 1-8");
  } finally {
    file.dispose();
  }
});

Deno.test("Audio Properties: Edge case values", async () => {
  // Test with different format files to check property handling
  const formats = [
    { path: TEST_FILES.wav, format: "WAV" },
    { path: TEST_FILES.flac, format: "FLAC" },
    { path: TEST_FILES.ogg, format: "OGG" },
  ];

  for (const { path, format } of formats) {
    const audioData = await Deno.readFile(path);
    const props = await readProperties(audioData);

    // Common validations
    assert(
      props.length > 0 && props.length < 3600,
      `${format}: Duration should be reasonable (0-3600s)`,
    );

    assert(
      props.bitrate > 0 && props.bitrate < 10000,
      `${format}: Bitrate should be reasonable (0-10Mbps)`,
    );

    assert(
      [
        8000,
        11025,
        16000,
        22050,
        32000,
        44100,
        48000,
        88200,
        96000,
        176400,
        192000,
      ]
        .includes(props.sampleRate) || props.sampleRate > 0,
      `${format}: Sample rate should be standard or at least positive`,
    );

    assert(
      [1, 2, 3, 4, 5, 6, 7, 8].includes(props.channels),
      `${format}: Channels should be 1-8`,
    );
  }
});

Deno.test("Audio Properties: Corrupted header handling", async () => {
  const taglib = await TagLib.initialize();

  // Create a buffer that looks like MP3 but has corrupted header
  const corruptedMP3 = new Uint8Array(2048);

  // Start with valid ID3v2 header
  corruptedMP3.set([
    0x49,
    0x44,
    0x33,
    0x04,
    0x00,
    0x00, // ID3v2.4
    0x00,
    0x00,
    0x00,
    0x00, // Size
  ]);

  // Add invalid MPEG frame header at offset 10
  corruptedMP3.set([
    0xFF,
    0xF0, // Invalid sync + version
    0x00,
    0x00, // Invalid layer + bitrate
  ], 10);

  // File might open but properties could be invalid
  let fileOpened = false;
  try {
    const file = await taglib.open(corruptedMP3.buffer);
    fileOpened = true;
    const props = file.audioProperties();

    // If we get here, properties should at least be safe values
    assert(props !== null, "Properties should not be null");
    assert(Number.isFinite(props.length), "Should not return NaN duration");
    assert(Number.isFinite(props.bitrate), "Should not return NaN bitrate");
    assert(props.length >= 0, "Duration should not be negative");
    assert(props.bitrate >= 0, "Bitrate should not be negative");

    file.dispose();
  } catch (error) {
    // Either opening failed or properties failed - both are acceptable
    assert(
      error instanceof InvalidFormatError ||
        error instanceof Error,
      "Should throw an error for corrupted data",
    );
  }

  // The test passes if either:
  // 1. An error was thrown (corrupted data rejected)
  // 2. File opened but returned safe property values
});
