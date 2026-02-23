#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Example: Batch folder operations with TagLib-Wasm
 *
 * This example demonstrates how to scan folders for audio files,
 * read metadata from multiple files efficiently, and perform
 * batch operations like finding duplicates and updating tags.
 */

import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "../index.ts";

// Example 1: Scan a folder and display all metadata
async function scanAndDisplay() {
  console.log("\n📁 Scanning folder for audio files...\n");

  const result = await scanFolder("./examples/sample-music", {
    recursive: true,
    onProgress: (processed, total, file) => {
      console.log(`  Processing ${processed}/${total}: ${file}`);
    },
  });

  console.log("\n📊 Scan Results:");
  console.log(`  Total files found: ${result.totalFound}`);
  console.log(`  Successfully processed: ${result.totalProcessed}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Time taken: ${result.duration}ms`);

  console.log("\n🎵 Audio Files:");
  for (const file of result.files) {
    console.log(`\n  ${file.path}`);
    console.log(`    Artist: ${file.tags.artist || "(unknown)"}`);
    console.log(`    Album: ${file.tags.album || "(unknown)"}`);
    console.log(`    Title: ${file.tags.title || "(unknown)"}`);
    if (file.properties) {
      console.log(`    Duration: ${file.properties.length}s`);
      console.log(`    Bitrate: ${file.properties.bitrate} kbps`);
    }
  }

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const error of result.errors) {
      console.log(`  ${error.path}: ${error.error.message}`);
    }
  }
}

// Example 2: Find duplicate songs based on artist and title
async function findDuplicateSongs() {
  console.log("\n🔍 Finding duplicate songs...\n");

  const duplicates = await findDuplicates("./examples/sample-music");

  if (duplicates.size === 0) {
    console.log("No duplicates found!");
    return;
  }

  console.log(`Found ${duplicates.size} groups of duplicates:\n`);

  let groupNum = 1;
  for (const [key, files] of duplicates) {
    console.log(`Duplicate Group ${groupNum}:`);
    console.log(`  Key: ${key}`);
    console.log(`  Files:`);
    for (const file of files) {
      console.log(`    - ${file.path}`);
      if (file.properties) {
        console.log(
          `      Size: ${
            (file.properties.length * file.properties.bitrate * 125).toFixed(
              0,
            )
          } bytes`,
        );
      }
    }
    groupNum++;
  }
}

// Example 3: Batch update tags
async function batchUpdateExample() {
  console.log("\n✏️ Batch updating tags...\n");

  // First scan to find files to update
  const scanResult = await scanFolder("./examples/sample-music", {
    extensions: [".mp3"], // Only MP3 files for this example
  });

  // Prepare updates - add a compilation flag to all files
  const updates = scanResult.files.map((file) => ({
    path: file.path,
    tags: {
      comment: "Part of my music collection",
      // Preserve existing values while adding new ones
      ...(file.tags.year ? {} : { year: 2024 }),
    },
  }));

  console.log(`Updating ${updates.length} files...`);

  const updateResult = await updateFolderTags(updates, {
    concurrency: 4, // Process 4 files at a time
  });

  console.log(`\n✅ Update complete:`);
  console.log(`  Successful: ${updateResult.successful}`);
  console.log(`  Failed: ${updateResult.failed.length}`);
  console.log(`  Time taken: ${updateResult.duration}ms`);

  if (updateResult.failed.length > 0) {
    console.log("\n❌ Failed updates:");
    for (const failure of updateResult.failed) {
      console.log(`  ${failure.path}: ${failure.error.message}`);
    }
  }
}

// Example 4: Export metadata to JSON
async function exportMetadata() {
  console.log("\n💾 Exporting metadata to JSON...\n");

  const outputPath = "./music-catalog.json";

  await exportFolderMetadata("./examples/sample-music", outputPath, {
    recursive: true,
    includeProperties: true,
  });

  console.log(`Metadata exported to: ${outputPath}`);

  // Read and display summary
  const data = JSON.parse(await Deno.readTextFile(outputPath));
  console.log("\nExport Summary:");
  console.log(`  Scan date: ${data.scanDate}`);
  console.log(`  Total files: ${data.summary.totalFiles}`);
  console.log(`  Processed: ${data.summary.processedFiles}`);
  console.log(`  Errors: ${data.summary.errors}`);
  console.log(`  Duration: ${data.summary.duration}ms`);
}

// Example 5: Performance comparison - sequential vs parallel
async function performanceComparison() {
  console.log("\n⚡ Performance comparison...\n");

  // Sequential processing (concurrency = 1)
  console.log("Sequential processing (concurrency = 1):");
  const start1 = Date.now();
  const result1 = await scanFolder("./examples/sample-music", {
    concurrency: 1,
    includeProperties: true,
  });
  const duration1 = Date.now() - start1;
  console.log(`  Processed ${result1.totalProcessed} files in ${duration1}ms`);

  // Parallel processing (concurrency = 4)
  console.log("\nParallel processing (concurrency = 4):");
  const start2 = Date.now();
  const result2 = await scanFolder("./examples/sample-music", {
    concurrency: 4,
    includeProperties: true,
  });
  const duration2 = Date.now() - start2;
  console.log(`  Processed ${result2.totalProcessed} files in ${duration2}ms`);

  const speedup = ((duration1 / duration2 - 1) * 100).toFixed(1);
  console.log(`\n🚀 Parallel processing was ${speedup}% faster!`);
}

// Main function to run examples
async function main() {
  console.log("🎵 TagLib-Wasm Folder Operations Examples");
  console.log("=========================================");

  // Check if sample music directory exists
  try {
    await Deno.stat("./examples/sample-music");
  } catch {
    console.log("\n⚠️  Sample music directory not found!");
    console.log(
      "Please create ./examples/sample-music and add some audio files.",
    );
    console.log("\nUsing test files instead...\n");

    // Use test files for demonstration
    const testResult = await scanFolder("./tests/test-files", {
      recursive: false,
    });

    console.log("Found test files:");
    for (const file of testResult.files) {
      console.log(`  - ${file.path}`);
    }
    return;
  }

  // Run examples based on command line argument
  const example = Deno.args[0];

  switch (example) {
    case "scan":
      await scanAndDisplay();
      break;
    case "duplicates":
      await findDuplicateSongs();
      break;
    case "update":
      await batchUpdateExample();
      break;
    case "export":
      await exportMetadata();
      break;
    case "performance":
      await performanceComparison();
      break;
    default:
      console.log("\nAvailable examples:");
      console.log(
        "  deno run --allow-read --allow-write examples/folder-operations.ts scan",
      );
      console.log(
        "  deno run --allow-read --allow-write examples/folder-operations.ts duplicates",
      );
      console.log(
        "  deno run --allow-read --allow-write examples/folder-operations.ts update",
      );
      console.log(
        "  deno run --allow-read --allow-write examples/folder-operations.ts export",
      );
      console.log(
        "  deno run --allow-read --allow-write examples/folder-operations.ts performance",
      );
      console.log("\nRunning all examples...");

      await scanAndDisplay();
      await findDuplicateSongs();
      // Skip update example by default to avoid modifying files
      // await batchUpdateExample();
      await exportMetadata();
      await performanceComparison();
  }
}

// Run the examples
if (import.meta.main) {
  main().catch(console.error);
}
