#!/usr/bin/env -S deno run --allow-read --allow-hrtime

/**
 * Performance-optimized batch processing example
 *
 * This example demonstrates how to efficiently process multiple audio files
 * using TagLib-Wasm's batch processing APIs for maximum performance.
 */

import {
  readMetadataBatch,
  readTags,
  readTagsBatch,
  scanFolder,
} from "../index.ts";

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Helper to format performance comparison
function formatComparison(slow: number, fast: number): string {
  const speedup = slow / fast;
  const savings = ((1 - fast / slow) * 100).toFixed(1);
  return `${speedup.toFixed(1)}x faster (${savings}% time saved)`;
}

async function main() {
  // Get folder path from command line or use default
  const folderPath = Deno.args[0] || "./tests/test-files";

  console.log("🎵 TagLib-Wasm Batch Processing Performance Demo\n");
  console.log(`Scanning folder: ${folderPath}\n`);

  // First, find all audio files
  const scanResult = await scanFolder(folderPath, {
    recursive: true,
    continueOnError: true,
  });

  const audioFiles = scanResult.files.map((f) => f.path);
  const fileCount = audioFiles.length;

  if (fileCount === 0) {
    console.log("No audio files found in the specified folder.");
    return;
  }

  console.log(`Found ${fileCount} audio files\n`);
  console.log("=".repeat(60));
  console.log("\n📊 Performance Comparison:\n");

  // Method 1: Sequential processing (SLOW)
  console.log("1. Sequential Processing (calling readTags individually):");
  const sequentialStart = performance.now();
  const sequentialResults = [];

  for (const file of audioFiles) {
    try {
      const tags = await readTags(file);
      sequentialResults.push({ file, tags });
    } catch (error) {
      // Ignore errors for performance testing
    }
  }

  const sequentialTime = performance.now() - sequentialStart;
  console.log(`   Time: ${formatDuration(sequentialTime)}`);
  console.log(
    `   Speed: ${
      (fileCount / (sequentialTime / 1000)).toFixed(1)
    } files/second`,
  );

  // Method 2: Batch processing with default concurrency (FAST)
  console.log("\n2. Batch Processing (default concurrency = 4):");
  const batchDefaultStart = performance.now();
  const batchDefaultResult = await readTagsBatch(audioFiles);
  const batchDefaultTime = performance.now() - batchDefaultStart;

  console.log(`   Time: ${formatDuration(batchDefaultTime)}`);
  console.log(
    `   Speed: ${
      (fileCount / (batchDefaultTime / 1000)).toFixed(1)
    } files/second`,
  );
  console.log(
    `   Speedup: ${formatComparison(sequentialTime, batchDefaultTime)}`,
  );

  // Method 3: Batch processing with higher concurrency (FASTER)
  console.log("\n3. Batch Processing (concurrency = 8):");
  const batchHighStart = performance.now();
  const batchHighResult = await readTagsBatch(audioFiles, { concurrency: 8 });
  const batchHighTime = performance.now() - batchHighStart;

  console.log(`   Time: ${formatDuration(batchHighTime)}`);
  console.log(
    `   Speed: ${(fileCount / (batchHighTime / 1000)).toFixed(1)} files/second`,
  );
  console.log(`   Speedup: ${formatComparison(sequentialTime, batchHighTime)}`);

  // Method 4: Complete metadata (tags + properties) batch
  console.log("\n4. Complete Metadata Batch (tags + properties):");
  const metadataStart = performance.now();
  const metadataResult = await readMetadataBatch(audioFiles, {
    concurrency: 8,
    onProgress: (processed, total) => {
      // Update progress in place
      const percent = ((processed / total) * 100).toFixed(0);
      Deno.stdout.writeSync(
        new TextEncoder().encode(
          `\r   Progress: ${percent}% (${processed}/${total})`,
        ),
      );
    },
  });
  const metadataTime = performance.now() - metadataStart;

  console.log(`\n   Time: ${formatDuration(metadataTime)}`);
  console.log(
    `   Speed: ${(fileCount / (metadataTime / 1000)).toFixed(1)} files/second`,
  );
  console.log(`   Data: Both tags and audio properties retrieved`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📈 Results Summary:\n");

  const results = [
    { method: "Sequential (readTags)", time: sequentialTime },
    { method: "Batch (concurrency=4)", time: batchDefaultTime },
    { method: "Batch (concurrency=8)", time: batchHighTime },
    { method: "Full metadata batch", time: metadataTime },
  ];

  results.sort((a, b) => a.time - b.time);

  console.log("Ranked by speed:");
  results.forEach((result, index) => {
    const speedup = index === 0
      ? ""
      : ` (${formatComparison(sequentialTime, result.time)})`;
    console.log(
      `${index + 1}. ${result.method}: ${
        formatDuration(result.time)
      }${speedup}`,
    );
  });

  // Best practices
  console.log("\n" + "=".repeat(60));
  console.log("\n💡 Performance Best Practices:\n");
  console.log(
    "1. Use batch APIs (readTagsBatch, readMetadataBatch) for multiple files",
  );
  console.log(
    "2. Adjust concurrency based on your system (4-8 is usually optimal)",
  );
  console.log(
    "3. Use scanFolder for directory operations (it's already optimized)",
  );
  console.log("4. For web apps, use CDN URLs to enable WebAssembly streaming");
  console.log("5. Consider partial loading for very large files (>50MB)");

  // Sample output showing metadata
  if (metadataResult.results.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("\n🎵 Sample Metadata (first 3 files):\n");

    metadataResult.results.slice(0, 3).forEach(({ file, data }) => {
      console.log(`File: ${file}`);
      console.log(`  Artist: ${data.tags.artist || "Unknown"}`);
      console.log(`  Title: ${data.tags.title || "Unknown"}`);
      console.log(`  Album: ${data.tags.album || "Unknown"}`);
      if (data.properties) {
        console.log(`  Duration: ${data.properties.length}s`);
        console.log(`  Bitrate: ${data.properties.bitrate}kbps`);
      }
      console.log();
    });
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}
