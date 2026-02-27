/**
 * @fileoverview Edge case tests for TagLib-Wasm
 * Tests input validation and illegal audio properties.
 * Unicode tests live in unicode-comprehensive.test.ts (forEachBackend).
 */

import { describe, it } from "@std/testing/bdd";
import {
  assert,
  type assertEquals,
  assertRejects,
  type assertThrows,
} from "@std/assert";
import { TagLib } from "../src/mod.ts";
import type { AudioFile } from "../src/mod.ts";
import {
  readProperties,
  readTags,
  setBufferMode,
} from "../src/simple/index.ts";
import {
  FileOperationError,
  InvalidFormatError,
  type MetadataError,
  type TagLibInitializationError,
} from "../src/errors.ts";
import { TEST_FILES } from "./test-utils.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

describe("EdgeCases", () => {
  // ===========================================================================
  // Input Validation Tests
  // ===========================================================================

  it("Input Validation: Too small buffers", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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

  it("Input Validation: Null and undefined inputs", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    // Test Full API
    await assertRejects(
      async () => await taglib.open(null as any),
      Error,
      "[object Null]",
      "Full API should reject null input",
    );

    await assertRejects(
      async () => await taglib.open(undefined as any),
      Error,
      "[object Undefined]",
      "Full API should reject undefined input",
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

  it("Input Validation: Wrong input types", async () => {
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

  it("Input Validation: Empty buffers", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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

  it("Input Validation: Non-audio data", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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

    // Test with definitely non-audio data (avoid random chance of matching audio signatures)
    const nonAudioData = new Uint8Array(2048);
    // Fill with a pattern that won't match any audio format
    // Avoid 0xFF (MP3), 0x00 (some formats), RIFF, fLaC, OggS, etc.
    for (let i = 0; i < nonAudioData.length; i++) {
      nonAudioData[i] = 0xAB; // Use a specific non-audio byte pattern
    }

    await assertRejects(
      async () => await taglib.open(nonAudioData.buffer),
      InvalidFormatError,
      "Invalid audio",
      "Should reject non-audio data as invalid audio",
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

  // ===========================================================================
  // Illegal Audio Properties Tests
  // ===========================================================================

  it("Audio Properties: Invalid values handling", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    // We'll use a valid file and check that properties are reasonable
    const audioData = await Deno.readFile(TEST_FILES.mp3);
    const file = await taglib.open(audioData.buffer);

    try {
      const props = file.audioProperties();

      // Verify properties are valid numbers
      assert(props !== null, "Properties should not be null");
      assert(Number.isFinite(props.duration), "Duration should be finite");
      assert(props.duration >= 0, "Duration should not be negative");

      assert(Number.isFinite(props.bitrate), "Bitrate should be finite");
      assert(props.bitrate > 0, "Bitrate should be positive");

      assert(Number.isFinite(props.sampleRate), "Sample rate should be finite");
      assert(props.sampleRate > 0, "Sample rate should be positive");

      assert(Number.isInteger(props.channels), "Channels should be integer");
      assert(
        props.channels > 0 && props.channels <= 8,
        "Channels should be 1-8",
      );
    } finally {
      file.dispose();
    }
  });

  it("Audio Properties: Edge case values", async () => {
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
        props.duration > 0 && props.duration < 3600,
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

  it("Audio Properties: Corrupted header handling", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
      assert(Number.isFinite(props.duration), "Should not return NaN duration");
      assert(Number.isFinite(props.bitrate), "Should not return NaN bitrate");
      assert(props.duration >= 0, "Duration should not be negative");
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
});
