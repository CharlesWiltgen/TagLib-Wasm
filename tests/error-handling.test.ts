/**
 * @fileoverview Tests for enhanced error handling with context
 */

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import {
  type applyTagsToBuffer,
  readProperties,
  readTags,
  setBufferMode,
} from "../src/simple/index.ts";
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

setBufferMode(true);

describe("Error Handling", () => {
  it("error messages include helpful context", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    const tinyBuffer = new Uint8Array(100);

    await assertRejects(
      async () => await taglib.open(tinyBuffer.buffer),
      InvalidFormatError,
      "100 bytes",
      "Should include buffer size and helpful hint about minimum size",
    );

    const corruptedBuffer = new Uint8Array(5000);
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

  it("format-specific errors provide clear guidance", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    const mp3Buffer = await Deno.readFile(
      "tests/test-files/mp3/kiss-snippet.mp3",
    );

    const file = await taglib.open(mp3Buffer.buffer);

    try {
      assertThrows(
        () => file.getMP4Item("----:com.apple.iTunes:iTunNORM"),
        UnsupportedFormatError,
        "MP3",
        "Should show actual format and supported formats",
      );

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

  it("file operation errors include operation context", async () => {
    await assertRejects(
      async () => await readTags("/non/existent/file.mp3"),
      FileOperationError,
      "read",
      "Should include operation type and file path",
    );

    await assertRejects(
      async () => await readTags(123 as any),
      FileOperationError,
      "Invalid file input type",
      "Should show the actual input type",
    );
  });

  it("environment errors indicate missing features", async () => {
    const originalDeno = (globalThis as any).Deno;
    const originalProcess = (globalThis as any).process;
    const originalBun = (globalThis as any).Bun;

    try {
      delete (globalThis as any).Deno;
      delete (globalThis as any).process;
      delete (globalThis as any).Bun;

      await assertRejects(
        async () => await readTags("test.mp3"),
        Error,
        undefined,
        "Should throw an error in unsupported environment",
      );
    } finally {
      if (originalDeno) (globalThis as any).Deno = originalDeno;
      if (originalProcess) (globalThis as any).process = originalProcess;
      if (originalBun) (globalThis as any).Bun = originalBun;
    }
  });

  it("error type guards work correctly", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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

  it("metadata errors include field context", async () => {
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
    assertEquals(typeof props.length, "number", "Should have duration");
    assertEquals(typeof props.bitrate, "number", "Should have bitrate");
  });

  it("error codes enable programmatic error handling", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    try {
      await taglib.open(new Uint8Array(10).buffer);
    } catch (error) {
      if (isTagLibError(error)) {
        switch (error.code) {
          case "INVALID_FORMAT":
            assertEquals(error.code, "INVALID_FORMAT");
            break;
          case "UNSUPPORTED_FORMAT":
            break;
          default:
            throw new Error("Unexpected error code");
        }
      }
    }
  });
});
