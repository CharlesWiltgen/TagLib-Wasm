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

// Copy TypeScript source files
console.log("\n  📄 TypeScript source files:");

// Copy index.ts
const indexSrc = join(rootDir, "index.ts");
const indexDest = join(distDir, "index.ts");
if (existsSync(indexSrc)) {
  copyFileSync(indexSrc, indexDest);
  console.log("    ✓ index.ts");
}

// Copy src directory recursively
function copyDirectory(srcDir, destDir) {
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const entries = readdirSync(srcDir);
  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.endsWith(".ts")) {
      copyFileSync(srcPath, destPath);
      console.log(`    ✓ ${relative(rootDir, srcPath)}`);
    }
  }
}

const srcDir = join(rootDir, "src");
const destSrcDir = join(distDir, "src");
copyDirectory(srcDir, destSrcDir);

console.log("\n✨ Post-build complete!");
