#!/usr/bin/env node

/**
 * Build script to compile TypeScript to JavaScript using esbuild
 * Handles .ts extensions in imports automatically
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

function findTsFiles(dir, rootDir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findTsFiles(full, rootDir));
    } else if (
      entry.endsWith(".ts") && !entry.endsWith(".d.ts") &&
      !entry.endsWith(".test.ts")
    ) {
      files.push(full.slice(rootDir.length + 1));
    }
  }
  return files;
}

console.log("📦 Building JavaScript files with esbuild...");

try {
  // Build index.ts
  console.log("  ⚡ Building index.js...");
  execSync(
    `npx esbuild index.ts --bundle --outfile=dist/index.js --format=esm --platform=node --target=es2020 --external:./build/* --external:./src/*`,
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  // Build all src files (not bundled, just transpiled)
  // Note: Shell glob src/**/*.ts doesn't recurse in bash without globstar.
  // Find all .ts files explicitly to work on all platforms.
  console.log("  ⚡ Building src/**/*.js...");
  const srcFiles = findTsFiles(join(rootDir, "src"), rootDir);
  execSync(
    `npx esbuild ${
      srcFiles.join(" ")
    } --outdir=dist/src --format=esm --platform=node --target=es2020`,
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  console.log("✨ JavaScript build complete!");
} catch (error) {
  console.error("❌ Build failed:", error.message);
  Deno.exit(1);
}
