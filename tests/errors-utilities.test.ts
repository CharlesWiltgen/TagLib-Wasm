/**
 * @fileoverview Tests for error type guards and utility functions in errors.ts
 */

import { assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
  MemoryError,
  MetadataError,
  TagLibError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "../src/errors.ts";

describe("Error Classes", () => {
  it("TagLibError - base error class", () => {
    const error = new TagLibError("MEMORY", "Test message", { foo: "bar" });

    assertEquals(error.name, "TagLibError");
    assertEquals(error.code, "MEMORY");
    assertEquals(error.message, "Test message");
    assertEquals(error.details, { foo: "bar" });
    assertInstanceOf(error, Error);
    assertInstanceOf(error, TagLibError);
  });

  it("TagLibInitializationError - initialization errors", () => {
    const error = new TagLibInitializationError("Module failed to load", {
      reason: "network",
    });

    assertEquals(error.name, "TagLibInitializationError");
    assertEquals(error.code, "INITIALIZATION");
    assertEquals(
      error.message,
      "Failed to initialize TagLib Wasm module: Module failed to load",
    );
    assertEquals(error.details, { reason: "network" });
    assertInstanceOf(error, TagLibError);
    assertInstanceOf(error, TagLibInitializationError);
  });

  it("InvalidFormatError - format validation errors", () => {
    const error1 = new InvalidFormatError("File may be corrupted", 500);
    assertEquals(error1.name, "InvalidFormatError");
    assertEquals(error1.code, "INVALID_FORMAT");
    assertEquals(
      error1.message,
      "Invalid audio file format: File may be corrupted. Buffer size: 500 bytes. Audio files must be at least 1KB to contain valid headers.",
    );
    assertEquals(error1.bufferSize, 500);

    const error2 = new InvalidFormatError("Unknown format", 2048);
    assertEquals(
      error2.message,
      "Invalid audio file format: Unknown format. Buffer size: 2.0 KB",
    );

    const error3 = new InvalidFormatError("Corrupted header", 5 * 1024 * 1024);
    assertEquals(
      error3.message,
      "Invalid audio file format: Corrupted header. Buffer size: 5.0 MB",
    );

    const error4 = new InvalidFormatError("Invalid header");
    assertEquals(error4.message, "Invalid audio file format: Invalid header");
    assertEquals(error4.bufferSize, undefined);

    assertInstanceOf(error1, TagLibError);
    assertInstanceOf(error1, InvalidFormatError);
  });

  it("UnsupportedFormatError - unsupported format errors", () => {
    const error = new UnsupportedFormatError("WMA");

    assertEquals(error.name, "UnsupportedFormatError");
    assertEquals(error.code, "UNSUPPORTED_FORMAT");
    assertEquals(
      error.message,
      "Unsupported audio format: WMA. Supported formats: MP3, MP4, M4A, FLAC, OGG, WAV",
    );
    assertEquals(error.format, "WMA");
    assertEquals(error.supportedFormats, [
      "MP3",
      "MP4",
      "M4A",
      "FLAC",
      "OGG",
      "WAV",
    ]);

    const error2 = new UnsupportedFormatError("APE", ["MP3", "FLAC"]);
    assertEquals(
      error2.message,
      "Unsupported audio format: APE. Supported formats: MP3, FLAC",
    );

    assertInstanceOf(error, TagLibError);
    assertInstanceOf(error, UnsupportedFormatError);
  });

  it("FileOperationError - file operation errors", () => {
    const error1 = new FileOperationError(
      "read",
      "Permission denied",
      "/music/song.mp3",
    );
    assertEquals(error1.name, "FileOperationError");
    assertEquals(error1.code, "FILE_OPERATION");
    assertEquals(
      error1.message,
      "Failed to read file. Path: /music/song.mp3. Permission denied",
    );
    assertEquals(error1.operation, "read");
    assertEquals(error1.path, "/music/song.mp3");

    const error2 = new FileOperationError("write", "Disk full");
    assertEquals(error2.message, "Failed to write file. Disk full");

    const error3 = new FileOperationError(
      "save",
      "Network error",
      "/remote/file.mp3",
    );
    assertEquals(
      error3.message,
      "Failed to save file. Path: /remote/file.mp3. Network error",
    );

    assertInstanceOf(error1, TagLibError);
    assertInstanceOf(error1, FileOperationError);
  });

  it("MetadataError - metadata operation errors", () => {
    const error1 = new MetadataError(
      "read",
      "Invalid field type",
      "CUSTOM_FIELD",
    );
    assertEquals(error1.name, "MetadataError");
    assertEquals(error1.code, "METADATA");
    assertEquals(
      error1.message,
      "Failed to read metadata. Field: CUSTOM_FIELD. Invalid field type",
    );
    assertEquals(error1.operation, "read");
    assertEquals(error1.field, "CUSTOM_FIELD");

    const error2 = new MetadataError("write", "File is read-only");
    assertEquals(error2.message, "Failed to write metadata. File is read-only");

    assertInstanceOf(error1, TagLibError);
    assertInstanceOf(error1, MetadataError);
  });

  it("MemoryError - memory allocation errors", () => {
    const error = new MemoryError("Out of memory", {
      requestedSize: 1024 * 1024,
    });

    assertEquals(error.name, "MemoryError");
    assertEquals(error.code, "MEMORY");
    assertEquals(error.message, "Memory allocation failed: Out of memory");
    assertEquals(error.details, { requestedSize: 1024 * 1024 });

    assertInstanceOf(error, TagLibError);
    assertInstanceOf(error, MemoryError);
  });

  it("EnvironmentError - environment compatibility errors", () => {
    const error1 = new EnvironmentError(
      "Cloudflare Workers",
      "does not support",
      "filesystem access",
    );
    assertEquals(error1.name, "EnvironmentError");
    assertEquals(
      error1.message,
      "Environment 'Cloudflare Workers' does not support. Required feature: filesystem access.",
    );
    assertEquals(error1.environment, "Cloudflare Workers");
    assertEquals(error1.reason, "does not support");
    assertEquals(error1.requiredFeature, "filesystem access");

    const error2 = new EnvironmentError(
      "Browser",
      "is not configured properly",
    );
    assertEquals(
      error2.message,
      "Environment 'Browser' is not configured properly.",
    );

    assertInstanceOf(error1, TagLibError);
    assertInstanceOf(error1, EnvironmentError);
  });
});

describe("Type Guards", () => {
  it("isTagLibError - type guard for base error", () => {
    assertEquals(isTagLibError(new TagLibError("MEMORY", "message")), true);
    assertEquals(
      isTagLibError(new TagLibInitializationError("failed")),
      true,
    );
    assertEquals(isTagLibError(new InvalidFormatError("bad format")), true);
    assertEquals(isTagLibError(new UnsupportedFormatError("WMA")), true);
    assertEquals(
      isTagLibError(new FileOperationError("read", "failed")),
      true,
    );
    assertEquals(isTagLibError(new MetadataError("write", "failed")), true);
    assertEquals(isTagLibError(new MemoryError("OOM")), true);
    assertEquals(
      isTagLibError(new EnvironmentError("test", "failed")),
      true,
    );
    assertEquals(isTagLibError(new Error("regular error")), false);
    assertEquals(isTagLibError("not an error"), false);
    assertEquals(isTagLibError(null), false);
    assertEquals(isTagLibError(undefined), false);
    assertEquals(isTagLibError({}), false);
  });

  it("isInvalidFormatError - type guard", () => {
    assertEquals(isInvalidFormatError(new InvalidFormatError("bad")), true);
    assertEquals(
      isInvalidFormatError(new InvalidFormatError("bad", 100)),
      true,
    );

    assertEquals(
      isInvalidFormatError(new TagLibError("MEMORY", "msg")),
      false,
    );
    assertEquals(
      isInvalidFormatError(new UnsupportedFormatError("WMA")),
      false,
    );
    assertEquals(isInvalidFormatError(new Error("regular")), false);
    assertEquals(isInvalidFormatError("not an error"), false);
  });

  it("isUnsupportedFormatError - type guard", () => {
    assertEquals(
      isUnsupportedFormatError(new UnsupportedFormatError("WMA")),
      true,
    );
    assertEquals(
      isUnsupportedFormatError(new UnsupportedFormatError("APE", ["MP3"])),
      true,
    );

    assertEquals(
      isUnsupportedFormatError(new InvalidFormatError("bad")),
      false,
    );
    assertEquals(
      isUnsupportedFormatError(new TagLibError("MEMORY", "msg")),
      false,
    );
    assertEquals(isUnsupportedFormatError(new Error("regular")), false);
    assertEquals(isUnsupportedFormatError(null), false);
  });

  it("isFileOperationError - type guard", () => {
    assertEquals(
      isFileOperationError(new FileOperationError("read", "failed")),
      true,
    );
    assertEquals(
      isFileOperationError(
        new FileOperationError("write", "failed", "/path"),
      ),
      true,
    );

    assertEquals(
      isFileOperationError(new TagLibError("MEMORY", "msg")),
      false,
    );
    assertEquals(
      isFileOperationError(new MetadataError("read", "failed")),
      false,
    );
    assertEquals(isFileOperationError(new Error("regular")), false);
    assertEquals(isFileOperationError(undefined), false);
  });

  it("isMetadataError - type guard", () => {
    assertEquals(isMetadataError(new MetadataError("read", "failed")), true);
    assertEquals(
      isMetadataError(new MetadataError("write", "failed", "FIELD")),
      true,
    );

    assertEquals(
      isMetadataError(new FileOperationError("read", "failed")),
      false,
    );
    assertEquals(isMetadataError(new TagLibError("MEMORY", "msg")), false);
    assertEquals(isMetadataError("not an error"), false);
  });

  it("isMemoryError - type guard", () => {
    assertEquals(isMemoryError(new MemoryError("OOM")), true);
    assertEquals(
      isMemoryError(new MemoryError("allocation failed", { size: 1024 })),
      true,
    );

    assertEquals(isMemoryError(new TagLibError("MEMORY", "msg")), false);
    assertEquals(isMemoryError(new Error("regular")), false);
    assertEquals(isMemoryError({}), false);
  });

  it("isEnvironmentError - type guard", () => {
    assertEquals(
      isEnvironmentError(new EnvironmentError("Browser", "unsupported")),
      true,
    );
    assertEquals(
      isEnvironmentError(new EnvironmentError("Worker", "missing", "fs")),
      true,
    );

    assertEquals(
      isEnvironmentError(new TagLibError("MEMORY", "msg")),
      false,
    );
    assertEquals(isEnvironmentError(123), false);
  });
});

describe("Utilities", () => {
  it("formatFileSize helper - human readable sizes", () => {
    const error1 = new InvalidFormatError("test", 100);
    assertEquals(error1.message.includes("100 bytes"), true);

    const error2 = new InvalidFormatError("test", 1023);
    assertEquals(error2.message.includes("1023 bytes"), true);

    const error3 = new InvalidFormatError("test", 1024);
    assertEquals(error3.message.includes("1.0 KB"), true);

    const error4 = new InvalidFormatError("test", 1536);
    assertEquals(error4.message.includes("1.5 KB"), true);

    const error5 = new InvalidFormatError("test", 1024 * 1024 - 1);
    assertEquals(error5.message.includes("1024.0 KB"), true);

    const error6 = new InvalidFormatError("test", 1024 * 1024);
    assertEquals(error6.message.includes("1.0 MB"), true);

    const error7 = new InvalidFormatError("test", 1.5 * 1024 * 1024);
    assertEquals(error7.message.includes("1.5 MB"), true);

    const error8 = new InvalidFormatError("test", 10.25 * 1024 * 1024);
    assertEquals(error8.message.includes("10.3 MB"), true);
  });

  it("Error inheritance chain", () => {
    const errors = [
      new TagLibInitializationError("test"),
      new InvalidFormatError("test"),
      new UnsupportedFormatError("test"),
      new FileOperationError("read", "test"),
      new MetadataError("read", "test"),
      new MemoryError("test"),
      new EnvironmentError("test", "reason"),
    ];

    for (const error of errors) {
      assertInstanceOf(
        error,
        Error,
        `${error.name} should be instanceof Error`,
      );
      assertInstanceOf(
        error,
        TagLibError,
        `${error.name} should be instanceof TagLibError`,
      );
      assertEquals(
        typeof error.message,
        "string",
        `${error.name} should have message`,
      );
      assertEquals(
        typeof error.code,
        "string",
        `${error.name} should have code`,
      );
      assertEquals(
        typeof error.name,
        "string",
        `${error.name} should have name`,
      );
    }
  });
});
