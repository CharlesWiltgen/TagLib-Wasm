#!/usr/bin/env -S deno run --allow-read

/**
 * @fileoverview Example demonstrating container format and codec detection
 *
 * This example shows how to:
 * - Detect container formats (MP4, OGG, MP3, FLAC, etc.)
 * - Detect audio codecs (AAC, ALAC, MP3, FLAC, Vorbis, Opus, PCM, etc.)
 * - Understand the difference between container and codec
 * - Determine if audio is lossless
 * - Get bits per sample information
 *
 * Container vs Codec:
 * - Container format: How the audio data and metadata are packaged (e.g., MP4, OGG)
 * - Codec: How the audio is compressed/encoded (e.g., AAC, Vorbis)
 * - Some formats like MP3 and FLAC are both container and codec
 * - MP4 containers (including .m4a files) can contain AAC (lossy) or ALAC (lossless)
 * - OGG containers can contain Vorbis, Opus, FLAC, or Speex codecs
 *
 * Run with: deno run --allow-read examples/codec-detection.ts <audio-file>
 */

import { TagLib } from "../src/taglib.ts";

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
      console.log(`  File Format: ${audioFile.getFormat()}`);
      console.log(`  Container: ${properties.containerFormat}`);
      console.log(`  Codec: ${properties.codec}`);
      console.log(`  Lossless: ${properties.isLossless ? "✅ Yes" : "❌ No"}`);
      console.log(`  Duration: ${properties.length} seconds`);
      console.log(`  Bitrate: ${properties.bitrate} kbps`);
      console.log(`  Sample Rate: ${properties.sampleRate} Hz`);
      console.log(`  Channels: ${properties.channels}`);
      console.log(`  Bits per Sample: ${properties.bitsPerSample || "N/A"}`);

      // Provide container-specific information
      console.log("\n📦 Container Information:");
      switch (properties.containerFormat) {
        case "MP4":
          console.log("  ISO Base Media File Format (ISOBMFF)");
          console.log("  Commonly used extensions: .mp4, .m4a, .m4b");
          console.log("  Can contain: AAC (lossy) or ALAC (lossless) audio");
          break;
        case "OGG":
          console.log("  Ogg container format");
          console.log("  Can contain: Vorbis, Opus, FLAC, or Speex codecs");
          break;
        case "MP3":
          console.log("  MPEG Layer 3 - Both container and codec");
          break;
        case "FLAC":
          console.log("  Free Lossless Audio Codec - Both container and codec");
          break;
        case "WAV":
          console.log("  RIFF WAVE format");
          console.log("  Usually contains: PCM (uncompressed) audio");
          break;
        case "AIFF":
          console.log("  Audio Interchange File Format");
          console.log("  Usually contains: PCM (uncompressed) audio");
          break;
      }

      // Provide codec-specific information
      console.log("\n💡 Codec Information:");
      switch (properties.codec) {
        case "AAC":
          console.log("  Advanced Audio Coding - Lossy compression");
          console.log("  Commonly used in MP4/M4A files and streaming");
          break;
        case "ALAC":
          console.log("  Apple Lossless Audio Codec - Lossless compression");
          console.log(
            "  Preserves original audio quality with ~50% size reduction",
          );
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
    console.log(
      "Usage: deno run --allow-read examples/codec-detection.ts <audio-file>",
    );
    console.log("\nExample:");
    console.log(
      "  deno run --allow-read examples/codec-detection.ts music.mp3",
    );
    console.log(
      "  deno run --allow-read examples/codec-detection.ts audio.m4a",
    );
    console.log(
      "  deno run --allow-read examples/codec-detection.ts song.flac",
    );
    Deno.exit(1);
  }

  await analyzeAudioFile(args[0]);
}
