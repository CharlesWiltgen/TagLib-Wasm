#!/usr/bin/env -S deno run --allow-read

/**
 * Check what's actually exported from taglib.js
 */

const TagLibModule = await import("../build/taglib.js");

console.log("Module exports:", Object.keys(TagLibModule));
console.log("Default export type:", typeof TagLibModule.default);
console.log("createTagLibModule type:", typeof TagLibModule.createTagLibModule);

// Try to call it
if (typeof TagLibModule.default === 'function') {
  console.log("\nTrying to call default export...");
  try {
    const module = await TagLibModule.default();
    console.log("✅ Module loaded! Keys:", Object.keys(module).length);
  } catch (e) {
    console.log("❌ Error:", e.message);
  }
}