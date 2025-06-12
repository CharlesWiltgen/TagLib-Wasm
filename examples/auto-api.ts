#!/usr/bin/env -S deno run --allow-read

/**
 * Auto-initialization API Examples for TagLib WASM
 * 
 * This demonstrates the zero-config auto-initializing API that removes
 * the need for explicit initialization.
 */

import { TagLib, withFile } from "../src/auto.ts";

async function demonstrateAutoAPI() {
  console.log("🎵 TagLib WASM - Auto-initialization API Examples");
  console.log("=".repeat(50));
  
  const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";
  
  // Example 1: Direct file opening (no initialization needed!)
  console.log("\n🚀 Example 1: Zero-config usage");
  const file = await TagLib.openFile(testFile);
  console.log("✅ File opened automatically!");
  
  const tags = file.tag();
  console.log("Title:", tags.title);
  console.log("Artist:", tags.artist);
  console.log("Album:", tags.album);
  
  file.dispose();
  
  // Example 2: From buffer
  console.log("\n📦 Example 2: From buffer");
  const buffer = await Deno.readFile(testFile);
  const file2 = await TagLib.fromBuffer(buffer);
  
  const props = file2.audioProperties();
  console.log(`Duration: ${props.length}s`);
  console.log(`Bitrate: ${props.bitrate} kbps`);
  
  file2.dispose();
  
  // Example 3: Using withFile helper (auto-dispose)
  console.log("\n🎯 Example 3: withFile helper (auto-dispose)");
  
  const metadata = await withFile(testFile, file => {
    return {
      tags: file.tag(),
      properties: file.audioProperties(),
      format: file.format()
    };
  });
  
  console.log("Format:", metadata.format);
  console.log("Title:", metadata.tags.title);
  console.log("Duration:", metadata.properties.length, "seconds");
  
  // Example 4: Modify tags with withFile
  console.log("\n✏️ Example 4: Modifying tags");
  
  await withFile(testFile, file => {
    file.setTitle("Auto API Demo");
    file.setArtist("TagLib WASM Auto");
    file.setAlbum("Zero Config Album");
    file.save();
    
    const updatedTags = file.tag();
    console.log("Updated title:", updatedTags.title);
    console.log("Updated artist:", updatedTags.artist);
    console.log("Updated album:", updatedTags.album);
  });
  
  // Example 5: Check initialization status
  console.log("\n🔍 Example 5: Initialization status");
  console.log("Is initialized:", TagLib.isInitialized());
  
  // Example 6: Custom initialization (optional)
  console.log("\n⚙️ Example 6: Custom initialization (optional)");
  await TagLib.initialize({
    debug: true,
    memory: {
      initial: 32 * 1024 * 1024, // 32MB
      maximum: 128 * 1024 * 1024, // 128MB
    }
  });
  console.log("Custom configuration applied");
}

async function demonstrateAdvancedPatterns() {
  console.log("\n" + "=".repeat(50));
  console.log("🔧 Advanced Auto API Patterns");
  console.log("=".repeat(50));
  
  // Pattern 1: Quick metadata extraction
  console.log("\n📊 Pattern 1: Quick metadata extraction");
  
  async function getAudioInfo(file: string) {
    return withFile(file, audioFile => ({
      valid: audioFile.isValid(),
      format: audioFile.format(),
      duration: audioFile.audioProperties().length,
      title: audioFile.tag().title || "Unknown",
      artist: audioFile.tag().artist || "Unknown"
    }));
  }
  
  const info = await getAudioInfo("./tests/test-files/flac/kiss-snippet.flac");
  console.log("Audio info:", info);
  
  // Pattern 2: Batch processing with auto-cleanup
  console.log("\n🔄 Pattern 2: Batch processing");
  
  const files = [
    "./tests/test-files/wav/kiss-snippet.wav",
    "./tests/test-files/mp3/kiss-snippet.mp3",
    "./tests/test-files/ogg/kiss-snippet.ogg",
  ];
  
  const results = await Promise.all(
    files.map(file => 
      withFile(file, audioFile => ({
        file: file.split('/').pop(),
        format: audioFile.format(),
        bitrate: audioFile.audioProperties().bitrate,
        hasTitle: !!audioFile.tag().title
      })).catch(error => ({
        file: file.split('/').pop(),
        error: error.message
      }))
    )
  );
  
  console.log("Batch results:");
  results.forEach(result => console.log(" ", result));
  
  // Pattern 3: Conditional processing
  console.log("\n🎯 Pattern 3: Conditional processing");
  
  async function updateIfMissingMetadata(file: string) {
    return withFile(file, audioFile => {
      const tags = audioFile.tag();
      let updated = false;
      
      if (!tags.title) {
        audioFile.setTitle("Unknown Title");
        updated = true;
      }
      
      if (!tags.artist) {
        audioFile.setArtist("Unknown Artist");
        updated = true;
      }
      
      if (!tags.album) {
        audioFile.setAlbum("Unknown Album");
        updated = true;
      }
      
      if (updated) {
        audioFile.save();
        return "Updated missing metadata";
      }
      
      return "All metadata present";
    });
  }
  
  const updateResult = await updateIfMissingMetadata("./tests/test-files/wav/kiss-snippet.wav");
  console.log("Update result:", updateResult);
  
  // Pattern 4: Error handling
  console.log("\n⚠️ Pattern 4: Error handling");
  
  try {
    await withFile("non-existent-file.mp3", file => {
      console.log("This won't execute");
    });
  } catch (error) {
    console.log("Handled error:", error.message);
  }
  
  // Pattern 5: Complex operations
  console.log("\n🎨 Pattern 5: Complex operations");
  
  await withFile("./tests/test-files/mp3/kiss-snippet.mp3", async file => {
    // Read current state
    const originalTags = file.tag();
    console.log("Original title:", originalTags.title);
    
    // Update with enhanced metadata
    file.setExtendedTag({
      albumArtist: "Various Artists",
      composer: "Demo Composer",
      bpm: 120,
      compilation: true,
      replayGainTrackGain: "-6.5 dB"
    });
    
    // Add identifiers
    file.setAcoustidFingerprint("AQADtMmRSZKSRD...");
    file.setMusicBrainzTrackId("12345678-1234-1234-1234-123456789012");
    
    // Save and verify
    if (file.save()) {
      console.log("✅ Complex metadata saved successfully");
      const extendedTags = file.extendedTag();
      console.log("Album Artist:", extendedTags.albumArtist);
      console.log("BPM:", extendedTags.bpm);
    }
  });
}

async function demonstrateRealWorldScenarios() {
  console.log("\n" + "=".repeat(50));
  console.log("🌍 Real-World Scenarios");
  console.log("=".repeat(50));
  
  // Scenario 1: Music library scanner
  console.log("\n📚 Scenario 1: Music library scanner");
  
  async function scanMusicFile(path: string) {
    try {
      return await withFile(path, file => {
        if (!file.isValid()) {
          return { path, status: "invalid" };
        }
        
        const tags = file.tag();
        const props = file.audioProperties();
        
        return {
          path,
          status: "valid",
          metadata: {
            title: tags.title || "Unknown",
            artist: tags.artist || "Unknown",
            album: tags.album || "Unknown",
            year: tags.year || 0
          },
          quality: {
            duration: props.length,
            bitrate: props.bitrate,
            format: file.format()
          }
        };
      });
    } catch (error) {
      return { path, status: "error", error: error.message };
    }
  }
  
  const scanResult = await scanMusicFile("./tests/test-files/mp3/kiss-snippet.mp3");
  console.log("Scan result:", JSON.stringify(scanResult, null, 2));
  
  // Scenario 2: Format converter helper
  console.log("\n🔄 Scenario 2: Format detection for conversion");
  
  async function needsConversion(file: string, targetBitrate: number = 256) {
    return withFile(file, audioFile => {
      const format = audioFile.format();
      const bitrate = audioFile.audioProperties().bitrate;
      
      // Lossless formats don't need conversion
      if (["FLAC", "WAV", "AIFF"].includes(format || "")) {
        return { convert: false, reason: "Lossless format" };
      }
      
      // Low bitrate files need conversion
      if (bitrate < targetBitrate) {
        return { convert: true, reason: `Low bitrate: ${bitrate} kbps` };
      }
      
      return { convert: false, reason: "Quality acceptable" };
    });
  }
  
  const conversionCheck = await needsConversion("./tests/test-files/mp3/kiss-snippet.mp3");
  console.log("Conversion needed:", conversionCheck);
  
  // Scenario 3: Metadata normalizer
  console.log("\n🎨 Scenario 3: Metadata normalizer");
  
  async function normalizeMetadata(file: string) {
    return withFile(file, audioFile => {
      const tags = audioFile.tag();
      let changes = [];
      
      // Normalize title case
      if (tags.title) {
        const normalized = tags.title
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        if (normalized !== tags.title) {
          audioFile.setTitle(normalized);
          changes.push(`Title: "${tags.title}" → "${normalized}"`);
        }
      }
      
      // Remove featuring from artist, add to title
      if (tags.artist && tags.artist.includes("feat.")) {
        const [mainArtist, featuring] = tags.artist.split(" feat. ");
        const newTitle = `${tags.title} (feat. ${featuring})`;
        
        audioFile.setArtist(mainArtist);
        audioFile.setTitle(newTitle);
        changes.push(`Moved featuring to title`);
      }
      
      // Ensure year is valid
      if (tags.year && (tags.year < 1900 || tags.year > new Date().getFullYear())) {
        audioFile.setYear(0);
        changes.push(`Cleared invalid year: ${tags.year}`);
      }
      
      if (changes.length > 0) {
        audioFile.save();
        return { normalized: true, changes };
      }
      
      return { normalized: false, message: "Already normalized" };
    });
  }
  
  const normalizeResult = await normalizeMetadata("./tests/test-files/mp3/kiss-snippet.mp3");
  console.log("Normalization result:", normalizeResult);
}

// Run all examples
if (import.meta.main) {
  await demonstrateAutoAPI();
  await demonstrateAdvancedPatterns();
  await demonstrateRealWorldScenarios();
  
  console.log("\n✨ Auto API examples completed!");
}