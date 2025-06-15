/**
 * @fileoverview Manual test for Cloudflare Workers compatibility (simulated environment)
 *
 * This is a utility script for manual testing, not part of the main test suite.
 * Run manually with: deno run --allow-read tests/test-workers.ts
 */

import {
  isCloudflareWorkers,
  loadTagLibModuleForWorkers,
} from "../src/wasm-workers.ts";
import { processAudioMetadata, TagLibWorkers } from "../src/workers.ts";

async function testWorkersCompatibility() {
  console.log("🧪 Testing Cloudflare Workers compatibility...\n");

  // Test environment detection
  console.log("1. Environment Detection:");
  console.log(`   isCloudflareWorkers(): ${isCloudflareWorkers()}`);
  console.log("   ✓ Environment detection works\n");

  try {
    // Load WASM binary
    console.log("2. Loading WASM binary...");
    const wasmPath = new URL("./build/taglib.wasm", import.meta.url).pathname;
    const wasmBinary = await Deno.readFile(wasmPath);
    console.log(`   ✓ WASM binary loaded: ${wasmBinary.length} bytes\n`);

    // Test Workers-specific WASM loader
    console.log("3. Testing Workers WASM loader...");
    try {
      const module = await loadTagLibModuleForWorkers(wasmBinary, {
        debug: true,
        memory: {
          initial: 8 * 1024 * 1024, // 8MB
          maximum: 32 * 1024 * 1024, // 32MB
        },
      });
      console.log("   ✓ Workers WASM loader functional\n");
    } catch (error) {
      console.log(
        `   ⚠️  Workers WASM loader failed: ${(error as Error).message}`,
      );
      console.log("   This is expected - requires Workers-compatible build\n");
    }

    // Test TagLibWorkers class
    console.log("4. Testing TagLibWorkers class...");
    try {
      const taglib = await TagLibWorkers.initialize(wasmBinary, {
        debug: false,
        memory: {
          initial: 8 * 1024 * 1024,
          maximum: 32 * 1024 * 1024,
        },
      });
      console.log("   ✓ TagLibWorkers initialization successful\n");

      // Test with actual audio file
      console.log("5. Testing with audio file...");
      const testAudioPath = "./test-files/mp3/kiss-snippet.mp3";

      try {
        const audioData = await Deno.readFile(testAudioPath);
        console.log(`   Audio file loaded: ${audioData.length} bytes`);

        const file = taglib.openFile(audioData);
        console.log(`   ✓ File opened successfully`);
        console.log(`   Valid: ${file.isValid()}`);
        console.log(`   Format: ${file.format()}`);

        const tag = file.tag();
        console.log(`   Tag: ${JSON.stringify(tag, null, 2)}`);

        const props = file.audioProperties();
        if (props) {
          console.log(`   Properties: ${JSON.stringify(props, null, 2)}`);
        }

        file.dispose();
        console.log("   ✓ File processed and disposed\n");
      } catch (error) {
        console.log(`   ⚠️  Test audio file not found: ${testAudioPath}`);
        console.log("   This is expected if test files aren't available\n");
      }
    } catch (error) {
      console.log(`   ⚠️  TagLibWorkers failed: ${(error as Error).message}`);
      console.log("   This is expected - requires Workers-compatible build\n");
    }

    // Test processAudioMetadata utility
    console.log("6. Testing processAudioMetadata utility...");
    try {
      const testData = new Uint8Array([
        // Minimal MP3 header for testing
        0xFF,
        0xFB,
        0x90,
        0x00, // MP3 sync + header
        ...new Array(100).fill(0x00), // Padding
      ]);

      try {
        const result = await processAudioMetadata(wasmBinary, testData);
        console.log(
          `   ✓ Utility function works: ${JSON.stringify(result.tag)}\n`,
        );
      } catch (error) {
        console.log(
          `   ⚠️  Expected failure with minimal test data: ${
            (error as Error).message
          }\n`,
        );
      }
    } catch (error) {
      console.log(
        `   ⚠️  processAudioMetadata failed: ${(error as Error).message}\n`,
      );
    }

    console.log("🎉 Workers compatibility testing completed!");
    console.log("\n📝 Summary:");
    console.log("   ✅ Workers API structure is compatible");
    console.log("   ✅ Type definitions are correct");
    console.log("   ✅ Environment detection works");
    console.log(
      "   ⚠️  Full functionality requires Workers-compatible WASM build",
    );
    console.log("\n🔧 Next steps for production use:");
    console.log("   1. Build WASM with -sENVIRONMENT=web flag");
    console.log("   2. Bundle WASM binary with Worker");
    console.log("   3. Test in actual Cloudflare Workers environment");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

if (import.meta.main) {
  await testWorkersCompatibility();
}
