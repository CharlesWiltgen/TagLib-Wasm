# Performance Guide

This guide covers performance optimization techniques and best practices for taglib-wasm.

## Table of Contents

- [Memory Management](#memory-management)
- [Processing Optimization](#processing-optimization)
- [Batch Operations](#batch-operations)
- [Runtime-Specific Optimizations](#runtime-specific-optimizations)
- [Benchmarking](#benchmarking)
- [Performance Tips](#performance-tips)

## Memory Management

### Memory Configuration

Choose the right memory configuration based on your use case:

```typescript
// Small files (< 10MB) - Default configuration
const taglib = await TagLib.initialize();

// Medium files (10-50MB)
const taglib = await TagLib.initialize({
  memory: {
    initial: 32 * 1024 * 1024,   // 32MB
    maximum: 128 * 1024 * 1024,  // 128MB
  },
});

// Large files (> 50MB)
const taglib = await TagLib.initialize({
  memory: {
    initial: 64 * 1024 * 1024,   // 64MB
    maximum: 256 * 1024 * 1024,  // 256MB
  },
});

// Memory-constrained environments (e.g., Cloudflare Workers)
const taglib = await TagLib.initialize({
  memory: {
    initial: 8 * 1024 * 1024,    // 8MB
    maximum: 8 * 1024 * 1024,    // Fixed size
  },
});
```

### Memory Usage Patterns

Understanding memory usage helps optimize performance:

```typescript
// Memory usage breakdown:
// - Base WASM module: ~2-4MB
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
  const file = taglib.openFile(buffer);
  try {
    // Process...
  } finally {
    file.dispose();
  }
}
```

## Processing Optimization

### Minimize File Operations

```typescript
// ❌ Inefficient: Multiple operations
const file1 = taglib.openFile(buffer);
file1.setTitle("Title");
file1.dispose();

const file2 = taglib.openFile(buffer);
file2.setArtist("Artist");
file2.dispose();

const file3 = taglib.openFile(buffer);
file3.setAlbum("Album");
file3.dispose();

// ✅ Efficient: Single operation
const file = taglib.openFile(buffer);
file.setTitle("Title");
file.setArtist("Artist");
file.setAlbum("Album");
file.dispose();
```

### Lazy Loading

Only read what you need:

```typescript
// Simple API - automatically optimized
const tags = await readTags(buffer); // Only reads tags
const props = await readProperties(buffer); // Only reads properties

// Core API - manual optimization
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
  
  dispose() {
    this.file.dispose();
  }
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

### Sequential Processing

Best for memory-constrained environments:

```typescript
async function processSequentially(files: string[]) {
  const taglib = await TagLib.initialize();
  const results = [];
  
  for (const filePath of files) {
    const buffer = await Deno.readFile(filePath);
    const file = taglib.openFile(buffer);
    
    try {
      const result = {
        path: filePath,
        tags: file.tag(),
        properties: file.audioProperties(),
      };
      results.push(result);
    } finally {
      file.dispose();
    }
    
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
        const file = taglib.openFile(buffer);
        
        try {
          return {
            path: filePath,
            tags: file.tag(),
            properties: file.audioProperties(),
          };
        } finally {
          file.dispose();
        }
      })
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
      const file = taglib.openFile(buffer);
      
      const result = {
        path: filePath,
        tags: file.tag(),
        properties: file.audioProperties(),
      };
      
      file.dispose();
      yield result;
      
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
  { type: "module" }
);

worker.postMessage({ cmd: "process", buffer });

// tag-worker.ts
self.onmessage = async (e) => {
  const { cmd, buffer } = e.data;
  if (cmd === "process") {
    const taglib = await TagLib.initialize();
    const file = taglib.openFile(buffer);
    const tags = file.tag();
    file.dispose();
    self.postMessage({ tags });
  }
};
```

### Node.js Optimizations

```typescript
import { Worker } from 'worker_threads';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

// Use streams for large files
async function processLargeFile(path: string) {
  const chunks: Buffer[] = [];
  const stream = createReadStream(path);
  
  stream.on('data', (chunk) => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  
  const buffer = Buffer.concat(chunks);
  return processBuffer(new Uint8Array(buffer));
}

// Use Worker threads
const worker = new Worker('./tag-worker.js');
worker.postMessage({ buffer });
```

### Browser Optimizations

```typescript
// Use Web Workers
const worker = new Worker('tag-worker.js');

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
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
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

// Cache WASM module
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
        initial: 8 * 1024 * 1024,  // 8MB limit
        maximum: 8 * 1024 * 1024,  // Fixed size
      },
    });
    
    // Stream response for large files
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    // Process in background
    (async () => {
      try {
        const buffer = new Uint8Array(await request.arrayBuffer());
        const file = taglib.openFile(buffer);
        
        const metadata = {
          tags: file.tag(),
          properties: file.audioProperties(),
        };
        
        file.dispose();
        
        await writer.write(
          new TextEncoder().encode(JSON.stringify(metadata))
        );
      } finally {
        await writer.close();
      }
    })();
    
    return new Response(readable, {
      headers: { 'Content-Type': 'application/json' },
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
    operation: () => Promise<T>
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
    const f = taglib.openFile(buffer);
    f.dispose();
    return Promise.resolve();
  });
  
  await monitor.measure("read_tags", () => {
    const f = taglib.openFile(buffer);
    const tags = f.tag();
    f.dispose();
    return Promise.resolve(tags);
  });
  
  await monitor.measure("write_tags", () => {
    const f = taglib.openFile(buffer);
    f.setTitle("New Title");
    f.save();
    f.dispose();
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
    if (typeof process !== 'undefined' && process.memoryUsage) {
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
      const sign = mb >= 0 ? '+' : '';
      console.log(`${sample.label}: ${sign}${mb.toFixed(2)}MB`);
    }
    
    const peak = Math.max(...this.samples.map(s => s.usage));
    console.log(`\nPeak delta: +${(peak / 1024 / 1024).toFixed(2)}MB`);
  }
}

// Usage
const profiler = new MemoryProfiler();

const taglib = await TagLib.initialize();
profiler.sample("After init");

const buffer = await Deno.readFile("large-file.flac");
profiler.sample("After file read");

const file = taglib.openFile(buffer);
profiler.sample("After file open");

const tags = file.tag();
profiler.sample("After tag read");

file.dispose();
profiler.sample("After dispose");

profiler.report();
```

## Performance Tips

### 1. Choose the Right API

```typescript
// Simple API - Best for:
// - Single operations
// - Automatic memory management
// - Quick scripts
const tags = await readTags("song.mp3");

// Core API - Best for:
// - Batch operations
// - Memory control
// - Performance-critical applications
const taglib = await TagLib.initialize();
// ... reuse for multiple files
```

### 2. Optimize File Size Handling

```typescript
// For small files (< 10MB): Load entire file
const smallBuffer = await Deno.readFile("small.mp3");
const tags = await readTags(smallBuffer);

// For large files (> 50MB): Consider alternatives
// - Process metadata only (first/last few MB)
// - Use streaming if only reading
// - Increase memory limits
```

### 3. Minimize Allocations

```typescript
// ❌ Creates multiple buffers
async function inefficient(files: string[]) {
  for (const file of files) {
    const data = await Deno.readFile(file);
    const copy = new Uint8Array(data); // Unnecessary copy
    const tags = await readTags(copy);
  }
}

// ✅ Reuses buffers where possible
async function efficient(files: string[]) {
  for (const file of files) {
    const data = await Deno.readFile(file);
    const tags = await readTags(data); // Direct use
  }
}
```

### 4. Profile Before Optimizing

```typescript
// Always measure first
console.time("operation");
const result = await expensiveOperation();
console.timeEnd("operation");

// Then optimize based on data
if (executionTime > threshold) {
  // Apply optimization
}
```

### 5. Consider Caching

```typescript
class MetadataCache {
  private cache = new Map<string, { tags: Tags; timestamp: number }>();
  private maxAge = 3600000; // 1 hour
  
  async getTags(path: string): Promise<Tags> {
    const cached = this.cache.get(path);
    
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.tags;
    }
    
    const tags = await readTags(path);
    this.cache.set(path, { tags, timestamp: Date.now() });
    
    return tags;
  }
  
  clear() {
    this.cache.clear();
  }
}
```