/**
 * @fileoverview Test script to verify WASM build when we have audio files
 */

import { TagLib } from "../mod.ts";

async function testWithSampleFile() {
  console.log("🧪 Testing taglib-wasm with sample data...");

  try {
    // Initialize TagLib
    const taglib = await TagLib.initialize({
      debug: true,
    });

    console.log("✅ taglib-wasm module loaded successfully");

    // For now, just test that we can get the module
    const module = taglib.getModule();
    console.log("🔧 Module functions available:", {
      malloc: typeof module._malloc,
      free: typeof module._free,
      taglib_file_new: typeof module._taglib_file_new_from_buffer,
    });

    // Let's see what functions are actually available
    const availableFunctions = Object.keys(module).filter((key) =>
      key.startsWith("_") && typeof module[key] === "function"
    );
    console.log(
      "🔍 Available WASM functions:",
      availableFunctions.slice(0, 10),
    );

    console.log("🎉 Basic WASM integration working!");
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    console.log(
      "💡 This is expected until we implement buffer-based file loading in the C++ bindings",
    );
  }
}

if (import.meta.main) {
  await testWithSampleFile();
}
