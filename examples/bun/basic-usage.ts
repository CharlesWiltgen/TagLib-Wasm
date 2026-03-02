#!/usr/bin/env bun

/**
 * Bun Basic Usage Example
 *
 * This example demonstrates using TagLib-Wasm in Bun runtime.
 * Bun provides excellent WebAssembly support and can directly use
 * the same API as Node.js and browsers.
 *
 * To run:
 *   bun install
 *   bun run examples/bun/basic_usage.ts
 */

import { TagLib } from "../../index.ts";
import process from "node:process";

async function demonstrateBunUsage() {
  console.log("🎵 TagLib-Wasm - Bun Runtime Example");
  console.log("=".repeat(40));

  try {
    // Initialize TagLib-Wasm
    console.log("🔧 Initializing TagLib-Wasm...");
    const taglib = await TagLib.initialize();
    console.log("✅ TagLib initialized successfully");

    // For this example, we'll load a test file
    console.log("\n📁 Loading audio file...");

    // Load a real file if available, otherwise show the API
    try {
      const file = await taglib.open(
        "./tests/test-files/mp3/kiss-snippet.mp3",
      );

      if (file.isValid()) {
        console.log("✅ File loaded successfully");

        // Read existing metadata
        const tags = file.tag();
        const props = file.audioProperties();

        console.log("\n🏷️  Current Metadata:");
        console.log(`  Title: ${tags.title || "(none)"}`);
        console.log(`  Artist: ${tags.artist || "(none)"}`);
        console.log(`  Album: ${tags.album || "(none)"}`);
        console.log(`  Year: ${tags.year || "(none)"}`);
        console.log(`  Genre: ${tags.genre || "(none)"}`);

        if (props) {
          console.log("\n🎵 Audio Properties:");
          console.log(`  Format: ${props.format}`);
          console.log(`  Duration: ${props.length}s`);
          console.log(`  Bitrate: ${props.bitrate} kbps`);
          console.log(`  Sample Rate: ${props.sampleRate} Hz`);
          console.log(`  Channels: ${props.channels}`);
        }

        // Write new metadata
        console.log("\n✏️  Writing new metadata...");
        file.setProperty("title", "Bun Test Song");
        file.setProperty("artist", "Bun Test Artist");
        file.setProperty("album", "Bun Test Album");
        file.setProperty("date", "2024");
        file.setProperty("genre", "Electronic");

        // Read back the updated metadata
        const updatedTags = file.tag();
        console.log("\n🆕 Updated Metadata:");
        console.log(`  Title: ${updatedTags.title}`);
        console.log(`  Artist: ${updatedTags.artist}`);
        console.log(`  Album: ${updatedTags.album}`);
        console.log(`  Year: ${updatedTags.year}`);
        console.log(`  Genre: ${updatedTags.genre}`);

        // Demonstrate advanced metadata using PropertyMap
        console.log("\n🔬 Advanced Metadata (Using PropertyMap):");
        file.setProperty(
          "acoustidFingerprint",
          "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...",
        );
        file.setProperty("acoustidId", "e7359e88-f1f7-41ed-b9f6-16e58e906997");
        file.setProperty(
          "musicbrainzTrackId",
          "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
        );

        // ReplayGain properties
        file.setProperty("replayGainTrackGain", "-6.54 dB");
        file.setProperty("replayGainTrackPeak", "0.987654");

        // Apple Sound Check for MP4 files
        if (file.isMP4()) {
          file.setMP4Item(
            "----:com.apple.iTunes:iTunNORM",
            "00000150 00000150 00000150 00000150...",
          );
        }

        console.log(
          "✅ Automatic tag mapping set (would be stored format-specifically)",
        );

        // Clean up
        file.dispose();
      } else {
        console.log("❌ Failed to load audio file");
      }
    } catch (fileError) {
      console.log("⚠️  No test file found, showing API usage instead:");

      console.log("\n💡 Bun File Loading Examples:");
      console.log("```typescript");
      console.log("// Load from file system");
      console.log("const file = await taglib.open('song.mp3');");
      console.log("");
      console.log("// Load from buffer (e.g., from URL)");
      console.log(
        "const response = await fetch('https://example.com/song.mp3');",
      );
      console.log("const audioData = await response.arrayBuffer();");
      console.log("const file = await taglib.open(new Uint8Array(audioData));");
      console.log("");
      console.log("// Read/write metadata");
      console.log("const tags = file.tag();");
      console.log("file.setTitle('New Title');");
      console.log("file.dispose();");
      console.log("```");
    }

    console.log("\n" + "=".repeat(40));
    console.log("🎯 Bun Runtime Benefits:");
    console.log("• Fast startup time and execution");
    console.log("• Built-in TypeScript support");
    console.log("• Excellent WebAssembly performance");
    console.log("• Native file system APIs");
    console.log("• npm package compatibility");
    console.log("• Modern JavaScript/TypeScript features");

    console.log("\n📦 Installation for Bun:");
    console.log("bun add taglib-wasm");
    console.log("# or");
    console.log("bun add taglib-wasm");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Bun runtime detection and info
function showBunInfo() {
  console.log("🟡 Bun Runtime Information:");
  console.log(`  Version: ${Bun.version}`);
  console.log(`  Revision: ${Bun.revision}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Architecture: ${process.arch}`);
  console.log(`  Node.js compatibility: ${process.version}`);
  console.log("");
}

// Run the example
if (import.meta.main) {
  showBunInfo();
  await demonstrateBunUsage();
}
