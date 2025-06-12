#!/usr/bin/env -S deno run --allow-read --allow-hrtime

/**
 * Performance benchmarks comparing different API styles
 * 
 * This benchmark measures:
 * - Initialization time
 * - Single file operations
 * - Batch operations
 * - Memory usage patterns
 */

import { TagLib as TraditionalTagLib } from "../index.ts";
import { readTags, readProperties, writeTags } from "../src/simple.ts";
import { TagLib as AutoTagLib, withFile } from "../src/auto.ts";
import { TagLib as FluentTagLib } from "../src/fluent.ts";

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
  iterations: number = 100
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
  const memBefore = (performance as any).memory?.usedJSHeapSize;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  
  const memAfter = (performance as any).memory?.usedJSHeapSize;
  const memoryUsed = memAfter && memBefore ? memAfter - memBefore : undefined;
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;
  
  return {
    name,
    initTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
    memoryUsed,
  };
}

async function runBenchmarks() {
  console.log("🏁 taglib-wasm API Performance Benchmarks");
  console.log("=" .repeat(50));
  console.log(`📊 Test file: ${TEST_FILE}`);
  console.log(`🔢 Iterations per test: 100`);
  console.log();
  
  const results: BenchmarkResult[] = [];
  
  // Prepare file data
  const fileData = await Deno.readFile(TEST_FILE);
  
  // 1. Traditional API - Read Tags
  let traditionalTaglib: TraditionalTagLib | null = null;
  results.push(await benchmark(
    "Traditional API - Read Tags",
    async () => {
      traditionalTaglib = await TraditionalTagLib.initialize();
    },
    async () => {
      const file = traditionalTaglib!.openFile(fileData);
      file.tag();
      file.dispose();
    }
  ));
  
  // 2. Simple API - Read Tags
  results.push(await benchmark(
    "Simple API - Read Tags",
    async () => {
      // Auto-initializes on first use
    },
    async () => {
      await readTags(fileData);
    }
  ));
  
  // 3. Auto API - Read Tags
  results.push(await benchmark(
    "Auto API - Read Tags",
    async () => {
      // Auto-initializes on first use
    },
    async () => {
      await withFile(fileData, file => file.tag());
    }
  ));
  
  // 4. Fluent API - Read Tags
  results.push(await benchmark(
    "Fluent API - Read Tags",
    async () => {
      // Auto-initializes on first use
    },
    async () => {
      await FluentTagLib.read(fileData);
    }
  ));
  
  // 5. Traditional API - Full Operation
  results.push(await benchmark(
    "Traditional API - Full Operation",
    async () => {
      // Already initialized
    },
    async () => {
      const file = traditionalTaglib!.openFile(fileData);
      const tags = file.tag();
      const props = file.audioProperties();
      file.setTitle("Benchmark Title");
      file.setArtist("Benchmark Artist");
      file.save();
      file.dispose();
    }
  ));
  
  // 6. Simple API - Full Operation
  results.push(await benchmark(
    "Simple API - Full Operation",
    async () => {},
    async () => {
      const tags = await readTags(fileData);
      const props = await readProperties(fileData);
      await writeTags(fileData, {
        title: "Benchmark Title",
        artist: "Benchmark Artist"
      });
    }
  ));
  
  // 7. Fluent API - Full Operation
  results.push(await benchmark(
    "Fluent API - Full Operation",
    async () => {},
    async () => {
      const file = await FluentTagLib.fromFile(fileData);
      await file
        .setTitle("Benchmark Title")
        .setArtist("Benchmark Artist")
        .save();
    }
  ));
  
  // Print results
  console.log("\n📊 Benchmark Results:");
  console.log("-".repeat(100));
  console.log("| API Style                  | Init (ms) | Avg (ms) | Min (ms) | Max (ms) | Ops/sec | Memory (KB) |");
  console.log("|".padEnd(100, "-"));
  
  results.forEach(result => {
    console.log(
      `| ${result.name.padEnd(26)} | ` +
      `${(result.initTime ?? 0).toFixed(2).padStart(9)} | ` +
      `${result.avgTime.toFixed(3).padStart(8)} | ` +
      `${result.minTime.toFixed(3).padStart(8)} | ` +
      `${result.maxTime.toFixed(3).padStart(8)} | ` +
      `${result.opsPerSecond.toFixed(0).padStart(7)} | ` +
      `${result.memoryUsed ? (result.memoryUsed / 1024).toFixed(0).padStart(11) : "N/A".padStart(11)} |`
    );
  });
  console.log("-".repeat(100));
  
  // Batch operations benchmark
  console.log("\n📦 Batch Operations (5 files):");
  console.log("-".repeat(70));
  
  // Traditional API - Batch
  const batchStart1 = performance.now();
  for (const file of TEST_FILES) {
    try {
      const data = await Deno.readFile(file);
      const audioFile = traditionalTaglib!.openFile(data);
      audioFile.tag();
      audioFile.audioProperties();
      audioFile.dispose();
    } catch (e) {
      // Skip invalid files
    }
  }
  const traditionalBatchTime = performance.now() - batchStart1;
  
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
  
  // Fluent API - Batch
  const batchStart3 = performance.now();
  await FluentTagLib.batch(TEST_FILES, async file => {
    try {
      const tags = await file.getTags();
      return tags;
    } catch (e) {
      return null;
    }
  });
  const fluentBatchTime = performance.now() - batchStart3;
  
  console.log(`| Traditional API            | ${traditionalBatchTime.toFixed(2).padStart(8)}ms |`);
  console.log(`| Simple API                 | ${simpleBatchTime.toFixed(2).padStart(8)}ms |`);
  console.log(`| Fluent API (batch method)  | ${fluentBatchTime.toFixed(2).padStart(8)}ms |`);
  console.log("-".repeat(70));
  
  // Analysis
  console.log("\n📈 Analysis:");
  
  const readTagsResults = results.filter(r => r.name.includes("Read Tags"));
  const fastestRead = readTagsResults.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
  const slowestRead = readTagsResults.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
  
  console.log(`\n🏆 Fastest tag reading: ${fastestRead.name} (${fastestRead.avgTime.toFixed(3)}ms avg)`);
  console.log(`🐌 Slowest tag reading: ${slowestRead.name} (${slowestRead.avgTime.toFixed(3)}ms avg)`);
  console.log(`⚡ Speed improvement: ${((slowestRead.avgTime / fastestRead.avgTime - 1) * 100).toFixed(1)}% faster`);
  
  const fullOpResults = results.filter(r => r.name.includes("Full Operation"));
  const fastestFull = fullOpResults.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
  const slowestFull = fullOpResults.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
  
  console.log(`\n🏆 Fastest full operation: ${fastestFull.name} (${fastestFull.avgTime.toFixed(3)}ms avg)`);
  console.log(`🐌 Slowest full operation: ${slowestFull.name} (${slowestFull.avgTime.toFixed(3)}ms avg)`);
  console.log(`⚡ Speed improvement: ${((slowestFull.avgTime / fastestFull.avgTime - 1) * 100).toFixed(1)}% faster`);
  
  console.log("\n✨ Benchmark complete!");
}

// Run benchmarks
if (import.meta.main) {
  runBenchmarks().catch(console.error);
}