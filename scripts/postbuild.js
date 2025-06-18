#!/usr/bin/env node

/**
 * Post-build script to copy runtime files to dist directory
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Ensure dist directory exists
const distDir = join(rootDir, "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// WASM files to copy from build to dist
const wasmFiles = [
  "taglib-wrapper.js",
  "taglib-wrapper.d.ts",
  "taglib.wasm",
];

console.log("📦 Copying runtime files to dist...");

// Copy WASM files
console.log("\n  🔧 WASM runtime files:");
wasmFiles.forEach((file) => {
  const src = join(rootDir, "build", file);
  const dest = join(distDir, file);

  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`    ✓ ${file}`);
  } else {
    console.error(`    ✗ ${file} (not found)`);
  }
});

// No longer copying TypeScript source files - only compiled output should be in dist

// Fix imports for Deno compatibility
console.log("\n🔧 Fixing imports for Deno compatibility...");
try {
  const { execSync } = await import("child_process");
  execSync("node scripts/fix-imports.js", {
    cwd: rootDir,
    stdio: "inherit",
  });
} catch (error) {
  console.error("❌ Failed to fix imports:", error.message);
}

console.log("\n✨ Post-build complete!");
