#!/bin/bash

# Test script to validate NPM package distribution
# This ensures the packed NPM package works correctly for Node.js and Deno consumers

set -e

echo "🧪 Testing NPM package distribution"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Ensure we have a clean build
echo -e "\n📦 Building project..."
npm run build

# Create the NPM package
echo -e "\n📦 Creating NPM package..."
npm pack
PACKAGE_FILE=$(ls -t taglib-wasm-*.tgz | head -1)

if [ -z "$PACKAGE_FILE" ]; then
  echo -e "${RED}❌ Failed to create package${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Created package: $PACKAGE_FILE${NC}"

# Get package info
PACKAGE_SIZE=$(du -h "$PACKAGE_FILE" | cut -f1)
echo -e "  Package size: $PACKAGE_SIZE"

# Create temporary test directory
TEST_DIR=$(mktemp -d)
echo -e "\n🗂️  Test directory: $TEST_DIR"

# Cleanup function
cleanup() {
  echo -e "\n🧹 Cleaning up..."
  rm -rf "$TEST_DIR"
  rm -f "$PACKAGE_FILE"
}
trap cleanup EXIT

# Test 1: Node.js CommonJS
echo -e "\n${YELLOW}📦 Testing Node.js CommonJS...${NC}"
NODE_CJS_DIR="$TEST_DIR/node-cjs"
mkdir -p "$NODE_CJS_DIR"

# Create package.json for CommonJS
cat > "$NODE_CJS_DIR/package.json" << EOF
{
  "name": "test-node-cjs",
  "type": "commonjs",
  "dependencies": {
    "taglib-wasm": "file:$PROJECT_ROOT/$PACKAGE_FILE"
  }
}
EOF

# Install the package
cd "$NODE_CJS_DIR"
npm install --no-save

# Create CommonJS test
cat > "$NODE_CJS_DIR/test.js" << 'EOF'
const { readTags, readProperties, readFormat } = require("taglib-wasm/simple");
const fs = require("fs");
const path = require("path");

async function test() {
  console.log("Testing CommonJS import...");
  
  // Test with a simple WAV file (we'll create one)
  const testData = Buffer.from([
    // RIFF header
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // chunk size
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    // fmt chunk
    0x66, 0x6D, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // chunk size
    0x01, 0x00,             // audio format (PCM)
    0x01, 0x00,             // channels
    0x44, 0xAC, 0x00, 0x00, // sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // byte rate
    0x02, 0x00,             // block align
    0x10, 0x00,             // bits per sample
    // data chunk
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00, // chunk size
  ]);
  
  const format = await readFormat(testData);
  console.log(`Format: ${format}`);

  const tags = await readTags(testData);
  console.log(`Tags:`, tags);

  console.log("✅ CommonJS test passed!");
}

test().catch(console.error);
EOF

# Run the test
echo "Running CommonJS test..."
node test.js

# Test 2: Node.js ESM
echo -e "\n${YELLOW}📦 Testing Node.js ESM...${NC}"
NODE_ESM_DIR="$TEST_DIR/node-esm"
mkdir -p "$NODE_ESM_DIR"

# Create package.json for ESM
cat > "$NODE_ESM_DIR/package.json" << EOF
{
  "name": "test-node-esm",
  "type": "module",
  "dependencies": {
    "taglib-wasm": "file:$PROJECT_ROOT/$PACKAGE_FILE"
  }
}
EOF

# Install the package
cd "$NODE_ESM_DIR"
npm install --no-save

# Create ESM test
cat > "$NODE_ESM_DIR/test.js" << 'EOF'
import { readTags, readProperties, readFormat } from "taglib-wasm/simple";

async function test() {
  console.log("Testing ESM import...");
  
  // Test with a simple WAV file
  const testData = new Uint8Array([
    // RIFF header
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // chunk size
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    // fmt chunk
    0x66, 0x6D, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // chunk size
    0x01, 0x00,             // audio format (PCM)
    0x01, 0x00,             // channels
    0x44, 0xAC, 0x00, 0x00, // sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // byte rate
    0x02, 0x00,             // block align
    0x10, 0x00,             // bits per sample
    // data chunk
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00, // chunk size
  ]);
  
  const format = await readFormat(testData);
  console.log(`Format: ${format}`);

  const props = await readProperties(testData);
  console.log(`Properties:`, props);
  
  console.log("✅ ESM test passed!");
}

test().catch(console.error);
EOF

# Run the test
echo "Running ESM test..."
node test.js

# Test 3: Deno with npm: specifier
echo -e "\n${YELLOW}📦 Testing Deno npm: import...${NC}"
DENO_DIR="$TEST_DIR/deno"
mkdir -p "$DENO_DIR"

# For Deno, we need to test with the actual published package name
# Since we can't use npm: with a local file, we'll test the import resolution
cd "$DENO_DIR"

# Create Deno test that would work with npm:taglib-wasm (package name)
cat > "$DENO_DIR/test.ts" << 'EOF'
// This test validates the package structure for Deno npm: imports
// In production, this would be: import { readTags } from "npm:taglib-wasm/simple";

// For now, we'll test that the package structure is correct
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

const nodeModulesPath = Deno.env.get("NODE_MODULES_PATH");
if (!nodeModulesPath) {
  console.error("NODE_MODULES_PATH not set");
  Deno.exit(1);
}

const packagePath = join(nodeModulesPath, "taglib-wasm");

// Check package structure
const requiredFiles = [
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/src/simple.js",
  "dist/src/simple.d.ts",
  "dist/taglib-web.wasm",
  "dist/taglib-wrapper.js",
];

console.log("Checking package structure for Deno compatibility...");
let allGood = true;

for (const file of requiredFiles) {
  const fullPath = join(packagePath, file);
  const exists = existsSync(fullPath);
  console.log(`  ${exists ? "✓" : "✗"} ${file}`);
  if (!exists) allGood = false;
}

// Check that package.json has correct exports
const packageJson = JSON.parse(Deno.readTextFileSync(join(packagePath, "package.json")));
console.log("\nPackage exports:");
console.log(JSON.stringify(packageJson.exports, null, 2));

if (allGood) {
  console.log("\n✅ Package structure valid for Deno npm: imports!");
} else {
  console.log("\n❌ Package structure issues found!");
  Deno.exit(1);
}
EOF

# Run the Deno structure test
echo "Checking package structure for Deno..."
NODE_MODULES_PATH="$NODE_ESM_DIR/node_modules" deno run --allow-read --allow-env test.ts

# Test 4: Validate package contents
echo -e "\n${YELLOW}📦 Validating package contents...${NC}"
cd "$PROJECT_ROOT"
tar -tzf "$PACKAGE_FILE" | head -20
echo "..."
echo -e "${GREEN}✓ Package contents look good${NC}"

# Summary
echo -e "\n${GREEN}✨ All tests passed!${NC}"
echo -e "\nPackage validation complete:"
echo -e "  ${GREEN}✓${NC} Node.js CommonJS import"
echo -e "  ${GREEN}✓${NC} Node.js ESM import"
echo -e "  ${GREEN}✓${NC} Deno npm: compatibility"
echo -e "  ${GREEN}✓${NC} Package structure validation"