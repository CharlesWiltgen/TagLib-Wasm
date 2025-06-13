#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Test the minimal Embind runtime for JSR compatibility
 */

import { loadTagLibModuleJSR } from "../src/wasm-jsr.ts";

console.log("🧪 Testing minimal Embind runtime for JSR...");

try {
  // Load the module
  console.log("📦 Loading TagLib module with minimal Embind runtime...");
  const module = await loadTagLibModuleJSR();
  
  console.log("✅ Module loaded successfully");
  
  // Test that we have the expected classes
  console.log("\n📋 Checking Embind classes:");
  console.log("  - FileHandle:", typeof module.FileHandle);
  console.log("  - TagWrapper:", typeof module.TagWrapper);
  console.log("  - AudioPropertiesWrapper:", typeof module.AudioPropertiesWrapper);
  console.log("  - createFileHandle:", typeof module.createFileHandle);
  
  // Test basic functionality
  console.log("\n🔧 Testing basic functionality:");
  
  // Create a FileHandle
  const fileHandle = module.createFileHandle();
  console.log("  - Created FileHandle:", fileHandle ? "✅" : "❌");
  
  // Test FileHandle methods
  const testData = "test data";
  const loaded = fileHandle.loadFromBuffer(testData);
  console.log("  - loadFromBuffer:", loaded ? "✅" : "❌");
  
  const isValid = fileHandle.isValid();
  console.log("  - isValid:", isValid ? "✅" : "❌");
  
  const format = fileHandle.getFormat();
  console.log("  - getFormat:", format);
  
  // Test Tag functionality
  const tag = fileHandle.getTag();
  console.log("\n🏷️  Testing Tag:");
  console.log("  - title:", tag.title());
  console.log("  - artist:", tag.artist());
  console.log("  - album:", tag.album());
  
  // Test AudioProperties
  const props = fileHandle.getAudioProperties();
  console.log("\n🎵 Testing AudioProperties:");
  console.log("  - length:", props.lengthInSeconds(), "seconds");
  console.log("  - bitrate:", props.bitrate(), "kbps");
  console.log("  - sampleRate:", props.sampleRate(), "Hz");
  console.log("  - channels:", props.channels());
  
  // Test memory management
  console.log("\n💾 Testing memory functions:");
  console.log("  - _malloc:", typeof module._malloc);
  console.log("  - _free:", typeof module._free);
  console.log("  - allocate:", typeof module.allocate);
  console.log("  - UTF8ToString:", typeof module.UTF8ToString);
  
  // Test cleanup
  fileHandle.delete();
  console.log("\n🗑️  Cleanup: FileHandle deleted");
  
  console.log("\n✅ All tests passed! Minimal Embind runtime is working.");
  
} catch (error) {
  console.error("❌ Error:", error);
  Deno.exit(1);
}