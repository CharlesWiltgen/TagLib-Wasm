#!/usr/bin/env node

/**
 * Build script to compile TypeScript to JavaScript using esbuild
 * Handles .ts extensions in imports automatically
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log('📦 Building JavaScript files with esbuild...');

try {
  // Build index.ts
  console.log('  ⚡ Building index.js...');
  execSync(`npx esbuild index.ts --bundle --outfile=dist/index.js --format=esm --platform=node --target=es2020 --external:./build/* --external:./src/*`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  // Build all src files (not bundled, just transpiled)
  console.log('  ⚡ Building src/**/*.js...');
  execSync(`npx esbuild src/**/*.ts --outdir=dist/src --format=esm --platform=node --target=es2020`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log('✨ JavaScript build complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}