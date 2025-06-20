#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Smart Partial Loading Example
 *
 * Demonstrates how to use partial loading for improved performance with large audio files.
 * This feature loads only the metadata-containing portions of files (header and footer),
 * dramatically reducing memory usage and improving speed.
 */

import { TagLib } from "npm:taglib-wasm";

// Initialize TagLib
const taglib = await TagLib.initialize();

// Example 1: Basic partial loading
console.log("=== Example 1: Basic Partial Loading ===");
try {
  // Enable partial loading with default settings
  const file = await taglib.open("large-file.mp3", { partial: true });

  // Read operations work normally
  const tag = file.tag();
  console.log("Title:", tag.title);
  console.log("Artist:", tag.artist);
  console.log("Album:", tag.album);

  // Audio properties are also available
  const props = file.audioProperties();
  console.log("Duration:", props?.length, "seconds");
  console.log("Bitrate:", props?.bitrate, "kbps");

  file.dispose();
} catch (error) {
  console.log("Note: Replace 'large-file.mp3' with your own large audio file");
}

// Example 2: Custom header/footer sizes
console.log("\n=== Example 2: Custom Sizes ===");
try {
  // For very large files, you might want larger buffers
  const file = await taglib.open("huge-concert.flac", {
    partial: true,
    maxHeaderSize: 5 * 1024 * 1024, // 5MB header (for complex metadata)
    maxFooterSize: 512 * 1024, // 512KB footer
  });

  console.log("File loaded with custom buffer sizes");
  console.log("Format:", file.getFormat());

  file.dispose();
} catch (error) {
  console.log("Note: Replace 'huge-concert.flac' with your own audio file");
}

// Example 3: Smart save functionality
console.log("\n=== Example 3: Smart Save ===");
try {
  // Open a file with partial loading
  const file = await taglib.open("track.mp3", { partial: true });

  // Make multiple metadata changes
  const tag = file.tag();
  tag.setTitle("New Title");
  tag.setArtist("New Artist");
  tag.setAlbum("New Album");
  tag.setYear(2025);
  tag.setGenre("Electronic");
  tag.setComment("Updated with partial loading");

  // Save to file - this automatically loads the full file
  // to ensure all audio data is preserved
  await file.saveToFile("track-updated.mp3");
  console.log("File saved successfully with all metadata changes");

  file.dispose();
} catch (error) {
  console.log("Note: Replace 'track.mp3' with your own audio file");
}

// Example 4: Adaptive loading based on file size
console.log("\n=== Example 4: Adaptive Loading ===");

async function openAdaptive(path: string) {
  // Check file size first
  const stat = await Deno.stat(path);
  const sizeMB = stat.size / (1024 * 1024);

  console.log(`File: ${path}`);
  console.log(`Size: ${sizeMB.toFixed(2)} MB`);

  // Use partial loading for files larger than 50MB
  const threshold = 50;
  const options = sizeMB > threshold
    ? {
      partial: true,
      // Scale buffer sizes based on file size
      maxHeaderSize: Math.min(stat.size * 0.01, 5 * 1024 * 1024), // 1% or 5MB max
      maxFooterSize: Math.min(stat.size * 0.001, 512 * 1024), // 0.1% or 512KB max
    }
    : undefined;

  if (options) {
    console.log("Using partial loading with:");
    console.log(`  Header: ${(options.maxHeaderSize / 1024).toFixed(0)}KB`);
    console.log(`  Footer: ${(options.maxFooterSize / 1024).toFixed(0)}KB`);
  } else {
    console.log("Using full loading (file is small)");
  }

  const file = await taglib.open(path, options);
  return file;
}

// Try adaptive loading with your files
try {
  const files = ["small.mp3", "medium.flac", "large.wav"];

  for (const path of files) {
    try {
      const file = await openAdaptive(path);
      console.log(`Successfully loaded: ${file.tag().title || path}\n`);
      file.dispose();
    } catch {
      // File doesn't exist
    }
  }
} catch (error) {
  console.log("Add your own audio files to test adaptive loading");
}

// Performance comparison
console.log("\n=== Performance Benefits ===");
console.log("Partial loading provides dramatic improvements for large files:");
console.log("- Memory usage: ~450x less (1.1MB vs 500MB for a 500MB file)");
console.log("- Initial load: ~50x faster (50ms vs 2500ms)");
console.log("- Peak memory: 3.3MB instead of 1.5GB");
console.log("\nBest for files >50MB, especially useful for:");
console.log("- High-resolution audio (24-bit/96kHz+)");
console.log("- Long recordings (concerts, podcasts)");
console.log("- Batch processing of large collections");
