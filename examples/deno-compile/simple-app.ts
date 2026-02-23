#!/usr/bin/env -S deno run --allow-read --allow-net
/// <reference lib="deno.ns" />

/**
 * Simple example of using TagLib-Wasm with Deno compile
 *
 * This example uses CDN loading which works well with Deno compile
 * and doesn't require complex embedding strategies.
 */

import { readTags, TagLib } from "../../mod.ts";

// Create a test WAV file with minimal valid header
function createTestWav(): Uint8Array {
  const header = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x24,
    0x08,
    0x00,
    0x00, // File size
    0x57,
    0x41,
    0x56,
    0x45, // "WAVE"
    0x66,
    0x6D,
    0x74,
    0x20, // "fmt "
    0x10,
    0x00,
    0x00,
    0x00, // Chunk size
    0x01,
    0x00, // Audio format (PCM)
    0x02,
    0x00, // Channels (2)
    0x44,
    0xAC,
    0x00,
    0x00, // Sample rate (44100)
    0x10,
    0xB1,
    0x02,
    0x00, // Byte rate
    0x04,
    0x00, // Block align
    0x10,
    0x00, // Bits per sample (16)
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x00,
    0x08,
    0x00,
    0x00, // Data size
  ]);

  const data = new Uint8Array(2048);
  data.set(header);
  return data;
}

async function main() {
  console.log("🎵 TagLib-Wasm Deno Compile Example\n");

  try {
    // Initialize TagLib with CDN URL
    console.log("Initializing TagLib from CDN...");
    const taglib = await TagLib.initialize({
      wasmUrl:
        "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
    });
    console.log("✅ TagLib initialized successfully!\n");

    // Process command line files
    if (Deno.args.length > 0) {
      for (const filePath of Deno.args) {
        console.log(`📄 Reading: ${filePath}`);
        try {
          const tags = await readTags(filePath);
          console.log("  Title:", tags.title || "(none)");
          console.log("  Artist:", tags.artist || "(none)");
          console.log("  Album:", tags.album || "(none)");
          console.log("  Year:", tags.year || "(none)");

          if ("audioProperties" in tags && tags.audioProperties) {
            console.log("  Duration:", tags.audioProperties.length, "seconds");
            console.log("  Bitrate:", tags.audioProperties.bitrate, "kbps");
          }
          console.log();
        } catch (error) {
          console.error(
            `  ❌ Error: ${
              error instanceof Error ? error.message : String(error)
            }\n`,
          );
        }
      }
    } else {
      // Demo with test data
      console.log("No files provided. Using test WAV data:\n");
      const testData = createTestWav();

      const file = await taglib.open(testData);
      console.log("  Valid:", file.isValid());

      const tag = file.tag();
      console.log("  Title:", tag.title || "(empty)");
      console.log("  Artist:", tag.artist || "(empty)");

      const props = file.audioProperties();
      if (props) {
        console.log("  Channels:", props.channels);
        console.log("  Sample Rate:", props.sampleRate, "Hz");
      }

      file.dispose();

      console.log("\n💡 Usage: ./simple-app [audio files...]");
    }
  } catch (error) {
    console.error(
      "❌ Fatal error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
