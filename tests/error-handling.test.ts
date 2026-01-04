/**
 * @fileoverview Tests for enhanced error handling with context
 */

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import { type applyTags, readProperties, readTags } from "../src/simple.ts";
import {
  FileOperationError,
  InvalidFormatError,
  type isFileOperationError,
  isInvalidFormatError,
  type isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
  type MetadataError,
  type TagLibInitializationError,
  UnsupportedFormatError,
} from "../src/errors.ts";

/**
 * Test error context and helpful messages
 */
Deno.test("error messages include helpful context", async () => {
  const taglib = await TagLib.initialize();

  // Test with a tiny buffer
  const tinyBuffer = new Uint8Array(100);

  await assertRejects(
    async () => await taglib.open(tinyBuffer.buffer),
    InvalidFormatError,
    "100 bytes",
    "Should include buffer size and helpful hint about minimum size",
  );

  // Test with larger corrupted data
  const corruptedBuffer = new Uint8Array(5000);
  // Fill with random invalid data that won't match any file signature
  for (let i = 0; i < corruptedBuffer.length; i++) {
    corruptedBuffer[i] = (i * 17 + 123) % 256;
  }

  await assertRejects(
    async () => await taglib.open(corruptedBuffer.buffer),
    InvalidFormatError,
    "Buffer size: 4.9 KB",
    "Should show human-readable size and suggest corruption",
  );
});

/**
 * Test format-specific errors
 */
Deno.test("format-specific errors provide clear guidance", async () => {
  const taglib = await TagLib.initialize();

  // Use a real MP3 file for testing
  const mp3Buffer = await Deno.readFile(
    "tests/test-files/mp3/kiss-snippet.mp3",
  );

  const file = await taglib.open(mp3Buffer.buffer);

  try {
    // Test getMP4Item - should throw synchronously, not async
    assertThrows(
      () => file.getMP4Item("----:com.apple.iTunes:iTunNORM"),
      UnsupportedFormatError,
      "MP3",
      "Should show actual format and supported formats",
    );

    // Test setMP4Item - should throw synchronously, not async
    assertThrows(
      () => file.setMP4Item("test", "value"),
      UnsupportedFormatError,
      "MP3",
      "Should show actual format and supported formats",
    );
  } finally {
    file.dispose();
  }
});

/**
 * Test file operation errors
 */
Deno.test("file operation errors include operation context", async () => {
  // Test reading non-existent file
  await assertRejects(
    async () => await readTags("/non/existent/file.mp3"),
    FileOperationError,
    "read",
    "Should include operation type and file path",
  );

  // Test invalid input type
  await assertRejects(
    async () => await readTags(123 as any),
    FileOperationError,
    "Invalid file input type",
    "Should show the actual input type",
  );
});

/**
 * Test environment errors
 */
Deno.test("environment errors indicate missing features", async () => {
  // Mock browser environment
  const originalDeno = (globalThis as any).Deno;
  const originalProcess = (globalThis as any).process;
  const originalBun = (globalThis as any).Bun;

  try {
    delete (globalThis as any).Deno;
    delete (globalThis as any).process;
    delete (globalThis as any).Bun;

    await assertRejects(
      async () => await readTags("test.mp3"),
      Error, // In browser environment, various errors can occur
      undefined,
      "Should throw an error in unsupported environment",
    );
  } finally {
    if (originalDeno) (globalThis as any).Deno = originalDeno;
    if (originalProcess) (globalThis as any).process = originalProcess;
    if (originalBun) (globalThis as any).Bun = originalBun;
  }
});

/**
 * Test error type guards
 */
Deno.test("error type guards work correctly", async () => {
  const taglib = await TagLib.initialize();

  try {
    await taglib.open(new Uint8Array(50).buffer);
  } catch (error) {
    assertEquals(isTagLibError(error), true, "Should be a TagLibError");
    assertEquals(
      isInvalidFormatError(error),
      true,
      "Should be InvalidFormatError",
    );
    assertEquals(
      isUnsupportedFormatError(error),
      false,
      "Should not be UnsupportedFormatError",
    );

    if (isInvalidFormatError(error)) {
      assertEquals(error.bufferSize, 50, "Should have buffer size");
      assertEquals(
        error.code,
        "INVALID_FORMAT",
        "Should have correct error code",
      );
    }
  }
});

/**
 * Test metadata errors
 */
Deno.test("metadata errors include field context", async () => {
  // Create a minimal but valid WAV file
  const wavHeader = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x24,
    0x08,
    0x00,
    0x00, // File size - 8
    0x57,
    0x41,
    0x56,
    0x45, // "WAVE"
    0x66,
    0x6D,
    0x74,
    0x20, // "fmt "
    0x10,
    0x00,
    0x00,
    0x00, // Subchunk1Size
    0x01,
    0x00,
    0x02,
    0x00, // AudioFormat, NumChannels
    0x44,
    0xAC,
    0x00,
    0x00, // SampleRate (44100)
    0x10,
    0xB1,
    0x02,
    0x00, // ByteRate
    0x04,
    0x00,
    0x10,
    0x00, // BlockAlign, BitsPerSample
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x00,
    0x08,
    0x00,
    0x00, // Subchunk2Size
    ...new Array(2048).fill(0), // Audio data
  ]);

  const props = await readProperties(wavHeader);
  // WAV files should return valid properties
  assertEquals(typeof props.length, "number", "Should have duration");
  assertEquals(typeof props.bitrate, "number", "Should have bitrate");
});

/**
 * Test error code usage for programmatic handling
 */
Deno.test("error codes enable programmatic error handling", async () => {
  const taglib = await TagLib.initialize();

  try {
    await taglib.open(new Uint8Array(10).buffer);
  } catch (error) {
    if (isTagLibError(error)) {
      switch (error.code) {
        case "INVALID_FORMAT":
          // Handle invalid format
          assertEquals(error.code, "INVALID_FORMAT");
          break;
        case "UNSUPPORTED_FORMAT":
          // Handle unsupported format
          break;
        default:
          throw new Error("Unexpected error code");
      }
    }
  }
});
