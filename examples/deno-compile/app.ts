#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Example: Using TagLib-Wasm with Deno compile
 *
 * This example shows a production-ready approach that works in:
 * - Development (deno run)
 * - Production (deno compile)
 * - With or without network access
 */

import { type ExtendedTag, readTags, TagLib } from "../../mod.ts";

// Configuration from environment
const USE_EMBEDDED = Deno.env.get("USE_EMBEDDED_WASM") === "true";
const WASM_URL = Deno.env.get("WASM_URL") ||
  "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm";

/**
 * Initialize TagLib with appropriate WASM loading strategy
 */
async function initializeTagLib(): Promise<TagLib> {
  console.log("🎵 Initializing TagLib-Wasm...");

  // Strategy 1: Check if running as compiled binary with included WASM
  const isCompiled = import.meta.url.startsWith("file:///") &&
    import.meta.url.includes("/deno-compile-");

  if (isCompiled) {
    try {
      // In compiled binaries, the included WASM is at a relative path
      const wasmPath = new URL("../../build/taglib.wasm", import.meta.url);
      const wasmBinary = await Deno.readFile(wasmPath);
      console.log("📦 Using embedded WASM from compiled binary");
      return await TagLib.initialize({ wasmBinary });
    } catch (e) {
      console.log("⚠️  Embedded WASM not found in compiled binary");
      console.log("    Error:", e instanceof Error ? e.message : String(e));
    }
  }

  // Strategy 2: Use base64 embedded WASM (if available and USE_EMBEDDED is set)
  if (USE_EMBEDDED) {
    try {
      const embeddedPath = new URL(
        "../../taglib-wasm-embedded.ts",
        import.meta.url,
      );
      const { wasmBinary } = await import(embeddedPath.href);
      console.log("📦 Using base64 embedded WASM");
      return await TagLib.initialize({ wasmBinary });
    } catch (e) {
      console.log("⚠️  Base64 embedded WASM not found");
    }
  }

  // Strategy 3: Try local file (development)
  try {
    const wasmBinary = await Deno.readFile("../../build/taglib.wasm");
    console.log("📁 Using local WASM file");
    return await TagLib.initialize({ wasmBinary });
  } catch {
    // Not in development environment
  }

  // Strategy 4: Load from network
  console.log("🌐 Loading WASM from:", WASM_URL);
  return await TagLib.initialize({ wasmUrl: WASM_URL });
}

/**
 * Demo function that reads metadata from an audio file
 */
async function processAudioFile(data: Uint8Array): Promise<void> {
  try {
    const tags = await readTags(data);

    console.log("\n📋 Metadata:");
    console.log("  Title:", tags.title || "(none)");
    console.log("  Artist:", tags.artist || "(none)");
    console.log("  Album:", tags.album || "(none)");
    console.log("  Year:", tags.year || "(none)");

    if ("audioProperties" in tags && tags.audioProperties) {
      console.log("\n🎵 Audio Properties:");
      console.log("  Duration:", tags.audioProperties.length, "seconds");
      console.log("  Bitrate:", tags.audioProperties.bitrate, "kbps");
      console.log("  Sample Rate:", tags.audioProperties.sampleRate, "Hz");
    }
  } catch (error) {
    console.error(
      "❌ Error reading tags:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Create a minimal test WAV file
 */
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
    0x00, // Channels
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
    0x00, // Bits per sample
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

/**
 * Main application
 */
async function main() {
  console.log("TagLib-Wasm Deno Compile Example\n");

  try {
    // Initialize TagLib
    const taglib = await initializeTagLib();
    console.log("✅ TagLib initialized successfully!\n");

    // Process files from command line arguments
    if (Deno.args.length > 0) {
      for (const filePath of Deno.args) {
        console.log(`\n📄 Processing: ${filePath}`);
        try {
          const data = await Deno.readFile(filePath);
          await processAudioFile(data);
        } catch (error) {
          console.error(
            `❌ Error reading file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } else {
      // No files provided, use test data
      console.log("ℹ️  No files provided, using test WAV data\n");
      const testData = createTestWav();
      await processAudioFile(testData);

      console.log("\n💡 Usage: deno run --allow-read app.ts [audio files...]");
    }

    // TagLib instance is automatically cleaned up (no dispose method needed)
  } catch (error) {
    console.error(
      "❌ Fatal error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

// Run the application
if (import.meta.main) {
  await main();
}

// Export for testing
export { initializeTagLib, processAudioFile };
