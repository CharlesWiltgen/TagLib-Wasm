#!/usr/bin/env node

/**
 * Post-build script to copy runtime files to dist directory
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
  "taglib-web.wasm",
  "taglib_wasi.wasm",
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
  const { execSync } = await import("node:child_process");
  execSync("deno run --allow-read --allow-write scripts/fix-imports.js", {
    cwd: rootDir,
    stdio: "inherit",
  });

  // Apply Deno-specific patches to the distributed wrapper
  console.log(
    "🔧 Applying Deno compatibility patches to dist/taglib-wrapper.js...",
  );
  execSync(
    "deno run --allow-read --allow-write scripts/fix-deno-compat-dist.js",
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );
} catch (error) {
  console.error("❌ Failed to fix imports:", error.message);
}

// Verify no stale build/ wasm references remain
console.log("\n🔍 Verifying wasm path resolution...");
const { readFileSync } = await import("node:fs");
const wasmLoaders = [
  "dist/src/runtime/unified-loader/module-loading.js",
  "dist/src/runtime/wasi-host-loader.js",
  "dist/src/runtime/module-loader.js",
];
let wasmPathsOk = true;
for (const file of wasmLoaders) {
  const fullPath = join(rootDir, file);
  if (!existsSync(fullPath)) continue;
  const src = readFileSync(fullPath, "utf8");
  if (
    src.includes("build/taglib_wasi.wasm") ||
    src.includes("build/taglib-web.wasm")
  ) {
    console.error(`  ✗ ${file} still contains build/ wasm references`);
    wasmPathsOk = false;
  }
}
if (wasmPathsOk) {
  console.log("  ✓ All wasm paths resolve correctly");
}

console.log("\n✨ Post-build complete!");
