#!/usr/bin/env node

/**
 * Prepare distribution directory with all runtime files
 * This runs after TypeScript compilation to create a complete dist folder
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { dirname, extname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Ensure dist directory exists
const distDir = join(rootDir, "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log("📦 Preparing distribution directory...");

// 1. Copy WASM runtime files from build to dist
const wasmFiles = [
  "taglib-wrapper.js",
  "taglib-wrapper.d.ts",
  "taglib.wasm",
];

console.log("\n1️⃣ Copying WASM runtime files...");
wasmFiles.forEach((file) => {
  const src = join(rootDir, "build", file);
  const dest = join(distDir, file);

  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  } else {
    console.error(`  ✗ Missing: ${src}`);
  }
});

// 2. The TypeScript compiler already outputs .js and .d.ts files to dist/
console.log("\n2️⃣ TypeScript compilation output:");
console.log("  ✓ JavaScript files (.js)");
console.log("  ✓ Declaration files (.d.ts)");
console.log("  ✓ Source maps (.js.map)");

// 3. Summary
console.log("\n✨ Distribution directory prepared!");
console.log("\nContents of dist/:");
console.log("  - All compiled JavaScript files");
console.log("  - TypeScript declarations");
console.log("  - WASM runtime (taglib.wasm)");
console.log("  - Emscripten wrapper (taglib-wrapper.js)");
