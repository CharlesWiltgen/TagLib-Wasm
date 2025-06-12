#!/usr/bin/env -S deno run --allow-read

/**
 * Fluent API Examples for TagLib WASM
 * 
 * This demonstrates the chainable, fluent API that makes complex
 * operations more readable and concise.
 */

import { TagLib } from "../src/fluent.ts";

async function demonstrateFluentAPI() {
  console.log("🎵 TagLib WASM - Fluent API Examples");
  console.log("=".repeat(50));
  
  const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";
  
  // Example 1: Basic chaining
  console.log("\n⛓️ Example 1: Basic method chaining");
  
  await TagLib
    .fromFile(testFile)
    .setTitle("Fluent API Demo")
    .setArtist("TagLib WASM")
    .setAlbum("Fluent Examples")
    .setYear(2025)
    .setTrack(1)
    .setGenre("Demo")
    .save();
  
  console.log("✅ Tags updated with fluent API");
  
  // Example 2: Quick read operations
  console.log("\n📖 Example 2: Quick read operations");
  
  const tags = await TagLib.read(testFile);
  console.log("Title:", tags.title);
  console.log("Artist:", tags.artist);
  console.log("Album:", tags.album);
  
  const props = await TagLib.properties(testFile);
  console.log(`Duration: ${props.length}s, Bitrate: ${props.bitrate} kbps`);
  
  const format = await TagLib.format(testFile);
  console.log("Format:", format);
  
  // Example 3: Quick write operation
  console.log("\n✏️ Example 3: Quick write operation");
  
  await TagLib.write(testFile, {
    title: "Quick Write Demo",
    artist: "Fluent API",
    comment: "Updated with one line"
  });
  console.log("✅ Quick write completed");
  
  // Example 4: Set multiple tags at once
  console.log("\n📝 Example 4: Bulk tag updates");
  
  await TagLib
    .fromFile(testFile)
    .setTags({
      title: "Bulk Update",
      artist: "Various Artists",
      album: "Compilation",
      year: 2025,
      track: 5,
      genre: "Multiple"
    })
    .save();
  
  console.log("✅ Bulk update completed");
  
  // Example 5: Extended metadata
  console.log("\n🎨 Example 5: Extended metadata");
  
  await TagLib
    .fromFile(testFile)
    .setExtendedTags({
      albumArtist: "Album Artist Name",
      composer: "Great Composer",
      bpm: 128,
      compilation: true,
      discNumber: 1,
      totalTracks: 12
    })
    .setAcoustidFingerprint("AQADtMmRSZKSRDmSJEkiKfJw...")
    .setMusicBrainzTrackId("12345678-1234-1234-1234-123456789012")
    .save();
  
  console.log("✅ Extended metadata saved");
  
  // Example 6: Get extended tags
  console.log("\n📊 Example 6: Reading extended tags");
  
  const extendedTags = await TagLib
    .fromFile(testFile)
    .getExtendedTags();
  
  console.log("Album Artist:", extendedTags.albumArtist);
  console.log("Composer:", extendedTags.composer);
  console.log("BPM:", extendedTags.bpm);
  console.log("Compilation:", extendedTags.compilation);
  
  // Example 7: Clear tags
  console.log("\n🧹 Example 7: Clearing tags");
  
  await TagLib
    .fromFile(testFile)
    .clearTags()
    .save();
  
  console.log("✅ All tags cleared");
  
  // Example 8: Custom operations with tap
  console.log("\n🔧 Example 8: Custom operations with tap");
  
  await TagLib
    .fromFile(testFile)
    .setTitle("Custom Operations")
    .tap(file => {
      // Access the underlying AudioFile for custom operations
      console.log("  Format in tap:", file.format());
      console.log("  Valid in tap:", file.isValid());
    })
    .setArtist("After Tap")
    .save();
  
  console.log("✅ Custom operations completed");
}

async function demonstrateBatchProcessing() {
  console.log("\n" + "=".repeat(50));
  console.log("📚 Batch Processing with Fluent API");
  console.log("=".repeat(50));
  
  const files = [
    "./tests/test-files/wav/kiss-snippet.wav",
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/flac/kiss-snippet.flac",
    "./tests/test-files/ogg/kiss-snippet.ogg",
    "./tests/test-files/mp4/kiss-snippet.m4a",
  ];
  
  // Example 1: Batch read
  console.log("\n📖 Example 1: Batch reading");
  
  const results = await TagLib.batch(files, async file => {
    const tags = await file.getTags();
    return {
      title: tags.title || "Unknown",
      artist: tags.artist || "Unknown"
    };
  });
  
  results.forEach((result, i) => {
    console.log(`${files[i].split('/').pop()}: ${result.title} by ${result.artist}`);
  });
  
  // Example 2: Batch update
  console.log("\n✏️ Example 2: Batch updating");
  
  await TagLib.batch(files.slice(0, 3), async file => {
    await file
      .setAlbum("Batch Album")
      .setYear(2025)
      .setGenre("Batch Genre")
      .save();
    
    return true;
  });
  
  console.log("✅ Batch update completed for 3 files");
  
  // Example 3: Conditional batch processing
  console.log("\n🎯 Example 3: Conditional batch processing");
  
  const processResults = await TagLib.batch(files, async file => {
    const format = await file.getFormat();
    
    if (format === "MP3" || format === "M4A") {
      await file
        .setComment("Processed lossy format")
        .save();
      return `${format}: Updated`;
    } else {
      return `${format}: Skipped (lossless)`;
    }
  });
  
  processResults.forEach((result, i) => {
    console.log(`${files[i].split('/').pop()}: ${result}`);
  });
}

async function demonstrateAdvancedPatterns() {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Advanced Fluent Patterns");
  console.log("=".repeat(50));
  
  const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";
  
  // Pattern 1: Validation before update
  console.log("\n✅ Pattern 1: Validation pattern");
  
  const validationResult = await TagLib
    .fromFile(testFile)
    .execute(async file => {
      const isValid = file.isValid();
      const format = file.format();
      
      if (!isValid) {
        throw new Error("Invalid file");
      }
      
      if (format !== "MP3") {
        throw new Error(`Expected MP3, got ${format}`);
      }
      
      file.setTitle("Validated and Updated");
      file.save();
      
      return { success: true, format };
    });
  
  console.log("Validation result:", validationResult);
  
  // Pattern 2: Metadata enrichment
  console.log("\n🎨 Pattern 2: Metadata enrichment");
  
  await TagLib
    .fromFile(testFile)
    .setTitle("Enriched Track")
    .setArtist("Main Artist")
    .setExtendedTags({
      albumArtist: "Various Artists",
      composer: "Original Composer",
      bpm: 140,
      musicbrainzTrackId: "98765432-1234-5678-9012-345678901234",
      replayGainTrackGain: "-8.5 dB",
      replayGainTrackPeak: "0.98765"
    })
    .setAcoustidId("12345678-90ab-cdef-1234-567890abcdef")
    .save();
  
  console.log("✅ Metadata enriched successfully");
  
  // Pattern 3: Format-specific processing
  console.log("\n📄 Pattern 3: Format-aware processing");
  
  const formatSpecificResult = await TagLib
    .fromFile(testFile)
    .execute(async file => {
      const format = file.format();
      const props = file.audioProperties();
      
      switch (format) {
        case "MP3":
          if (props.bitrate < 256) {
            file.setComment("Low quality MP3 - consider upgrading");
          } else {
            file.setComment("High quality MP3");
          }
          break;
          
        case "FLAC":
          file.setComment("Lossless audio - best quality");
          break;
          
        default:
          file.setComment(`${format} format`);
      }
      
      file.save();
      return file.tag().comment;
    });
  
  console.log("Format-specific comment:", formatSpecificResult);
  
  // Pattern 4: Complex validation and update
  console.log("\n🔍 Pattern 4: Complex validation");
  
  const complexResult = await TagLib
    .fromFile(testFile)
    .execute(async file => {
      const tags = file.tag();
      const issues = [];
      
      // Check for missing essential metadata
      if (!tags.title) issues.push("Missing title");
      if (!tags.artist) issues.push("Missing artist");
      if (!tags.album) issues.push("Missing album");
      if (!tags.year || tags.year === 0) issues.push("Missing year");
      
      // Fix issues
      if (issues.length > 0) {
        if (!tags.title) file.setTitle("Unknown Title");
        if (!tags.artist) file.setArtist("Unknown Artist");
        if (!tags.album) file.setAlbum("Unknown Album");
        if (!tags.year || tags.year === 0) file.setYear(new Date().getFullYear());
        
        file.save();
        
        return {
          status: "fixed",
          issues: issues,
          updatedTags: file.tag()
        };
      }
      
      return {
        status: "ok",
        message: "All essential metadata present"
      };
    });
  
  console.log("Validation result:", complexResult);
}

async function demonstrateRealWorldUseCases() {
  console.log("\n" + "=".repeat(50));
  console.log("🌍 Real-World Use Cases");
  console.log("=".repeat(50));
  
  // Use Case 1: Music library standardization
  console.log("\n📚 Use Case 1: Library standardization");
  
  const libraryFiles = [
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/flac/kiss-snippet.flac",
  ];
  
  await TagLib.batch(libraryFiles, async file => {
    const tags = await file.getTags();
    
    return file
      // Standardize artist names
      .tap(f => {
        if (tags.artist) {
          const standardized = tags.artist
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          f.setArtist(standardized);
        }
      })
      // Add missing album artist
      .tap(f => {
        const extended = f.extendedTag();
        if (!extended.albumArtist && tags.artist) {
          f.setExtendedTag({ albumArtist: tags.artist });
        }
      })
      // Ensure year is present
      .tap(f => {
        if (!tags.year || tags.year === 0) {
          f.setYear(new Date().getFullYear());
        }
      })
      .save();
  });
  
  console.log("✅ Library standardization completed");
  
  // Use Case 2: Podcast metadata
  console.log("\n🎙️ Use Case 2: Podcast metadata");
  
  await TagLib
    .fromFile("./tests/test-files/mp3/kiss-snippet.mp3")
    .setTitle("Episode 42: The Answer")
    .setArtist("Podcast Host")
    .setAlbum("Amazing Podcast Series")
    .setYear(2025)
    .setTrack(42)
    .setGenre("Podcast")
    .setExtendedTags({
      albumArtist: "Podcast Network",
      composer: "Episode Guest",
      comment: "Topics: Life, Universe, Everything"
    })
    .save();
  
  console.log("✅ Podcast metadata applied");
  
  // Use Case 3: DJ mix preparation
  console.log("\n🎧 Use Case 3: DJ mix preparation");
  
  const djTags = await TagLib
    .fromFile("./tests/test-files/mp3/kiss-snippet.mp3")
    .setExtendedTags({
      bpm: 128,
      comment: "Key: A minor | Energy: 8/10 | Mix: Intro at 0:15"
    })
    .setGenre("Electronic")
    .execute(async file => {
      const props = file.audioProperties();
      const tags = file.extendedTag();
      
      file.save();
      
      return {
        title: file.tag().title,
        bpm: tags.bpm,
        duration: props.length,
        mixInfo: tags.comment
      };
    });
  
  console.log("DJ preparation data:", djTags);
  
  // Use Case 4: Archive preparation
  console.log("\n📦 Use Case 4: Archive preparation");
  
  const archiveData = await TagLib
    .fromFile("./tests/test-files/flac/kiss-snippet.flac")
    .setComment(`Archived: ${new Date().toISOString()}`)
    .setExtendedTags({
      acoustidFingerprint: "ARCHIVE_FINGERPRINT_12345",
      musicbrainzTrackId: "archive-12345678-90ab-cdef-1234-567890abcdef"
    })
    .execute(async file => {
      const props = file.audioProperties();
      
      // Add quality information
      file.setExtendedTag({
        comment: `Archived: ${new Date().toISOString()} | ` +
                 `Quality: ${props.bitrate}kbps ${props.sampleRate}Hz`
      });
      
      file.save();
      
      return {
        format: file.format(),
        quality: `${props.bitrate}kbps @ ${props.sampleRate}Hz`,
        channels: props.channels,
        archived: true
      };
    });
  
  console.log("Archive data:", archiveData);
}

// Run all examples
if (import.meta.main) {
  await demonstrateFluentAPI();
  await demonstrateBatchProcessing();
  await demonstrateAdvancedPatterns();
  await demonstrateRealWorldUseCases();
  
  console.log("\n✨ Fluent API examples completed!");
}