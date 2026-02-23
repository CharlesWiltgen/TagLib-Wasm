# Error Handling Guide

This guide covers error handling best practices and common error scenarios in
TagLib-Wasm.

## Table of Contents

- [Error Types](#error-types)
- [Simple API Error Handling](#simple-api-error-handling)
- [Full API Error Handling](#full-api-error-handling)
- [Common Error Scenarios](#common-error-scenarios)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Debugging Tips](#debugging-tips)

## Error Types

### File Format Errors

Errors related to unsupported or invalid file formats.

```typescript
// Unsupported format
try {
  using file = taglib.openFile(pdfBuffer); // PDF is not an audio file
} catch (error) {
  // Error: Unsupported format or corrupted file
}

// Corrupted file
try {
  using file = taglib.openFile(corruptedMp3);
} catch (error) {
  // Error: Failed to parse file
}
```

### Memory Errors

Errors related to WebAssembly memory allocation.

```typescript
// Insufficient memory
try {
  const taglib = await TagLib.initialize({
    memory: { initial: 1024 }, // Only 1KB - too small!
  });
} catch (error) {
  // Error: Failed to allocate memory
}

// Out of memory during processing
try {
  using file = taglib.openFile(veryLargeFile); // 500MB file
} catch (error) {
  // Error: Cannot allocate memory
}
```

### Validation Errors

Errors when working with invalid files.

```typescript
using file = taglib.openFile(buffer);
if (!file.isValid()) {
  throw new Error("File validation failed");
}
```

### Save Errors

Errors when saving modifications.

```typescript
if (!file.save()) {
  throw new Error("Failed to save file modifications");
}
```

## Simple API Error Handling

The Simple API provides clear error messages for common scenarios.

### Basic Error Handling

```typescript
import {
  applyTagsToBuffer,
  readProperties,
  readTags,
} from "taglib-wasm/simple";

// Reading tags
try {
  const tags = await readTags("song.mp3");
  console.log(tags);
} catch (error) {
  if (error.message.includes("File not found")) {
    console.error("Audio file doesn't exist");
  } else if (error.message.includes("Unsupported format")) {
    console.error("File format not supported");
  } else {
    console.error("Failed to read tags:", error.message);
  }
}

// Writing tags
try {
  const modified = await applyTagsToBuffer("song.mp3", {
    title: "New Title",
    artist: "New Artist",
  });
  await Deno.writeFile("song-updated.mp3", modified);
} catch (error) {
  console.error("Failed to write tags:", error.message);
}

// Reading properties
try {
  const props = await readProperties("song.mp3");
  console.log(`Duration: ${props.length}s`);
} catch (error) {
  console.error("Failed to read properties:", error.message);
}
```

### Handling Multiple Files

```typescript
async function processBatch(files: string[]) {
  const results = [];

  for (const file of files) {
    try {
      const tags = await readTags(file);
      results.push({ file, success: true, tags });
    } catch (error) {
      results.push({
        file,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

// Usage
const results = await processBatch([
  "song1.mp3",
  "song2.flac",
  "not-audio.txt", // Will fail
  "song3.ogg",
]);

// Check results
results.forEach((result) => {
  if (result.success) {
    console.log(`✓ ${result.file}: ${result.tags.title}`);
  } else {
    console.log(`✗ ${result.file}: ${result.error}`);
  }
});
```

## Full API Error Handling

The Full API requires more careful error handling due to manual memory
management.

### Initialization Errors

```typescript
async function initializeWithRetry(maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const taglib = await TagLib.initialize({
        memory: {
          initial: 16 * 1024 * 1024,
          maximum: 256 * 1024 * 1024,
        },
      });
      return taglib;
    } catch (error) {
      lastError = error;
      console.warn(`Initialization attempt ${attempt} failed:`, error.message);

      // Wait before retry
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `Failed to initialize after ${maxAttempts} attempts: ${lastError.message}`,
  );
}
```

### File Processing with Cleanup

```typescript
async function processFileWithCleanup(buffer: Uint8Array) {
  const taglib = await TagLib.initialize();
  using file = taglib.openFile(buffer);

  // Validate
  if (!file.isValid()) {
    throw new Error("Invalid audio file");
  }

  // Process
  const format = file.getFormat();
  if (format === "UNKNOWN") {
    throw new Error("Unknown audio format");
  }

  // Modify
  file.setTitle("New Title");

  // Save
  if (!file.save()) {
    throw new Error("Failed to save modifications");
  }

  // Return modified buffer
  return file.toBuffer();
  // file is automatically disposed when scope exits, even on throw
}
```

### Batch Processing with Error Recovery

```typescript
class BatchProcessor {
  private taglib: TagLib;

  async initialize() {
    this.taglib = await TagLib.initialize();
  }

  async processFiles(files: Map<string, Uint8Array>) {
    const results = new Map();

    for (const [filename, buffer] of files) {
      const result = await this.processFile(filename, buffer);
      results.set(filename, result);
    }

    return results;
  }

  private async processFile(filename: string, buffer: Uint8Array) {
    try {
      using file = this.taglib.openFile(buffer);

      if (!file.isValid()) {
        return {
          success: false,
          error: "Invalid file format",
        };
      }

      // Read metadata
      const metadata = {
        format: file.getFormat(),
        tags: file.tag(),
        properties: file.audioProperties(),
      };

      return {
        success: true,
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        filename,
      };
    }
  }
}

// Usage
const processor = new BatchProcessor();
await processor.initialize();

const files = new Map([
  ["song1.mp3", await Deno.readFile("song1.mp3")],
  ["song2.flac", await Deno.readFile("song2.flac")],
]);

const results = await processor.processFiles(files);
```

## Common Error Scenarios

### 1. Unsupported File Format

```typescript
function isSupportedFormat(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  const supported = ["mp3", "mp4", "m4a", "flac", "ogg", "wav"];
  return supported.includes(ext || "");
}

// Pre-check before processing
if (!isSupportedFormat(filename)) {
  throw new Error(`Unsupported file format: ${filename}`);
}
```

### 2. Large File Handling

```typescript
async function processLargeFile(filePath: string) {
  const stats = await Deno.stat(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  // Adjust memory based on file size
  const memoryConfig = {
    initial: Math.max(32, fileSizeMB * 2) * 1024 * 1024,
    maximum: Math.max(256, fileSizeMB * 4) * 1024 * 1024,
  };

  try {
    const taglib = await TagLib.initialize({ memory: memoryConfig });
    const buffer = await Deno.readFile(filePath);
    using file = taglib.openFile(buffer);

    // Process...
  } catch (error) {
    if (error.message.includes("memory")) {
      throw new Error(`File too large (${fileSizeMB}MB): ${error.message}`);
    }
    throw error;
  }
}
```

### 3. Concurrent Processing Limits

```typescript
class ConcurrentProcessor {
  private concurrency: number;
  private queue: Array<() => Promise<any>> = [];
  private running = 0;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  async process<T>(task: () => Promise<T>): Promise<T> {
    while (this.running >= this.concurrency) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
    }
  }
}

// Usage
const processor = new ConcurrentProcessor(3);
const files = ["file1.mp3", "file2.mp3" /* ... */];

const results = await Promise.all(
  files.map((file) =>
    processor.process(async () => {
      try {
        return await readTags(file);
      } catch (error) {
        return { file, error: error.message };
      }
    })
  ),
);
```

### 4. Network/Buffer Errors

```typescript
async function fetchAndProcessAudio(url: string) {
  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("audio")) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Process
    const buffer = new Uint8Array(await response.arrayBuffer());
    return await readTags(buffer);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
}
```

## Error Recovery Strategies

### 1. Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
): Promise<T> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage
const tags = await retryWithBackoff(() => readTags("song.mp3"));
```

### 2. Fallback Strategies

```typescript
async function readTagsWithFallback(filePath: string) {
  try {
    // Try taglib-wasm first
    return await readTags(filePath);
  } catch (error) {
    console.warn("taglib-wasm failed, trying fallback:", error.message);

    // Fallback to basic detection
    const filename = filePath.split("/").pop() || "";
    const [artist, title] = filename.replace(/\.\w+$/, "").split(" - ");

    return {
      title: title || "Unknown",
      artist: artist || "Unknown Artist",
      album: "Unknown Album",
    };
  }
}
```

### 3. Graceful Degradation

```typescript
interface SafeMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  duration?: number;
  format?: string;
  error?: string;
}

async function safeReadMetadata(buffer: Uint8Array): Promise<SafeMetadata> {
  const defaults: SafeMetadata = {
    title: "Unknown Title",
    artist: "Unknown Artist",
    album: "Unknown Album",
  };

  try {
    const taglib = await TagLib.initialize();
    using file = taglib.openFile(buffer);

    if (!file.isValid()) {
      return { ...defaults, error: "Invalid file" };
    }

    const tags = file.tag();
    const props = file.audioProperties();

    return {
      title: tags.title || defaults.title,
      artist: tags.artist || defaults.artist,
      album: tags.album || defaults.album,
      year: tags.year || undefined,
      duration: props.length,
      format: file.getFormat(),
    };
  } catch (error) {
    return {
      ...defaults,
      error: error.message,
    };
  }
}
```

## Debugging Tips

### 1. Enable Debug Mode

```typescript
const taglib = await TagLib.initialize({
  debug: true, // Enables console output
});
```

### 2. Detailed Error Logging

```typescript
function logError(context: string, error: any, additionalInfo?: any) {
  console.error(`[${new Date().toISOString()}] ${context}:`, {
    message: error.message,
    stack: error.stack,
    type: error.constructor.name,
    ...additionalInfo,
  });
}

// Usage
try {
  using file = taglib.openFile(buffer);
} catch (error) {
  logError("openFile", error, {
    bufferSize: buffer.length,
    firstBytes: Array.from(buffer.slice(0, 4)),
  });
}
```

### 3. Memory Usage Monitoring

```typescript
class MemoryMonitor {
  private taglib: TagLib;
  private filesProcessed = 0;
  private startMemory: number;

  constructor(taglib: TagLib) {
    this.taglib = taglib;
    this.startMemory = this.getMemoryUsage();
  }

  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  async processFile(buffer: Uint8Array) {
    const beforeMemory = this.getMemoryUsage();

    {
      using file = this.taglib.openFile(buffer);
      // Process...
      this.filesProcessed++;
    }

    const afterMemory = this.getMemoryUsage();
    const delta = afterMemory - beforeMemory;

    if (delta > 1024 * 1024) { // 1MB increase
      console.warn(`Memory increase: ${(delta / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      filesProcessed: this.filesProcessed,
      memoryDelta: afterMemory - this.startMemory,
    };
  }
}
```

### 4. File Format Validation

```typescript
function validateAudioBuffer(buffer: Uint8Array): string | null {
  if (buffer.length < 4) {
    return "File too small";
  }

  // Check magic numbers
  const magic = Array.from(buffer.slice(0, 4));

  // MP3
  if (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) {
    return null; // Valid MP3
  }

  // ID3v2
  if (magic[0] === 0x49 && magic[1] === 0x44 && magic[2] === 0x33) {
    return null; // Valid MP3 with ID3
  }

  // FLAC
  if (magic.join(",") === "102,76,97,67") {
    return null; // Valid FLAC
  }

  // OGG
  if (magic.join(",") === "79,103,103,83") {
    return null; // Valid OGG
  }

  // WAV
  if (magic.join(",") === "82,73,70,70") {
    return null; // Valid WAV
  }

  // MP4/M4A
  const mp4Magic = Array.from(buffer.slice(4, 8));
  if (mp4Magic.join(",") === "102,116,121,112") {
    return null; // Valid MP4/M4A
  }

  return "Unknown or unsupported format";
}

// Usage
const error = validateAudioBuffer(buffer);
if (error) {
  throw new Error(error);
}
```

## Detailed Error Types

`taglib-wasm` provides specific error types for better debugging and error
handling:

### Complete Error Type Reference

```typescript
import {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  isTagLibError,
  MemoryError,
  MetadataError,
  TagLib,
  TagLibError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "taglib-wasm";
```

#### Error Types and Their Properties

**TagLibInitializationError**

- Thrown when the Wasm module fails to initialize
- Properties: `code`, `context`

**InvalidFormatError**

- Thrown when a file is corrupted or invalid
- Properties: `code`, `bufferSize`

**UnsupportedFormatError**

- Thrown when a file format is valid but not supported
- Properties: `code`, `format`, `supportedFormats`

**FileOperationError**

- Thrown when file read/write operations fail
- Properties: `code`, `operation`, `path`

**MetadataError**

- Thrown when tag reading/writing fails
- Properties: `code`, `field`

**MemoryError**

- Thrown when Wasm memory allocation fails
- Properties: `code`, `requestedSize`, `availableSize`

**EnvironmentError**

- Thrown when runtime environment is incompatible
- Properties: `code`, `environment`, `requirement`

### Using Type Guards

The `isTagLibError` type guard helps identify any TagLib-Wasm error:

```typescript
try {
  using file = await taglib.open("song.mp3");
  // Process file...
} catch (error) {
  if (error instanceof InvalidFormatError) {
    console.error(`Invalid audio file: ${error.message}`);
    console.error(`Buffer size: ${error.bufferSize} bytes`);
  } else if (error instanceof UnsupportedFormatError) {
    console.error(`Unsupported format: ${error.format}`);
    console.error(`Supported formats: ${error.supportedFormats.join(", ")}`);
  } else if (error instanceof FileOperationError) {
    console.error(`File operation failed: ${error.operation}`);
    console.error(`Path: ${error.path}`);
  } else if (isTagLibError(error)) {
    // Catches any other taglib-wasm specific error
    console.error(`TagLib error: ${error.code} - ${error.message}`);
  } else {
    // Non-taglib error (e.g., network error, permission denied)
    console.error(`Unexpected error: ${error}`);
  }
}
```
