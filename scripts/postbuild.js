#!/usr/bin/env node

/**
 * Post-build script to copy WASM runtime files to dist directory
 */

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Ensure dist directory exists
const distDir = join(rootDir, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Files to copy from build to dist
const filesToCopy = [
  'taglib-wrapper.js',
  'taglib-wrapper.d.ts',
  'taglib.wasm'
];

console.log('📦 Copying WASM runtime files to dist...');

filesToCopy.forEach(file => {
  const src = join(rootDir, 'build', file);
  const dest = join(distDir, file);
  
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.error(`  ✗ Source file not found: ${src}`);
  }
});

console.log('✨ Post-build complete!');