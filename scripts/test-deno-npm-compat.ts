#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Test script to verify Deno compatibility with the npm package
 * This script tests both the local build and the npm package
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

console.log("🧪 Testing TagLib-Wasm Deno compatibility...\n");

// Test 1: Test local build
console.log("Test 1: Testing local build from dist/");
try {
  const { TagLib } = await import("../dist/index.js");
  const taglib = await TagLib.initialize();
  console.log("✅ Local build works with Deno\n");
} catch (error) {
  console.error("❌ Local build failed:");
  console.error(error);
  console.error("");
}

// Test 2: Test npm package (latest version)
console.log("Test 2: Testing npm package (latest)");
try {
  const { TagLib } = await import("npm:taglib-wasm");
  const taglib = await TagLib.initialize();
  console.log("✅ NPM package works with Deno\n");
} catch (error) {
  console.error("❌ NPM package failed:");
  console.error(error);
  if (
    error instanceof Error && error.message.includes("WebAssembly.Table.get")
  ) {
    console.error("\n⚠️  This is the reported WebAssembly error!");
    console.error(
      "The distributed package needs the Deno compatibility fixes.",
    );
  }
  console.error("");
}

// Test 3: Test Simple API
console.log("Test 3: Testing Simple API");
try {
  const { readTags, isValidAudioFile } = await import("../dist/src/simple.js");

  // Create a minimal WAV file
  const wavHeader = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x24,
    0x00,
    0x00,
    0x00, // File size - 8
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
    0x00, // Subchunk size
    0x01,
    0x00, // Audio format (PCM)
    0x01,
    0x00, // Channels
    0x44,
    0xAC,
    0x00,
    0x00, // Sample rate (44100)
    0x88,
    0x58,
    0x01,
    0x00, // Byte rate
    0x02,
    0x00, // Block align
    0x10,
    0x00, // Bits per sample
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x00,
    0x00,
    0x00,
    0x00, // Data size
  ]);

  const isValid = await isValidAudioFile(wavHeader);
  assertEquals(isValid, true, "WAV file should be valid");

  const tags = await readTags(wavHeader);
  assertEquals(tags.title, "", "Empty WAV should have empty title");

  console.log("✅ Simple API works with Deno\n");
} catch (error) {
  console.error("❌ Simple API failed:");
  console.error(error);
  console.error("");
}

console.log("🎉 Deno compatibility tests complete!");
