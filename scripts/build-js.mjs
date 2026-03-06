#!/usr/bin/env node

/**
 * Build script to compile TypeScript to JavaScript using esbuild
 * Handles .ts extensions in imports automatically
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

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

/**
 * esbuild plugin that redirects server-only modules to browser-compatible stubs
 * during browser builds:
 * - module-loader.ts → module-loader-browser.ts (Emscripten-only loader)
 * - platform-io.ts → inline stub that throws on filesystem calls
 */
function browserRedirectPlugin() {
  const platformIOStub = `
    export function getPlatformIO() {
      throw new Error("Filesystem operations are not available in the browser.");
    }
    export function _setPlatformIOForTesting() {}
    export function _resetPlatformIO() {}
  `;

  return {
    name: "browser-redirect",
    setup(build) {
      build.onResolve({ filter: /module-loader\.ts$/ }, (args) => {
        if (args.importer && !args.path.includes("module-loader-browser")) {
          const resolved = join(
            dirname(args.importer),
            args.path.replace("module-loader.ts", "module-loader-browser.ts"),
          );
          return { path: resolved };
        }
        return undefined;
      });

      // Rewrite taglib-wrapper.js imports to ./taglib-wrapper.js (co-located in dist/)
      build.onResolve({ filter: /taglib-wrapper\.js$/ }, () => {
        return { path: "./taglib-wrapper.js", external: true };
      });

      build.onResolve({ filter: /platform-io\.ts$/ }, (args) => {
        if (args.importer) {
          return {
            path: "platform-io-browser-stub",
            namespace: "browser-stub",
          };
        }
        return undefined;
      });

      build.onLoad(
        { filter: /platform-io-browser-stub/, namespace: "browser-stub" },
        () => ({ contents: platformIOStub, loader: "ts" }),
      );
    },
  };
}

console.log("📦 Building JavaScript files with esbuild...");

// Root entry files that need individual bundled builds
const rootEntryFiles = [
  "index.ts",
  "simple.ts",
  "folder.ts",
  "web.ts",
  "rating.ts",
];

// Browser entry files — fully bundled with module-loader redirect
const browserEntryFiles = [
  "index.browser.ts",
  "simple.browser.ts",
];

try {
  // Build root entry files (server/universal)
  for (const entry of rootEntryFiles) {
    const outName = entry.replace(".ts", ".js");
    console.log(`  ⚡ Building ${outName}...`);
    execSync(
      `npx esbuild ${entry} --bundle --outfile=dist/${outName} --format=esm --platform=node --target=es2020 --external:./build/* --external:./src/*`,
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
  }

  // Build browser entry files (fully bundled, no server imports)
  for (const entry of browserEntryFiles) {
    const outName = entry.replace(".ts", ".js");
    console.log(`  🌐 Building ${outName}...`);
    await esbuild.build({
      entryPoints: [join(rootDir, entry)],
      bundle: true,
      outfile: join(distDir, outName),
      format: "esm",
      platform: "browser",
      target: "es2020",
      external: [],
      plugins: [browserRedirectPlugin()],
    });
  }

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
