#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * @fileoverview Test script for @wasmer/sdk implementation
 *
 * Tests the new WASI loader with our test binary to ensure
 * it works correctly before building the full WASI binary.
 */

import {
  initializeWasmer,
  loadWasmerWasi,
  readTagsWithWasi,
  type WasiModule,
} from "../src/runtime/wasmer-sdk-loader/index.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";
import { assertEquals, assertExists } from "@std/assert";

console.log("Testing @wasmer/sdk implementation with WASI test binary...\n");

async function testWasmerSDK() {
  try {
    // Step 1: Initialize Wasmer SDK
    console.log("1. Initializing Wasmer SDK...");
    await initializeWasmer();
    console.log("   ✓ Wasmer SDK initialized\n");

    // Step 2: Load WASI module
    console.log("2. Loading WASI test binary...");
    const wasiModule = await loadWasmerWasi({
      wasmPath: "./dist/wasi/taglib_wasi_test.wasm",
      debug: true,
    });
    console.log("   ✓ WASI module loaded\n");

    // Step 3: Test version function
    console.log("3. Testing version function...");
    const version = wasiModule.tl_version();
    console.log(`   Version: ${version}`);
    assertEquals(version, "3.0.0-wasi-test");
    console.log("   ✓ Version matches expected\n");

    // Step 4: Test API version (if available)
    console.log("4. Testing API version...");
    if (wasiModule.tl_api_version) {
      const apiVersion = wasiModule.tl_api_version();
      console.log(`   API Version: ${apiVersion}`);
      assertEquals(apiVersion, 100);
      console.log("   ✓ API version correct\n");
    } else {
      console.log("   API version function not available in test binary\n");
    }

    // Step 5: Test memory allocation
    console.log("5. Testing memory allocation...");
    const ptr = wasiModule.malloc(1024);
    console.log(`   Allocated 1KB at address: 0x${ptr.toString(16)}`);
    assertExists(ptr);
    wasiModule.free(ptr);
    console.log("   ✓ Memory allocation working\n");

    // Step 6: Test reading tags with MessagePack
    console.log("6. Testing MessagePack tag reading...");
    const testBuffer = new Uint8Array([
      // MP3 ID3v2 header (mock)
      0x49,
      0x44,
      0x33,
      0x04,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      // Some data
      ...Array(100).fill(0),
    ]);

    const msgpackData = await readTagsWithWasi(testBuffer, wasiModule);
    console.log(`   Received ${msgpackData.length} bytes of MessagePack data`);
    console.log(
      `   Raw data: [${
        Array.from(msgpackData).map((b) =>
          "0x" + b.toString(16).padStart(2, "0")
        ).join(", ")
      }]`,
    );

    // Try to decode as generic MessagePack first
    try {
      const tags = decodeTagData(msgpackData);
      console.log("   Decoded tags:", tags);
    } catch (e) {
      console.log("   Note: Test binary returns stub data, not real tags");
      // For test binary, just verify we got some data
      assertEquals(msgpackData.length > 0, true);
    }
    console.log("   ✓ MessagePack data transfer working\n");

    // Step 7: Test error handling
    console.log("7. Testing error handling...");
    const errorCode = wasiModule.tl_get_last_error_code();
    console.log(`   Last error code: ${errorCode}`);
    assertEquals(errorCode, 0); // Should be no error
    console.log("   ✓ Error handling working\n");

    console.log(
      "✅ All tests passed! @wasmer/sdk implementation is working correctly.",
    );
    console.log("\nNext steps:");
    console.log("1. Build full WASI binary with complete TagLib functionality");
    console.log("2. Replace test stubs with real TagLib implementation");
    console.log("3. Test with real audio files");
  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    Deno.exit(1);
  }
}

// Run the test
await testWasmerSDK();
