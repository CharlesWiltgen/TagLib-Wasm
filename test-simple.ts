/**
 * @fileoverview Simple test to verify WASM module loads
 */

// Test if we can read the JS file and evaluate it
try {
  const jsContent = await Deno.readTextFile("./build/taglib.js");
  
  // Execute the JS in a way that gives us access to TagLibWASM
  const globalThis = {} as any;
  const exports = {} as any;
  const module = { exports } as any;
  const define = undefined;
  
  // Execute the JS content with proper context
  eval(`
    ${jsContent}
    globalThis.TagLibWASM = TagLibWASM;
  `);
  
  console.log("✅ WASM JS content executed");
  console.log("🔧 TagLibWASM available:", typeof globalThis.TagLibWASM);
  
  // Test basic module instantiation
  const wasmInstance = await globalThis.TagLibWASM({
    print: console.log,
    printErr: console.error,
  });
  
  console.log("🎉 WASM module instantiated!");
  console.log("🔧 Available functions:", {
    malloc: typeof wasmInstance._malloc,
    free: typeof wasmInstance._free,
    taglib_file_new: typeof wasmInstance._taglib_file_new_from_buffer,
  });
  
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
  console.log("🔍 This helps us understand what's wrong with our WASM loading");
}