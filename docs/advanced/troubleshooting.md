# Troubleshooting Guide

This guide helps resolve common issues when using TagLib-Wasm.

## Table of Contents

- [Common Issues](#common-issues)
- [Installation Problems](#installation-problems)
- [Runtime Errors](#runtime-errors)
- [File Format Issues](#file-format-issues)
- [Memory Problems](#memory-problems)
- [Platform-Specific Issues](#platform-specific-issues)
- [Debugging Techniques](#debugging-techniques)
- [FAQ](#faq)

## Common Issues

### "Module not found" Error

**Problem**: Cannot import TagLib-Wasm module.

**Solutions**:

```typescript
// Deno - Use npm specifier
import { TagLib } from "npm:taglib-wasm"; // ✅

// Node.js - Install from NPM first
// npm install taglib-wasm
import { TagLib } from "taglib-wasm"; // ✅

// Bun - Install with bun
// bun add taglib-wasm
import { TagLib } from "taglib-wasm"; // ✅

// Browser - Use a bundler or CDN
import { TagLib } from "https://esm.sh/taglib-wasm"; // ✅
```

### "Failed to initialize" Error

**Problem**: TagLib.initialize() fails.

**Solutions**:

```typescript
// 1. Check memory configuration
try {
  const taglib = await TagLib.initialize({
    memory: {
      initial: 16 * 1024 * 1024, // Start with 16MB
    },
  });
} catch (error) {
  console.error("Initialization failed:", error);
}

// 2. Retry with different settings
async function initWithRetry() {
  const configs = [
    { memory: { initial: 16 * 1024 * 1024 } },
    { memory: { initial: 8 * 1024 * 1024 } },
    {}, // Default config
  ];

  for (const config of configs) {
    try {
      return await TagLib.initialize(config);
    } catch (error) {
      console.warn(`Failed with config:`, config);
    }
  }

  throw new Error("Failed to initialize with any configuration");
}
```

### "Unsupported format" Error

**Problem**: File format not recognized.

**Solutions**:

```typescript
// 1. Verify file format
function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

const supportedFormats = ["mp3", "mp4", "m4a", "flac", "ogg", "wav"];
const ext = getFileExtension(filename);

if (!supportedFormats.includes(ext)) {
  throw new Error(`Unsupported format: .${ext}`);
}

// 2. Check file magic numbers
function detectFormat(buffer: Uint8Array): string {
  const magic = Array.from(buffer.slice(0, 8));

  // MP3
  if (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) {
    return "MP3";
  }

  // ID3v2
  if (magic[0] === 0x49 && magic[1] === 0x44 && magic[2] === 0x33) {
    return "MP3";
  }

  // FLAC
  if (magic.slice(0, 4).join(",") === "102,76,97,67") {
    return "FLAC";
  }

  // Add more format checks...
  return "UNKNOWN";
}

// 3. Handle corrupt files
try {
  using file = taglib.openFile(buffer);
  if (!file.isValid()) {
    throw new Error("File is corrupt or invalid");
  }
} catch (error) {
  console.error("Cannot open file:", error);
}
```

## Installation Problems

### Deno Import Issues

**Problem**: JSR import not working.

```bash
# Error: Module not found "taglib-wasm"
```

**Solution**:

```bash
# Update Deno to latest version
deno upgrade

# Clear cache and retry
deno cache --reload mod.ts

# Specify version explicitly
import { TagLib } from "npm:taglib-wasm@0.2.7";
```

### Node.js Installation Fails

**Problem**: NPM install errors.

```bash
# Error: EACCES, ENOENT, or other npm errors
```

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Use different registry
npm install taglib-wasm --registry https://registry.npmjs.org/

# Install specific version
npm install taglib-wasm@latest

# For permission issues
sudo npm install taglib-wasm --unsafe-perm
```

### TypeScript Type Errors

**Problem**: TypeScript cannot find type definitions.

**Solution**:

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  }
}
```

```typescript
// For module augmentation
declare module "taglib-wasm" {
  export * from "taglib-wasm/types";
}
```

## Runtime Errors

### "Cannot allocate memory" Error

**Problem**: Out of memory during file processing.

**Solutions**:

```typescript
// 1. Increase memory limits
const taglib = await TagLib.initialize({
  memory: {
    initial: 64 * 1024 * 1024, // 64MB
    maximum: 512 * 1024 * 1024, // 512MB
  },
});

// 2. Process files sequentially
async function processLargeFiles(files: string[]) {
  for (const file of files) {
    await processFile(file);

    // Force garbage collection if available
    if (globalThis.gc) {
      globalThis.gc();
    }
  }
}

// 3. Monitor memory usage
function checkMemory() {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    const percentage = (used / limit) * 100;

    if (percentage > 80) {
      console.warn(`High memory usage: ${percentage.toFixed(1)}%`);
    }
  }
}
```

### "File is locked" Error

**Problem**: Cannot save changes to file.

**Solutions**:

```typescript
// 1. Ensure proper cleanup with `using`
{
  using file = taglib.openFile(buffer);
  // Operations...
  file.save();
}

// 2. Use locks for concurrent access
class FileLock {
  private locks = new Map<string, Promise<void>>();

  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    // Wait for existing lock
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
    let unlock: () => void;
    const lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });

    this.locks.set(key, lock);

    try {
      return await operation();
    } finally {
      this.locks.delete(key);
      unlock!();
    }
  }
}
```

### "Invalid UTF-8" Error

**Problem**: String encoding issues.

**Solutions**:

```typescript
// 1. Sanitize strings before setting
function sanitizeString(str: string): string {
  // Remove null bytes
  str = str.replace(/\0/g, "");

  // Remove control characters except newlines
  str = str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Ensure valid UTF-8
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(new TextEncoder().encode(str));
  } catch {
    // Fallback to ASCII
    return str.replace(/[^\x20-\x7E\n]/g, "?");
  }
}

// Usage
file.setTitle(sanitizeString(userInput));

// 2. Handle different encodings
function decodeString(bytes: Uint8Array, encoding = "utf-8"): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    // Try other encodings
    const encodings = ["utf-8", "iso-8859-1", "windows-1252"];

    for (const enc of encodings) {
      try {
        return new TextDecoder(enc).decode(bytes);
      } catch {
        continue;
      }
    }

    // Fallback
    return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  }
}
```

## File Format Issues

### MP3 ID3 Tag Problems

**Problem**: ID3 tags not reading/writing correctly.

**Solutions**:

```typescript
// 1. Check ID3 version
using file = taglib.openFile(mp3Buffer);

// Force ID3v2.4 for better compatibility
// (TagLib handles this internally)

// 2. Handle both ID3v1 and ID3v2
if (file.getFormat() === "MP3") {
  // TagLib automatically handles both
  const tags = file.tag(); // Merged ID3v1 + ID3v2
}

// 3. Clean up malformed tags
function cleanMP3Tags(buffer: Uint8Array): Uint8Array {
  // This is handled internally by TagLib
  const taglib = await TagLib.initialize();
  using file = taglib.openFile(buffer);

  if (file.isValid()) {
    // Re-save to clean up
    file.save();
    return file.toBuffer();
  }

  return buffer;
}
```

### M4A/MP4 Atom Issues

**Problem**: MP4 metadata not showing in iTunes/Apple Music.

**Solutions**:

```typescript
// Use standard atom names
using file = taglib.openFile(m4aBuffer);

// These map to iTunes-compatible atoms
file.setTitle("Title"); // ©nam
file.setArtist("Artist"); // ©ART
file.setAlbum("Album"); // ©alb
file.setComment("Comment"); // ©cmt
file.setGenre("Genre"); // ©gen

// For custom atoms
file.setExtendedTag({
  albumArtist: "Album Artist", // aART
  composer: "Composer", // ©wrt
  compilation: true, // cpil
});
```

### FLAC Vorbis Comment Issues

**Problem**: FLAC metadata not preserved.

**Solutions**:

```typescript
// FLAC uses Vorbis comments
using file = taglib.openFile(flacBuffer);

// Standard fields work automatically
file.setTitle("Title");

// For multiple values (FLAC supports this)
// taglib-wasm currently uses the first value

// Preserve existing comments
const existing = file.tag();
file.setTitle(newTitle || existing.title);
file.setArtist(newArtist || existing.artist);
```

## Memory Problems

### Memory Leaks

**Problem**: Memory usage grows over time.

**Solutions**:

```typescript
// 1. Use `using` for automatic cleanup
{
  using file = taglib.openFile(buffer);
  const tags = file.tag();
  // file is automatically disposed when it goes out of scope
}

// 2. For async operations
{
  using file = await taglib.open(buffer);
  const tags = file.tag();
}

// 3. Track active files in long-running applications
class DisposalTracker {
  private active = new Set<string>();

  track(id: string, file: AudioFile): AudioFile {
    this.active.add(id);

    const originalDispose = file.dispose.bind(file);
    file.dispose = () => {
      originalDispose();
      this.active.delete(id);
    };

    return file;
  }

  getActiveCount(): number {
    return this.active.size;
  }

  getActiveIds(): string[] {
    return Array.from(this.active);
  }
}
```

### Stack Overflow

**Problem**: Too many recursive operations.

**Solutions**:

```typescript
// 1. Use iterative instead of recursive
// ❌ Recursive
async function processRecursive(files: string[], index = 0) {
  if (index >= files.length) return;

  await processFile(files[index]);
  await processRecursive(files, index + 1); // Stack grows
}

// ✅ Iterative
async function processIterative(files: string[]) {
  for (const file of files) {
    await processFile(file);
  }
}

// 2. Batch processing
async function processBatched(files: string[], batchSize = 100) {
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(processFile));
  }
}
```

## Platform-Specific Issues

### Deno Issues

**Problem**: Permission errors.

```typescript
// Add required permissions
// deno run --allow-read --allow-write script.ts

// Check permissions programmatically
const readPerm = await Deno.permissions.query({ name: "read" });
if (readPerm.state !== "granted") {
  const status = await Deno.permissions.request({ name: "read" });
  if (status.state !== "granted") {
    throw new Error("Read permission required");
  }
}
```

### Node.js Issues

#### Using with CommonJS

**Problem**: `require('taglib-wasm')` fails with ERR_REQUIRE_ESM.

TagLib-Wasm is an ESM-only package (`"type": "module"`). CommonJS files must use dynamic import:

```javascript
// ❌ This will NOT work in CommonJS
const { TagLib } = require("taglib-wasm");

// ✅ Use dynamic import instead
async function main() {
  const { TagLib } = await import("taglib-wasm");
  const taglib = await TagLib.initialize();
  // ...
}
main();
```

**Why ESM-only?**

- ESM is the JavaScript standard
- Better tree-shaking and static analysis
- Native support in all modern runtimes (Node 14+, Deno, Bun, browsers)
- Bundlers (webpack, esbuild, Vite) handle the conversion automatically

#### ES Module Configuration

**Problem**: ES modules not working.

```json
// package.json
{
  "type": "module",
  "engines": {
    "node": ">=14.0.0"
  }
}
```

```javascript
// Or use dynamic import from CommonJS
const { TagLib } = await import("taglib-wasm");
```

### Browser Issues

**Problem**: CORS errors when loading Wasm.

```typescript
// 1. Serve with correct headers
// Content-Type: application/wasm
// Access-Control-Allow-Origin: *

// 2. Use base64 embedded Wasm
const wasmBase64 = "AGFzbQEAAAA...";
const wasmBytes = Uint8Array.from(
  atob(wasmBase64),
  (c) => c.charCodeAt(0),
);

// 3. Bundle Wasm with webpack/vite
// Configure bundler to handle .wasm files
```

### Cloudflare Workers Issues

**Problem**: Memory limits exceeded.

```typescript
// Workers have strict limits
export default {
  async fetch(request: Request): Promise<Response> {
    // Check file size first
    const contentLength = request.headers.get("content-length");
    const sizeMB = parseInt(contentLength || "0") / 1024 / 1024;

    if (sizeMB > 5) {
      return new Response("File too large for Workers", {
        status: 413,
      });
    }

    // Use minimal memory
    const taglib = await TagLib.initialize({
      memory: { initial: 8 * 1024 * 1024 }, // 8MB max
    });

    // Process with automatic cleanup
    const buffer = new Uint8Array(await request.arrayBuffer());
    using file = taglib.openFile(buffer);
    const tags = file.tag();

    return Response.json(tags);
  },
};
```

## Debugging Techniques

### Enable Debug Logging

```typescript
// 1. Initialize with debug mode
const taglib = await TagLib.initialize({
  debug: true,
});

// 2. Add custom logging
const originalOpen = taglib.openFile.bind(taglib);
taglib.openFile = (buffer: Uint8Array) => {
  console.log(`Opening file, size: ${buffer.length}`);
  const file = originalOpen(buffer);
  console.log(`File valid: ${file.isValid()}, format: ${file.getFormat()}`);
  return file;
};

// 3. Trace calls
function traceMethod(obj: any, method: string) {
  const original = obj[method].bind(obj);
  obj[method] = (...args: any[]) => {
    console.log(`${method} called with:`, args);
    const result = original(...args);
    console.log(`${method} returned:`, result);
    return result;
  };
}
```

### Inspect Wasm Memory

```typescript
// Get memory view
const module = taglib.getModule();
const memory = module.HEAPU8;

// Check memory usage
console.log(`Wasm memory size: ${memory.length / 1024 / 1024}MB`);

// Find string in memory
function findString(str: string): number[] {
  const bytes = new TextEncoder().encode(str);
  const positions = [];

  for (let i = 0; i < memory.length - bytes.length; i++) {
    let match = true;
    for (let j = 0; j < bytes.length; j++) {
      if (memory[i + j] !== bytes[j]) {
        match = false;
        break;
      }
    }
    if (match) positions.push(i);
  }

  return positions;
}
```

### Test File Validation

```typescript
// Comprehensive file validation
async function validateAudioFile(path: string) {
  const report = {
    path,
    exists: false,
    size: 0,
    format: "unknown",
    valid: false,
    readable: false,
    writable: false,
    errors: [] as string[],
  };

  try {
    // Check file exists
    const stat = await Deno.stat(path);
    report.exists = true;
    report.size = stat.size;

    // Read file
    const buffer = await Deno.readFile(path);
    report.readable = true;

    // Open with taglib
    const taglib = await TagLib.initialize();
    using file = taglib.openFile(buffer);

    report.valid = file.isValid();
    report.format = file.getFormat();

    // Try to read tags
    const tags = file.tag();

    // Try to save
    report.writable = file.save();
  } catch (error) {
    report.errors.push(error.message);
  }

  return report;
}
```

## FAQ

### Q: Why is the Wasm file so large?

**A**: The Wasm file (~2MB) includes the entire TagLib library with support for
all audio formats. This is a one-time download that gets cached by browsers.

### Q: Can I reduce the bundle size?

**A**: Currently no, but future versions may offer format-specific builds. For
now, the universal build ensures maximum compatibility.

### Q: Why doesn't save() write to disk?

**A**: TagLib-Wasm operates entirely in memory for security and compatibility.
Use `file.toBuffer()` and write the result to disk using your platform's file
API.

### Q: How do I handle non-ASCII characters?

**A**: TagLib-Wasm uses UTF-8 throughout. Ensure your strings are properly
encoded:

```typescript
// Correct UTF-8 handling
file.setTitle("日本語タイトル"); // Japanese
file.setArtist("Künstler"); // German
file.setAlbum("Álbum en Español"); // Spanish
```

### Q: Can I process files larger than available memory?

**A**: No, TagLib-Wasm requires the entire file in memory. For very large files,
consider:

- Increasing memory limits
- Processing on a server with more RAM
- Using streaming solutions for read-only operations

### Q: Why do some tags not appear in certain players?

**A**: Different players support different metadata standards:

- iTunes: Prefers MP4 atoms
- Windows Media Player: Prefers ID3v2.3
- VLC: Supports everything

TagLib-Wasm writes standard-compliant tags that should work everywhere.

### Q: Is TagLib-Wasm thread-safe?

**A**: JavaScript is single-threaded, so thread safety isn't a concern. However,
avoid concurrent operations on the same file instance.

### Q: How do I report bugs?

**A**: Please include:

1. TagLib-Wasm version
2. Runtime (Deno/Node/Browser/Workers)
3. File format and size
4. Minimal reproduction code
5. Error messages and stack traces
