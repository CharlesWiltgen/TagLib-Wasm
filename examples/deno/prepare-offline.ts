#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Prepares the WASM file for embedding in a Deno compiled binary.
 *
 * Run this script before compiling your application to copy the WASM file
 * to a location where it can be included in the compiled binary.
 */

import { prepareWasmForEmbedding } from "@charlesw/taglib-wasm";

console.log("Preparing WASM file for offline usage...");

try {
  await prepareWasmForEmbedding("./taglib.wasm");
  console.log("\nSuccess! Now compile your app with:");
  console.log("deno compile --allow-read --include taglib.wasm your-app.ts");
} catch (error) {
  console.error("Error:", error.message);
  Deno.exit(1);
}
