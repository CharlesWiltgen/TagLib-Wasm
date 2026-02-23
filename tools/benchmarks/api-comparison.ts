#!/usr/bin/env -S deno run --allow-read --allow-hrtime

/**
 * Performance benchmarks comparing Simple vs TagLib API styles
 *
 * This benchmark measures:
 * - Initialization time
 * - Single file operations
 * - Batch operations
 * - Memory usage patterns
 */

import { TagLib } from "../index";
import { applyTagsToBuffer, readProperties, readTags } from "../src/simple";

const TEST_FILE = "./tests/test-files/mp3/kiss-snippet.mp3";
const TEST_FILES = [
  "./tests/test-files/wav/kiss-snippet.wav",
  "./tests/test-files/mp3/kiss-snippet.mp3",
  "./tests/test-files/flac/kiss-snippet.flac",
  "./tests/test-files/ogg/kiss-snippet.ogg",
  "./tests/test-files/mp4/kiss-snippet.m4a",
];

interface BenchmarkResult {
  name: string;
  initTime?: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  memoryUsed?: number;
}

async function benchmark(
  name: string,
  setup: () => Promise<void>,
  fn: () => Promise<void>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  // Setup
  const setupStart = performance.now();
  await setup();
  const initTime = performance.now() - setupStart;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await fn();
  }

  // Benchmark
  const times: number[] = [];
  const memoryBefore = (performance as any).memory?.usedJSHeapSize;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const memoryAfter = (performance as any).memory?.usedJSHeapSize;
  const memoryUsed = memoryAfter && memoryBefore
    ? memoryAfter - memoryBefore
    : undefined;

  // Calculate stats
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;

  return {
    name,
    initTime: initTime > 0 ? initTime : undefined,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
    memoryUsed,
  };
}

console.log("🏃‍♂️ Running API Performance Benchmarks...");
console.log("⚠️  Note: Results vary by runtime and hardware\n");

// Load test file once
const fileData = await Deno.readFile(TEST_FILE);

const results: BenchmarkResult[] = [];

// 1. TagLib API - Read Tags
let taglib: TagLib | null = null;
results.push(
  await benchmark(
    "TagLib API - Read Tags",
    async () => {
      taglib = await TagLib.initialize();
    },
    async () => {
      const file = taglib!.open(fileData);
      const tags = file.tag();
      file.dispose();
    },
  ),
);

// 2. Simple API - Read Tags
results.push(
  await benchmark(
    "Simple API - Read Tags",
    async () => {
      // Auto-initializes on first use
    },
    async () => {
      await readTags(fileData);
    },
  ),
);

// 3. TagLib API - Full Operation
results.push(
  await benchmark(
    "TagLib API - Full Operation",
    async () => {
      // Already initialized
    },
    async () => {
      const file = taglib!.open(fileData);
      const tags = file.tag();
      const props = file.audioProperties();
      file.setTitle("Benchmark Title");
      file.setArtist("Benchmark Artist");
      file.save();
      file.dispose();
    },
  ),
);

// 4. Simple API - Full Operation
results.push(
  await benchmark(
    "Simple API - Full Operation",
    async () => {},
    async () => {
      const tags = await readTags(fileData);
      const props = await readProperties(fileData);
      await applyTagsToBuffer(fileData, {
        title: "Benchmark Title",
        artist: "Benchmark Artist",
      });
    },
  ),
);

// Print results
console.log("\n📊 Benchmark Results:");
console.log("-".repeat(100));
console.log(
  "| API Style                  | Init (ms) | Avg (ms) | Min (ms) | Max (ms) | Ops/sec | Memory (KB) |",
);
console.log("|".padEnd(100, "-"));

results.forEach((result) => {
  console.log(
    `| ${result.name.padEnd(26)} | ` +
      `${(result.initTime ?? 0).toFixed(2).padStart(9)} | ` +
      `${result.avgTime.toFixed(3).padStart(8)} | ` +
      `${result.minTime.toFixed(3).padStart(8)} | ` +
      `${result.maxTime.toFixed(3).padStart(8)} | ` +
      `${result.opsPerSecond.toFixed(0).padStart(7)} | ` +
      `${
        result.memoryUsed
          ? (result.memoryUsed / 1024).toFixed(0).padStart(11)
          : "N/A".padStart(11)
      } |`,
  );
});
console.log("-".repeat(100));

// Batch operations benchmark
console.log("\n📦 Batch Operations (5 files):");
console.log("-".repeat(70));

// TagLib API - Batch
const batchStart1 = performance.now();
for (const file of TEST_FILES) {
  try {
    const data = await Deno.readFile(file);
    const audioFile = taglib!.open(data);
    audioFile.tag();
    audioFile.audioProperties();
    audioFile.dispose();
  } catch (e) {
    // Skip invalid files
  }
}
const taglibBatchTime = performance.now() - batchStart1;

// Simple API - Batch
const batchStart2 = performance.now();
for (const file of TEST_FILES) {
  try {
    await readTags(file);
    await readProperties(file);
  } catch (e) {
    // Skip invalid files
  }
}
const simpleBatchTime = performance.now() - batchStart2;

console.log(
  `| TagLib API                 | ${
    taglibBatchTime.toFixed(2).padStart(8)
  }ms |`,
);
console.log(
  `| Simple API                 | ${
    simpleBatchTime.toFixed(2).padStart(8)
  }ms |`,
);
console.log("-".repeat(70));

// Analysis
console.log("\n📈 Analysis:");

const readTagsResults = results.filter((r) => r.name.includes("Read Tags"));
const fastestRead = readTagsResults.reduce((min, r) =>
  r.avgTime < min.avgTime ? r : min
);
const slowestRead = readTagsResults.reduce((max, r) =>
  r.avgTime > max.avgTime ? r : max
);

console.log(
  `\n🏆 Fastest tag reading: ${fastestRead.name} (${
    fastestRead.avgTime.toFixed(3)
  }ms avg)`,
);
console.log(
  `🐌 Slowest tag reading: ${slowestRead.name} (${
    slowestRead.avgTime.toFixed(3)
  }ms avg)`,
);
console.log(
  `⚡ Speed improvement: ${
    ((slowestRead.avgTime / fastestRead.avgTime - 1) * 100).toFixed(1)
  }% faster`,
);

// Recommendations
console.log("\n💡 Recommendations:");
console.log("\n1. Simple API - Best for:");
console.log("   - Quick scripts and one-off operations");
console.log("   - When simplicity matters more than performance");
console.log("   - Developers familiar with go-taglib");

console.log("\n2. TagLib API - Best for:");
console.log("   - Applications that process many files");
console.log("   - When you need maximum control");
console.log("   - Performance-critical applications");
console.log("   - Long-running processes");

// Cleanup
if (taglib) {
  taglib.destroy();
}

console.log("\n✅ Benchmark complete!");
