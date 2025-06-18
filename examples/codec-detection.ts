#!/usr/bin/env -S deno run --allow-read

/**
 * @fileoverview Example demonstrating codec detection and lossless detection
 *
 * This example shows how to:
 * - Detect audio codecs (AAC, ALAC, MP3, FLAC, PCM, etc.)
 * - Determine if audio is lossless
 * - Get bits per sample information
 *
 * Run with: deno run --allow-read examples/codec-detection.ts <audio-file>
 */

import { TagLib } from "../src/mod.ts";

async function analyzeAudioFile(filePath: string) {
  console.log(`\n🎵 Analyzing: ${filePath}`);
  console.log("=".repeat(50));

  try {
    // Read the file
    const fileData = await Deno.readFile(filePath);
    
    // Initialize TagLib
    const taglib = await TagLib.initialize();
    
    // Open the file
    const audioFile = await taglib.open(fileData, filePath);
    
    // Get audio properties
    const properties = audioFile.audioProperties();
    
    if (properties) {
      console.log("\n📊 Audio Properties:");
      console.log(`  Format: ${audioFile.getFormat()}`);
      console.log(`  Codec: ${properties.codec}`);
      console.log(`  Lossless: ${properties.isLossless ? "✅ Yes" : "❌ No"}`);
      console.log(`  Duration: ${properties.length} seconds`);
      console.log(`  Bitrate: ${properties.bitrate} kbps`);
      console.log(`  Sample Rate: ${properties.sampleRate} Hz`);
      console.log(`  Channels: ${properties.channels}`);
      console.log(`  Bits per Sample: ${properties.bitsPerSample || "N/A"}`);
      
      // Provide codec-specific information
      console.log("\n💡 Codec Information:");
      switch (properties.codec) {
        case "AAC":
          console.log("  Advanced Audio Coding - Lossy compression");
          console.log("  Commonly used in MP4/M4A files and streaming");
          break;
        case "ALAC":
          console.log("  Apple Lossless Audio Codec - Lossless compression");
          console.log("  Preserves original audio quality with ~50% size reduction");
          break;
        case "MP3":
          console.log("  MPEG Layer 3 - Lossy compression");
          console.log("  Most widely supported audio format");
          break;
        case "FLAC":
          console.log("  Free Lossless Audio Codec - Lossless compression");
          console.log("  Open-source, typically 50-60% of original size");
          break;
        case "PCM":
          console.log("  Pulse Code Modulation - Uncompressed");
          console.log("  Raw audio data, no compression");
          break;
        case "Vorbis":
          console.log("  Ogg Vorbis - Lossy compression");
          console.log("  Open-source alternative to MP3");
          break;
        case "Opus":
          console.log("  Opus - Lossy compression");
          console.log("  Modern codec optimized for speech and music");
          break;
      }
      
      // Quality assessment based on properties
      console.log("\n🎯 Quality Assessment:");
      if (properties.isLossless) {
        console.log("  ✨ Lossless audio - Perfect quality preservation");
        if (properties.bitsPerSample >= 24) {
          console.log("  🎚️ High-resolution audio (24-bit or higher)");
        }
        if (properties.sampleRate >= 88200) {
          console.log("  📡 High sample rate (≥88.2 kHz)");
        }
      } else {
        if (properties.bitrate >= 320) {
          console.log("  👍 High bitrate lossy audio (≥320 kbps)");
        } else if (properties.bitrate >= 192) {
          console.log("  👌 Good bitrate lossy audio (192-319 kbps)");
        } else if (properties.bitrate >= 128) {
          console.log("  🆗 Acceptable bitrate lossy audio (128-191 kbps)");
        } else {
          console.log("  ⚠️  Low bitrate lossy audio (<128 kbps)");
        }
      }
    } else {
      console.log("❌ Could not read audio properties");
    }
    
    // Clean up
    audioFile.dispose();
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  
  if (args.length === 0) {
    console.log("Usage: deno run --allow-read examples/codec-detection.ts <audio-file>");
    console.log("\nExample:");
    console.log("  deno run --allow-read examples/codec-detection.ts music.mp3");
    console.log("  deno run --allow-read examples/codec-detection.ts audio.m4a");
    console.log("  deno run --allow-read examples/codec-detection.ts song.flac");
    Deno.exit(1);
  }
  
  await analyzeAudioFile(args[0]);
}