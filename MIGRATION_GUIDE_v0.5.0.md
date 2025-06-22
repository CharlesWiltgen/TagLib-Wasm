# Migration Guide: taglib-wasm v0.5.0 Worker Pool Implementation

This guide helps you migrate to taglib-wasm v0.5.0, which introduces a new worker pool implementation for parallel audio file processing. While the release maintains backward compatibility, there are important changes and new features to understand.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [New Features](#new-features)
- [Migration Steps](#migration-steps)
- [API Reference](#api-reference)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

Version 0.5.0 introduces Web Worker-based parallel processing capabilities to taglib-wasm. This enables:

- Non-blocking audio file processing
- Parallel metadata operations across multiple files
- Improved performance for batch operations
- Better resource utilization in multi-core environments

**Important**: The worker pool requires Web Worker support and is automatically disabled in environments without it (e.g., some serverless platforms).

## Breaking Changes

### 1. Error Class Name Property

The `WorkerError` class now properly sets its `name` property:

```typescript
// Before: error.name === "TagLibError"
// After:  error.name === "WorkerError"
```

### 2. Folder API Concurrency Option Removed

The `concurrency` option in `FolderScanOptions` has been removed in favor of worker pool configuration:

```typescript
// Before
await scanFolder("/music", {
  concurrency: 4, // ❌ No longer supported
  recursive: true,
});

// After
await scanFolder("/music", {
  useWorkerPool: true, // ✅ Use worker pool instead
  workerPool: myPool, // ✅ Optional: provide custom pool
  recursive: true,
});
```

### 3. Tag Object Serialization

When using workers, tag objects returned from `readTags()` no longer include setter functions:

```typescript
// Before (without workers)
const tags = await readTags("song.mp3");
tags.setTitle("New Title"); // ❌ Setter functions not available with workers

// After (with workers)
const tags = await readTags("song.mp3");
// Use applyTags() to modify:
const modified = await applyTags("song.mp3", {
  ...tags,
  title: "New Title", // ✅ Use plain object
});
```

## New Features

### 1. Worker Pool Mode for Simple API

Enable parallel processing with a single function call:

```typescript
import { readTags, setWorkerPoolMode } from "taglib-wasm/simple";

// Enable worker pool with default settings (4 workers)
setWorkerPoolMode(true);

// Or provide a custom pool
const pool = new TagLibWorkerPool({ size: 8 });
setWorkerPoolMode(true, pool);

// All Simple API calls now use workers
const tags = await readTags("song.mp3"); // Processed in worker
```

### 2. Worker Pool Support in Full API

Initialize TagLib with worker pool support:

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize({
  useWorkerPool: true,
  workerPoolOptions: {
    size: 6,
    initTimeout: 10000,
  },
});

// Use the pool for batch operations
const result = await taglib.batchOperations("song.mp3", [
  { method: "tag" },
  { method: "audioProperties" },
]);
```

### 3. Direct Worker Pool Usage

Create and manage your own worker pool:

```typescript
import { TagLibWorkerPool } from "taglib-wasm";

const pool = new TagLibWorkerPool({
  size: 4, // Number of workers
  initTimeout: 5000, // Worker init timeout (ms)
  operationTimeout: 30000, // Operation timeout (ms)
  debug: true, // Enable debug logging
});

// Use the pool directly
const tags = await pool.readTags("song.mp3");
const props = await pool.readProperties("song.mp3");

// Process multiple files in parallel
const results = await pool.readTagsBatch([
  "song1.mp3",
  "song2.mp3",
  "song3.mp3",
]);

// Don't forget to clean up
pool.terminate();
```

### 4. Folder Scanning with Workers

The folder scanning API now uses workers by default:

```typescript
import { scanFolder } from "taglib-wasm/folder";

const result = await scanFolder("/music", {
  recursive: true,
  useWorkerPool: true, // Default: true if workers available
  workerPool: myPool, // Optional: use custom pool
});
```

## Migration Steps

### Step 1: Update Import Paths

No changes required for existing imports. New worker pool imports are optional:

```typescript
// Existing imports still work
import { applyTags, readTags } from "taglib-wasm/simple";
import { TagLib } from "taglib-wasm";

// New optional imports for worker pool
import { setWorkerPoolMode, TagLibWorkerPool } from "taglib-wasm";
```

### Step 2: Update Error Handling

If you check error names, update your error handling:

```typescript
try {
  await pool.readTags("invalid.mp3");
} catch (error) {
  if (error.name === "WorkerError") { // Changed from "TagLibError"
    console.error("Worker pool error:", error.message);
  }
}
```

### Step 3: Update Folder Scanning Code

Replace `concurrency` with `useWorkerPool`:

```typescript
// Before
const result = await scanFolder("/music", {
  concurrency: 4,
  recursive: true,
});

// After
const result = await scanFolder("/music", {
  useWorkerPool: true, // Enable parallel processing
  recursive: true,
});
```

### Step 4: Enable Worker Pool (Optional)

For better performance, enable the worker pool:

```typescript
// Simple API - Global setting
import { setWorkerPoolMode } from "taglib-wasm/simple";
setWorkerPoolMode(true);

// Full API - Per instance
const taglib = await TagLib.initialize({
  useWorkerPool: true,
});

// Direct usage
const pool = new TagLibWorkerPool({ size: 4 });
// ... use pool ...
pool.terminate(); // Clean up when done
```

## API Reference

### Simple API Changes

#### `setWorkerPoolMode(enabled: boolean, pool?: TagLibWorkerPool): void`

New function to enable/disable worker pool mode globally.

```typescript
// Enable with default pool
setWorkerPoolMode(true);

// Enable with custom pool
const pool = new TagLibWorkerPool({ size: 8 });
setWorkerPoolMode(true, pool);

// Disable
setWorkerPoolMode(false);
```

### Full API Changes

#### `TagLib.initialize(options?: TagLibOptions)`

Updated options interface:

```typescript
interface TagLibOptions {
  locateFile?: (path: string) => string;
  wasmBinary?: ArrayBuffer;
  useWorkerPool?: boolean; // New option
  workerPoolOptions?: WorkerPoolOptions; // New option
}
```

#### `AudioFile.batchOperations()`

New method for batch operations when using worker pool:

```typescript
const result = await audioFile.batchOperations([
  { method: "tag" },
  { method: "setTitle", args: ["New Title"] },
  { method: "save" },
]);
```

### Worker Pool API

#### `TagLibWorkerPool` Constructor

```typescript
new TagLibWorkerPool(options?: WorkerPoolOptions)

interface WorkerPoolOptions {
  size?: number;              // Default: 4
  initTimeout?: number;       // Default: 5000ms
  operationTimeout?: number;  // Default: 30000ms
  debug?: boolean;           // Default: false
}
```

#### Worker Pool Methods

```typescript
// Simple API methods
readTags(file: string | Uint8Array): Promise<Tag>
readTagsBatch(files: (string | Uint8Array)[]): Promise<Tag[]>
readProperties(file: string | Uint8Array): Promise<AudioProperties | null>
applyTags(file: string | Uint8Array, tags: Partial<Tag>): Promise<Uint8Array>
updateTags(file: string, tags: Partial<Tag>): Promise<void>
readPictures(file: string | Uint8Array): Promise<Picture[]>
setCoverArt(file: string | Uint8Array, coverArt: Uint8Array, mimeType?: string): Promise<Uint8Array>

// Full API methods
batchOperations(file: string | Uint8Array, operations: BatchOperation[]): Promise<any>

// Management methods
getStats(): { poolSize: number; busyWorkers: number; queueLength: number; initialized: boolean }
terminate(): void
```

### Folder API Changes

#### `FolderScanOptions` Interface

```typescript
interface FolderScanOptions {
  recursive?: boolean;
  extensions?: string[];
  maxFiles?: number;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  includeProperties?: boolean;
  continueOnError?: boolean;
  useWorkerPool?: boolean; // New option (default: true)
  workerPool?: TagLibWorkerPool; // New option
  // concurrency?: number;     // ❌ REMOVED
}
```

## Performance Considerations

### When to Use Worker Pool

✅ **Use worker pool when:**

- Processing multiple files
- Running in a browser or Node.js with Worker support
- Performing batch operations
- Non-blocking operation is important

❌ **Avoid worker pool when:**

- Processing single files with low latency requirements
- Running in environments without Worker support
- Memory is severely constrained (each worker uses ~10-20MB)

### Performance Comparison

```typescript
// Benchmark: Processing 20 files

// Without worker pool: ~800ms (sequential)
setWorkerPoolMode(false);
for (const file of files) {
  await readTags(file);
}

// With worker pool: ~200ms (parallel)
setWorkerPoolMode(true);
await Promise.all(files.map((file) => readTags(file)));
```

### Memory Usage

Each worker maintains its own Wasm instance:

- Base memory per worker: ~10MB
- Additional memory during operations: ~5-10MB
- Total for 4 workers: ~40-80MB

### Optimization Tips

1. **Reuse pools**: Create one pool and reuse it

   ```typescript
   // Good: Create once
   const pool = new TagLibWorkerPool({ size: 4 });

   // Bad: Create for each operation
   for (const file of files) {
     const pool = new TagLibWorkerPool(); // ❌ Wasteful
     await pool.readTags(file);
     pool.terminate();
   }
   ```

2. **Batch operations**: Process multiple files together

   ```typescript
   // Good: Batch processing
   const results = await pool.readTagsBatch(files);

   // Less optimal: Individual calls
   for (const file of files) {
     await pool.readTags(file);
   }
   ```

3. **Appropriate pool size**: Match CPU cores

   ```typescript
   const pool = new TagLibWorkerPool({
     size: navigator.hardwareConcurrency || 4,
   });
   ```

## Troubleshooting

### Common Issues

#### 1. "Worker pool has been terminated"

```typescript
// Problem
const pool = new TagLibWorkerPool();
pool.terminate();
await pool.readTags("file.mp3"); // Error!

// Solution
const pool = new TagLibWorkerPool();
await pool.readTags("file.mp3");
pool.terminate(); // Terminate after use
```

#### 2. "Cannot be cloned" errors

```typescript
// Problem: Functions can't cross worker boundaries
const tag = audioFile.tag();
tag.setTitle("New"); // Has functions, can't serialize

// Solution: Use plain objects
const modified = await applyTags(file, {
  title: "New",
  artist: "Artist",
});
```

#### 3. Worker initialization timeout

```typescript
// Increase timeout for slow systems
const pool = new TagLibWorkerPool({
  initTimeout: 10000, // 10 seconds
});
```

#### 4. No Worker support

```typescript
// Check for worker support
if (typeof Worker !== "undefined") {
  setWorkerPoolMode(true);
} else {
  console.log("Workers not supported, using synchronous mode");
}
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const pool = new TagLibWorkerPool({
  debug: true, // Enables console logging
});

// Check pool status
const stats = pool.getStats();
console.log("Pool status:", stats);
```

### Environment-Specific Notes

#### Browser

- Workers fully supported
- Check Content Security Policy for worker-src

#### Node.js

- Requires Node.js 10.5.0+ for Worker support
- Use `--experimental-worker` flag for older versions

#### Deno

- Full worker support
- No special configuration needed

#### Cloudflare Workers

- Limited Worker support
- Worker pool automatically disabled

#### Bun

- Full worker support as of Bun 1.0
- No special configuration needed

## Summary

The v0.5.0 release adds powerful parallel processing capabilities while maintaining backward compatibility. Key takeaways:

1. **No changes required** for existing code - it will continue to work
2. **Opt-in performance improvements** by enabling worker pool mode
3. **Simple migration** - mostly just enabling the feature
4. **Significant performance gains** for batch operations

For questions or issues, please refer to the [GitHub repository](https://github.com/your-repo/taglib-wasm) or the [API documentation](./docs/API.md).
