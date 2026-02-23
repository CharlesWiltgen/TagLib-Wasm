# Performance Guide

This guide covers performance optimization techniques and best practices for
TagLib-Wasm.

## 🚀 Quick Performance Wins

### Use Batch Processing (10-20x Faster)

The single most impactful optimization is using batch processing for multiple files:

```typescript
// ❌ SLOW: Sequential processing (~90 seconds for 19 files)
for (const file of files) {
  const tags = await readTags(file);
}

// ✅ FAST: Batch processing (~5 seconds for 19 files - 18x faster!)
const results = await readTagsBatch(files, { concurrency: 8 });
```

### Performance at a Glance

| Task                      | Method                | Performance         | Best For           |
| ------------------------- | --------------------- | ------------------- | ------------------ |
| Process album (20 tracks) | `readMetadataBatch()` | ~5s (20x faster)    | Complete metadata  |
| Read tags from 100 files  | `readTagsBatch()`     | ~25s (19x faster)   | Tags only          |
| Scan music library        | `scanFolder()`        | 2-4s per 1000 files | Directory scanning |
| Single file               | `readTags()`          | 2-5ms               | One-off operations |

### Optimal Settings by System

```typescript
// SSD/Fast disk
const results = await readTagsBatch(files, { concurrency: 12 });

// HDD/Network drive
const results = await readTagsBatch(files, { concurrency: 6 });

// Default (works well for most systems)
const results = await readTagsBatch(files, { concurrency: 8 });
```

## Table of Contents

- [Performance Best Practices](#performance-best-practices)
- [Memory Management](#memory-management)
- [Smart Partial Loading](#smart-partial-loading)
- [Processing Optimization](#processing-optimization)
- [Batch Operations](#batch-operations)
- [Runtime-Specific Optimizations](#runtime-specific-optimizations)
- [Benchmarking](#benchmarking)
- [Performance Tips](#performance-tips)

## Performance Best Practices

### 1. Always Use Batch APIs for Multiple Files

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Process entire album at once
async function processAlbum(albumFiles: string[]) {
  const metadata = await readMetadataBatch(albumFiles, {
    concurrency: 8, // Process 8 tracks simultaneously
  });

  return metadata.results.map(({ data }) => ({
    title: data.tags.title,
    duration: data.properties?.length,
    hasCoverArt: data.hasCoverArt,
  }));
}
```

### 2. Choose the Right Concurrency

- **Local SSD**: 8-16 concurrent operations
- **Network/HDD**: 4-8 concurrent operations
- **Cloud storage**: 6-10 concurrent operations
- **Memory limited**: 2-4 concurrent operations

### 3. Initialize Once, Reuse Many Times

```typescript
// ❌ BAD: Initializing for each operation
async function processManyFiles(files: string[]) {
  for (const file of files) {
    const taglib = await TagLib.initialize(); // Wasteful!
    // ...
  }
}

// ✅ GOOD: Initialize once, reuse
const taglib = await TagLib.initialize();
async function processManyFiles(files: string[]) {
  for (const file of files) {
    // Reuse taglib instance
  }
}
```

## Memory Management

### Memory Configuration

Choose the right memory configuration based on your use case:

```typescript
// Small files (< 10MB) - Default configuration
const taglib = await TagLib.initialize();

// Medium files (10-50MB)
const taglib = await TagLib.initialize({
  memory: {
    initial: 32 * 1024 * 1024, // 32MB
    maximum: 128 * 1024 * 1024, // 128MB
  },
});

// Large files (> 50MB)
const taglib = await TagLib.initialize({
  memory: {
    initial: 64 * 1024 * 1024, // 64MB
    maximum: 256 * 1024 * 1024, // 256MB
  },
});

// Memory-constrained environments (e.g., Cloudflare Workers)
const taglib = await TagLib.initialize({
  memory: {
    initial: 8 * 1024 * 1024, // 8MB
    maximum: 8 * 1024 * 1024, // Fixed size
  },
});
```

### Memory Usage Patterns

Understanding memory usage helps optimize performance:

```typescript
// Memory usage breakdown:
// - Base Wasm module: ~2-4MB
// - Per file overhead: ~2x file size
// - Peak usage during save: ~3x file size

function estimateMemoryUsage(fileSizeMB: number): number {
  const baseOverhead = 4; // MB
  const fileOverhead = fileSizeMB * 2;
  const peakOverhead = fileSizeMB * 3;

  return {
    minimum: baseOverhead + fileOverhead,
    peak: baseOverhead + peakOverhead,
  };
}

// Example: 10MB MP3 file
// Minimum: 4MB + 20MB = 24MB
// Peak: 4MB + 30MB = 34MB
```

### Memory Pooling

Reuse TagLib instances for better performance:

```typescript
class TagLibPool {
  private instance: TagLib | null = null;
  private initPromise: Promise<TagLib> | null = null;

  async getInstance(): Promise<TagLib> {
    if (this.instance) {
      return this.instance;
    }

    if (!this.initPromise) {
      this.initPromise = TagLib.initialize({
        memory: {
          initial: 32 * 1024 * 1024,
          maximum: 256 * 1024 * 1024,
        },
      });
    }

    this.instance = await this.initPromise;
    return this.instance;
  }
}

// Global pool
const pool = new TagLibPool();

// Usage
async function processFile(buffer: Uint8Array) {
  const taglib = await pool.getInstance();
  using file = taglib.openFile(buffer);
  // Process...
}
```

## Smart Partial Loading

### Overview

Smart Partial Loading is a performance optimization that loads only the
metadata-containing portions of audio files (header and footer) instead of the
entire file. This dramatically improves performance for large files while
maintaining full functionality.

### How It Works

Audio metadata is typically stored in specific locations:

- **Header (first 1MB)**: ID3v2 tags (MP3), FLAC metadata blocks, MP4 atoms
- **Footer (last 128KB)**: ID3v1 tags (MP3), APE tags

For a 500MB audio file, Smart Partial Loading:

- **Without**: Loads all 500MB into memory
- **With**: Loads only ~1.1MB (1MB header + 128KB footer)
- **Performance gain**: ~450x less memory usage

### Usage

```typescript
// Enable partial loading for large files
using file = await taglib.open(largeFile, {
  partial: true,
  maxHeaderSize: 2 * 1024 * 1024, // 2MB header
  maxFooterSize: 256 * 1024, // 256KB footer
});

// Read operations work normally
const tags = file.tag();
console.log(tags.title, tags.artist);

// Multiple tag changes are batched
file.tag().setTitle("New Title");
file.tag().setArtist("New Artist");
file.tag().setAlbum("New Album");

// Save automatically loads the full file when needed
await file.saveToFile(); // Full file loaded here
// file automatically disposed when scope exits
```

### Supported Environments

Partial loading works with:

- **Browser File API**: Using `File.slice()` for efficient chunking
- **Deno**: Native file operations with seek support
- **Node.js**: File handle operations with position reads
- **Buffers**: Falls back to full loading (no benefit)

### Performance Comparison

```typescript
// Benchmark: 500MB FLAC file
const benchmark = async () => {
  console.time("Full Load");
  using full = await taglib.open("large.flac");
  console.timeEnd("Full Load"); // ~2500ms

  console.time("Partial Load");
  using partial = await taglib.open("large.flac", { partial: true });
  console.timeEnd("Partial Load"); // ~50ms

  // 50x faster initial load!
};
```

### Memory Usage

```typescript
// Memory usage for different file sizes
function memoryComparison(fileSizeMB: number) {
  const fullLoad = fileSizeMB * 3; // Peak during processing
  const partialLoad = 1.1 * 3; // Always ~3.3MB peak

  return {
    fullLoad: `${fullLoad}MB`,
    partialLoad: `${partialLoad}MB`,
    savings: `${((1 - partialLoad / fullLoad) * 100).toFixed(1)}%`,
  };
}

// 100MB file: 300MB vs 3.3MB (98.9% savings)
// 500MB file: 1500MB vs 3.3MB (99.8% savings)
// 1GB file: 3000MB vs 3.3MB (99.9% savings)
```

### Smart Save Behavior

The "smart save" feature ensures data integrity:

1. **Metadata changes are tracked** in the partial buffer
2. **On save, the full file is loaded** automatically
3. **Changes are applied** to the complete file
4. **The complete file is saved** with all audio data intact

```typescript
// Example: Safe editing with partial loading
async function editLargeFile(path: string) {
  // Fast partial load (only metadata)
  using file = await taglib.open(path, { partial: true });

  // Make multiple changes (no I/O yet)
  const tag = file.tag();
  tag.setTitle("New Title");
  tag.setArtist("New Artist");
  tag.setAlbum("New Album");
  tag.setYear(2025);
  tag.setGenre("Electronic");

  // Smart save - loads full file only when needed
  await file.saveToFile(); // Full file loaded and saved here
  // file automatically disposed when scope exits
}
```

### Best Practices

1. **Use for large files**: Most beneficial for files >50MB
2. **Batch changes**: Make all metadata changes before saving
3. **Check file size**: Small files don't benefit from partial loading

```typescript
// Adaptive loading based on file size
async function openAdaptive(file: File | string) {
  const size = file instanceof File ? file.size : await getFileSize(file);

  const threshold = 50 * 1024 * 1024; // 50MB

  return taglib.open(file, {
    partial: size > threshold,
    maxHeaderSize: Math.min(size * 0.1, 2 * 1024 * 1024), // 10% or 2MB max
    maxFooterSize: Math.min(size * 0.01, 256 * 1024), // 1% or 256KB max
  });
}
```

### Limitations

1. **Read-then-write pattern**: Full file must be loaded for saving
2. **Not for streaming**: Requires random access to file
3. **Format dependent**: Some rare formats store metadata throughout the file

### Error Handling

```typescript
try {
  using file = await taglib.open(largePath, { partial: true });
  // ... process ...
} catch (error) {
  if (error.message.includes("partial loading not supported")) {
    // Fall back to full loading
    using file = await taglib.open(largePath);
    // ... process ...
  }
}
```

## Processing Optimization

### Minimize File Operations

```typescript
// ❌ Inefficient: Multiple operations
{
  using file1 = taglib.openFile(buffer);
  file1.setTitle("Title");
}
{
  using file2 = taglib.openFile(buffer);
  file2.setArtist("Artist");
}
{
  using file3 = taglib.openFile(buffer);
  file3.setAlbum("Album");
}

// ✅ Efficient: Single operation
{
  using file = taglib.openFile(buffer);
  file.setTitle("Title");
  file.setArtist("Artist");
  file.setAlbum("Album");
}
```

### Lazy Loading

Only read what you need:

```typescript
// Simple API - automatically optimized
const tags = await readTags(buffer); // Only reads tags
const props = await readProperties(buffer); // Only reads properties

// Full API - manual optimization
class LazyAudioFile {
  private file: AudioFile;
  private _tags?: TagData;
  private _props?: AudioProperties;

  constructor(file: AudioFile) {
    this.file = file;
  }

  get tags(): TagData {
    if (!this._tags) {
      this._tags = this.file.tag();
    }
    return this._tags;
  }

  get properties(): AudioProperties {
    if (!this._props) {
      this._props = this.file.audioProperties();
    }
    return this._props;
  }

  [Symbol.dispose]() {
    this.file.dispose();
  }
}

// Usage
{
  using lazy = new LazyAudioFile(taglib.openFile(buffer));
  console.log(lazy.tags.title);
}
```

### Selective Tag Updates

Only update changed fields:

```typescript
class SmartTagger {
  private original: TagData;
  private file: AudioFile;

  constructor(file: AudioFile) {
    this.file = file;
    this.original = file.tag();
  }

  updateTags(updates: Partial<TagData>) {
    let hasChanges = false;

    if (updates.title && updates.title !== this.original.title) {
      this.file.setTitle(updates.title);
      hasChanges = true;
    }

    if (updates.artist && updates.artist !== this.original.artist) {
      this.file.setArtist(updates.artist);
      hasChanges = true;
    }

    if (updates.album && updates.album !== this.original.album) {
      this.file.setAlbum(updates.album);
      hasChanges = true;
    }

    // Only save if there were changes
    if (hasChanges) {
      return this.file.save();
    }

    return true;
  }
}
```

## Batch Operations

### Using Simple API Batch Functions (Recommended)

The Simple API provides optimized batch processing functions that automatically handle concurrency and resource management, delivering **10-20x performance improvements** over sequential processing:

```typescript
import {
  readMetadataBatch,
  readPropertiesBatch,
  readTagsBatch,
} from "taglib-wasm/simple";

// Read tags from multiple files efficiently (10-20x faster)
const result = await readTagsBatch(files, {
  concurrency: 8, // Optimal for most systems
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} files processed`);
  },
});

// Read complete metadata (tags + properties + cover art + dynamics) in one batch
const metadata = await readMetadataBatch(files, { concurrency: 8 });

// Read just audio properties efficiently
const properties = await readPropertiesBatch(files, { concurrency: 8 });

// Real-world performance measurements:
// - Sequential: ~90 seconds for 19 files
// - readTagsBatch (concurrency=8): ~5 seconds (18x faster!)
// - readMetadataBatch (concurrency=8): ~6 seconds (15x faster!)
```

### Performance Comparison Table

| Operation      | Sequential | Batch (c=8) | Batch (c=16) | Speedup |
| -------------- | ---------- | ----------- | ------------ | ------- |
| 19 files tags  | ~90s       | **~5s**     | **~3s**      | 18-30x  |
| 100 files tags | ~475s      | **~25s**    | **~15s**     | 19-32x  |
| 20 track album | ~100s      | **~5s**     | **~3s**      | 20-33x  |
| Full metadata  | ~120s      | **~6s**     | **~4s**      | 20-30x  |

### Concurrency Tuning Guide

The optimal concurrency depends on your system and file location:

```typescript
// LOCAL SSD: Higher concurrency for fast disk I/O
const ssdResult = await readTagsBatch(localFiles, {
  concurrency: 12, // SSDs can handle 8-16 concurrent reads
});

// NETWORK/HDD: Lower concurrency for slower I/O
const networkResult = await readTagsBatch(networkFiles, {
  concurrency: 6, // Network/HDD benefits from 4-8 concurrency
});

// MEMORY CONSTRAINED: Reduce concurrency
const lowMemResult = await readTagsBatch(files, {
  concurrency: 4, // Each file uses ~2x its size in memory
});

// AUTO-TUNE: Find optimal concurrency
async function findOptimalConcurrency(files: string[]) {
  const testFile = files.slice(0, 10); // Test with first 10 files
  let bestTime = Infinity;
  let bestConcurrency = 4;

  for (const c of [4, 6, 8, 12, 16]) {
    const start = performance.now();
    await readTagsBatch(testFile, { concurrency: c });
    const time = performance.now() - start;

    if (time < bestTime) {
      bestTime = time;
      bestConcurrency = c;
    }
  }

  return bestConcurrency;
}
```

### Album Processing Pattern

For processing complete albums, use batch operations for maximum performance:

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
import { readdir } from "fs/promises";
import { join } from "path";

async function processAlbum(albumPath: string) {
  // Get all audio files
  const files = await readdir(albumPath);
  const audioFiles = files
    .filter((f) => /\.(mp3|flac|m4a|ogg)$/i.test(f))
    .map((f) => join(albumPath, f))
    .sort(); // Ensure track order

  // Process all tracks in parallel (10-20x faster)
  const result = await readMetadataBatch(audioFiles, {
    concurrency: 8,
  });

  // Extract album-level statistics
  const albumData = {
    trackCount: result.results.length,
    totalDuration: 0,
    averageBitrate: 0,
    hasCompleteCoverArt: true,
    tracks: [],
  };

  for (const { file, data } of result.results) {
    if (data.properties) {
      albumData.totalDuration += data.properties.length || 0;
      albumData.averageBitrate += data.properties.bitrate || 0;
    }

    if (!data.hasCoverArt) {
      albumData.hasCompleteCoverArt = false;
    }

    albumData.tracks.push({
      file: path.basename(file),
      ...data.tags,
      duration: data.properties?.length,
      bitrate: data.properties?.bitrate,
      hasCoverArt: data.hasCoverArt,
    });
  }

  albumData.averageBitrate = Math.round(
    albumData.averageBitrate / result.results.length,
  );

  return albumData;
}

// Process a 20-track album in ~5 seconds instead of ~100 seconds!
const album = await processAlbum("/music/Pink Floyd - The Wall");
```

### Sequential Processing

Best for memory-constrained environments or when using the Full API:

```typescript
async function processSequentially(files: string[]) {
  const taglib = await TagLib.initialize();
  const results = [];

  for (const filePath of files) {
    const buffer = await Deno.readFile(filePath);
    using file = taglib.openFile(buffer);

    const result = {
      path: filePath,
      tags: file.tag(),
      properties: file.audioProperties(),
    };
    results.push(result);

    // Optional: Force garbage collection between files
    if (globalThis.gc) {
      globalThis.gc();
    }
  }

  return results;
}
```

### Parallel Processing

Best for CPU-bound operations with sufficient memory:

```typescript
async function processInParallel(files: string[], concurrency = 4) {
  const taglib = await TagLib.initialize({
    memory: {
      initial: 64 * 1024 * 1024,
      maximum: 512 * 1024 * 1024, // Larger for parallel processing
    },
  });

  // Process in chunks
  const chunks = [];
  for (let i = 0; i < files.length; i += concurrency) {
    chunks.push(files.slice(i, i + concurrency));
  }

  const results = [];
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (filePath) => {
        const buffer = await Deno.readFile(filePath);
        using file = taglib.openFile(buffer);

        return {
          path: filePath,
          tags: file.tag(),
          properties: file.audioProperties(),
        };
      }),
    );

    results.push(...chunkResults);
  }

  return results;
}
```

### Stream Processing

For very large collections:

```typescript
async function* streamProcess(files: string[]) {
  const taglib = await TagLib.initialize();

  for (const filePath of files) {
    try {
      const buffer = await Deno.readFile(filePath);
      using file = taglib.openFile(buffer);

      yield {
        path: filePath,
        tags: file.tag(),
        properties: file.audioProperties(),
      };
    } catch (error) {
      yield {
        path: filePath,
        error: error.message,
      };
    }
  }
}

// Usage
for await (const result of streamProcess(files)) {
  console.log(result);
  // Process immediately, don't accumulate in memory
}
```

## Runtime-Specific Optimizations

### Deno Optimizations

```typescript
// Use Deno's native file operations
const buffer = await Deno.readFile(path); // Efficient native read

// Use Workers for CPU-intensive tasks
const worker = new Worker(
  new URL("./tag-worker.ts", import.meta.url).href,
  { type: "module" },
);

worker.postMessage({ cmd: "process", buffer });

// tag-worker.ts
self.onmessage = async (e) => {
  const { cmd, buffer } = e.data;
  if (cmd === "process") {
    const taglib = await TagLib.initialize();
    using file = taglib.openFile(buffer);
    const tags = file.tag();
    self.postMessage({ tags });
  }
};
```

### Node.js Optimizations

```typescript
import { Worker } from "worker_threads";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";

// Use streams for large files
async function processLargeFile(path: string) {
  const chunks: Buffer[] = [];
  const stream = createReadStream(path);

  stream.on("data", (chunk) => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const buffer = Buffer.concat(chunks);
  return processBuffer(new Uint8Array(buffer));
}

// Use Worker threads
const worker = new Worker("./tag-worker.js");
worker.postMessage({ buffer });
```

### Browser Optimizations

```typescript
// Use Web Workers
const worker = new Worker("tag-worker.js");

// Process file uploads efficiently
async function handleFileUpload(file: File) {
  // Use streams for large files
  if (file.size > 50 * 1024 * 1024) { // > 50MB
    const reader = file.stream().getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0),
    );

    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    return buffer;
  } else {
    // Small files can be read at once
    return new Uint8Array(await file.arrayBuffer());
  }
}

// Cache Wasm module
let cachedModule: TagLib | null = null;

async function getCachedTagLib(): Promise<TagLib> {
  if (!cachedModule) {
    cachedModule = await TagLib.initialize();
  }
  return cachedModule;
}
```

### Cloudflare Workers Optimizations

```typescript
// Optimize for Workers constraints
export default {
  async fetch(request: Request): Promise<Response> {
    // Initialize once per request
    const taglib = await TagLib.initialize({
      memory: {
        initial: 8 * 1024 * 1024, // 8MB limit
        maximum: 8 * 1024 * 1024, // Fixed size
      },
    });

    // Stream response for large files
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Process in background
    (async () => {
      try {
        const buffer = new Uint8Array(await request.arrayBuffer());
        using file = taglib.openFile(buffer);

        const metadata = {
          tags: file.tag(),
          properties: file.audioProperties(),
        };

        await writer.write(
          new TextEncoder().encode(JSON.stringify(metadata)),
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

## Benchmarking

### Performance Measurement

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  async measure<T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const start = performance.now();

    try {
      return await operation();
    } finally {
      const duration = performance.now() - start;

      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      this.metrics.get(name)!.push(duration);
    }
  }

  getStats(name: string) {
    const times = this.metrics.get(name) || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / times.length,
      median: sorted[Math.floor(times.length / 2)],
      p95: sorted[Math.floor(times.length * 0.95)],
      p99: sorted[Math.floor(times.length * 0.99)],
    };
  }

  report() {
    console.log("Performance Report:");
    for (const [name, _] of this.metrics) {
      const stats = this.getStats(name);
      console.log(`\n${name}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
    }
  }
}

// Usage
const monitor = new PerformanceMonitor();

// Benchmark initialization
await monitor.measure("init", () => TagLib.initialize());

// Benchmark file operations
const taglib = await TagLib.initialize();
for (const file of testFiles) {
  const buffer = await Deno.readFile(file);

  await monitor.measure("open", () => {
    using f = taglib.openFile(buffer);
    return Promise.resolve();
  });

  await monitor.measure("read_tags", () => {
    using f = taglib.openFile(buffer);
    const tags = f.tag();
    return Promise.resolve(tags);
  });

  await monitor.measure("write_tags", () => {
    using f = taglib.openFile(buffer);
    f.setTitle("New Title");
    f.save();
    return Promise.resolve();
  });
}

monitor.report();
```

### Memory Profiling

```typescript
class MemoryProfiler {
  private baseline: number;
  private samples: Array<{ label: string; usage: number }> = [];

  constructor() {
    this.baseline = this.getCurrentMemory();
  }

  private getCurrentMemory(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    } else if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  sample(label: string) {
    const current = this.getCurrentMemory();
    const delta = current - this.baseline;

    this.samples.push({
      label,
      usage: delta,
    });

    return delta;
  }

  report() {
    console.log("Memory Profile:");
    console.log(`Baseline: ${(this.baseline / 1024 / 1024).toFixed(2)}MB`);

    for (const sample of this.samples) {
      const mb = sample.usage / 1024 / 1024;
      const sign = mb >= 0 ? "+" : "";
      console.log(`${sample.label}: ${sign}${mb.toFixed(2)}MB`);
    }

    const peak = Math.max(...this.samples.map((s) => s.usage));
    console.log(`\nPeak delta: +${(peak / 1024 / 1024).toFixed(2)}MB`);
  }
}

// Usage
const profiler = new MemoryProfiler();

const taglib = await TagLib.initialize();
profiler.sample("After init");

const buffer = await Deno.readFile("large-file.flac");
profiler.sample("After file read");

{
  using file = taglib.openFile(buffer);
  profiler.sample("After file open");

  const tags = file.tag();
  profiler.sample("After tag read");
}
profiler.sample("After dispose");

profiler.report();
```

## Performance Tips

### 🎯 Performance Checklist

1. **Use Batch APIs** - 10-20x speedup for multiple files
2. **Set Optimal Concurrency** - Default 8, tune based on system
3. **Enable Worker Pool** - 4x speedup for complex operations
4. **Initialize Once** - Reuse TagLib instance
5. **Choose Right API** - Simple API for most use cases
6. **Profile First** - Measure before optimizing

### 📊 Performance Decision Tree

```
Processing multiple files?
├─ YES → Use batch APIs
│   ├─ Just tags? → readTagsBatch()
│   ├─ Full metadata? → readMetadataBatch()
│   └─ Whole directory? → scanFolder()
└─ NO → Use simple API
    ├─ Just reading? → readTags()
    └─ Need to modify? → writeTagsToFile()
```

### 🚀 Real-World Examples

#### Fast Album Processing

```typescript
// Process a 20-track album in ~5 seconds (vs ~100 seconds sequential)
import { readMetadataBatch } from "taglib-wasm/simple";

async function analyzeAlbum(albumPath: string) {
  const files = await getAudioFiles(albumPath);

  // Batch process with optimal concurrency
  const results = await readMetadataBatch(files, {
    concurrency: 8,
  });

  // Extract insights
  const analysis = {
    totalTracks: results.results.length,
    totalDuration: results.results.reduce(
      (sum, r) => sum + (r.data.properties?.length || 0),
      0,
    ),
    missingCoverArt: results.results.filter((r) => !r.data.hasCoverArt).length,
    needsNormalization:
      results.results.filter((r) => !r.data.dynamics?.replayGainTrackGain)
        .length,
  };

  return analysis;
}
```

#### Optimal Library Scanning

```typescript
// Scan 10,000 files in ~50 seconds (vs ~14 hours sequential)
import { scanFolder } from "taglib-wasm";

async function scanMusicLibrary(rootPath: string) {
  const result = await scanFolder(rootPath, {
    recursive: true,
    concurrency: 8, // Increase from default 4
    onProgress: (processed, total) => {
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${total}`);
      }
    },
  });

  console.log(`Scanned ${result.totalProcessed} files in ${result.duration}ms`);
  return result;
}
```

#### Memory-Efficient Streaming

```typescript
// Process large collections without memory issues
async function* streamLargeLibrary(files: string[], batchSize = 50) {
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    // Process batch
    const results = await readTagsBatch(batch, {
      concurrency: 4, // Lower for memory efficiency
    });

    yield results;

    // Optional: Force GC between batches
    if (global.gc) global.gc();
  }
}

// Usage
let totalProcessed = 0;
for await (const batch of streamLargeLibrary(allFiles)) {
  totalProcessed += batch.results.length;
  console.log(`Processed: ${totalProcessed} files`);
}
```

### 📈 Performance Monitoring

```typescript
class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  async track<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;

      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      this.metrics.get(name)!.push(duration);

      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow operation: ${name} took ${duration.toFixed(0)}ms`);
      }
    }
  }

  getStats(name: string) {
    const times = this.metrics.get(name) || [];
    if (times.length === 0) return null;

    return {
      avg: times.reduce((a, b) => a + b) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length,
    };
  }
}

// Usage
const tracker = new PerformanceTracker();

const tags = await tracker.track("readTags", () => readTags("song.mp3"));

const batchResult = await tracker.track(
  "batchProcess",
  () => readTagsBatch(files, { concurrency: 8 }),
);

// View performance stats
console.log(tracker.getStats("batchProcess"));
```

### 🎓 Advanced Optimization Techniques

#### 1. Adaptive Concurrency

```typescript
async function adaptiveBatchProcess(files: string[]) {
  // Start with high concurrency
  let concurrency = 16;
  let errors = 0;

  while (files.length > 0 && concurrency >= 2) {
    const batch = files.splice(0, 100);
    const result = await readTagsBatch(batch, { concurrency });

    // Reduce concurrency if errors occur
    if (result.errors.length > errors) {
      concurrency = Math.floor(concurrency / 2);
      console.log(`Reducing concurrency to ${concurrency}`);
    }

    errors = result.errors.length;
  }
}
```

#### 2. Predictive Caching

```typescript
class PredictiveCache {
  private cache = new Map<string, any>();

  async prefetchAlbum(firstTrack: string) {
    const dir = path.dirname(firstTrack);
    const files = await readdir(dir);
    const audioFiles = files.filter((f) => /\.(mp3|flac|m4a)$/i.test(f));

    // Prefetch entire album when first track is accessed
    if (audioFiles.length > 1) {
      const paths = audioFiles.map((f) => path.join(dir, f));
      const results = await readTagsBatch(paths, {
        concurrency: 8,
      });

      // Cache all results
      results.results.forEach(({ file, data }) => {
        this.cache.set(file, data);
      });
    }
  }
}
```

#### 3. Memory Pool Management

```typescript
class MemoryEfficientProcessor {
  private memoryLimit = 500 * 1024 * 1024; // 500MB
  private currentUsage = 0;

  async processWithMemoryLimit(files: string[]) {
    const batches = [];
    let currentBatch = [];
    let batchSize = 0;

    for (const file of files) {
      const size = await getFileSize(file);

      // Start new batch if memory limit exceeded
      if (batchSize + size * 2 > this.memoryLimit) {
        batches.push(currentBatch);
        currentBatch = [];
        batchSize = 0;
      }

      currentBatch.push(file);
      batchSize += size * 2; // Account for processing overhead
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Process batches sequentially to stay within memory limit
    const results = [];
    for (const batch of batches) {
      const batchResult = await readTagsBatch(batch, {
        concurrency: 4, // Lower concurrency for memory efficiency
      });
      results.push(...batchResult.results);

      // Force GC between batches
      if (global.gc) global.gc();
    }

    return results;
  }
}
```
