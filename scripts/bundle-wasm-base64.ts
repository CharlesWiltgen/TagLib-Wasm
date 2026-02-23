#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * @fileoverview Generate a TypeScript module with embedded WASM for Deno compile
 *
 * This is a simpler alternative to the static build approach.
 * It creates a single file that can be imported in your project.
 */

const WASM_PATH = "./build/taglib.wasm";
const OUTPUT_PATH = "./taglib-wasm-embedded.ts";

console.log("📦 Generating embedded WASM module...\n");

try {
  // Read WASM file
  const wasmData = await Deno.readFile(WASM_PATH);
  console.log(`📊 WASM size: ${(wasmData.length / 1024).toFixed(1)} KB`);

  // Convert to base64 efficiently for large files
  // Use Web Streams API for chunk-based encoding
  const chunks: string[] = [];
  const chunkSize = 65536; // 64KB chunks

  for (let i = 0; i < wasmData.length; i += chunkSize) {
    const chunk = wasmData.slice(i, i + chunkSize);
    chunks.push(btoa(String.fromCharCode(...chunk)));
  }

  const base64 = chunks.join("");
  console.log(`📊 Base64 size: ${(base64.length / 1024).toFixed(1)} KB`);

  // Generate TypeScript module
  const content = `/**
 * @fileoverview Embedded WASM module for TagLib-Wasm
 * @generated ${new Date().toISOString()}
 * 
 * Usage:
 * \`\`\`typescript
 * import { TagLib } from "taglib-wasm";
 * import { wasmBinary } from "./taglib-wasm-embedded.ts";
 * 
 * const taglib = await TagLib.initialize({ wasmBinary });
 * \`\`\`
 */

// Base64-encoded WASM binary
const WASM_BASE64 = "${base64}";

// Export as Uint8Array
export const wasmBinary = Uint8Array.from(
  atob(WASM_BASE64),
  c => c.charCodeAt(0)
);

// Export metadata
export const wasmMetadata = {
  originalSize: ${wasmData.length},
  encodedSize: ${base64.length},
  generated: "${new Date().toISOString()}"
};
`;

  await Deno.writeTextFile(OUTPUT_PATH, content);
  console.log(`✅ Generated: ${OUTPUT_PATH}\n`);

  // Show usage example
  console.log("📚 Usage example:\n");
  console.log(`import { TagLib } from "taglib-wasm";
import { wasmBinary } from "./${OUTPUT_PATH}";

const taglib = await TagLib.initialize({ wasmBinary });
const file = await taglib.open("song.mp3");
console.log(file.tag().title);
file.dispose();`);

  console.log("\n🎯 To compile:");
  console.log("deno compile --allow-read your-app.ts");
} catch (error) {
  console.error("❌ Error:", error);
  Deno.exit(1);
}
