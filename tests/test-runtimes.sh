#!/bin/bash

# Test script for different runtimes
echo "🧪 Testing taglib-wasm across different runtimes"
echo "=============================================="

# Create a simple test file
cat > runtime-test.ts << 'EOF'
// Simple runtime test
import { readTags, readProperties, getFormat } from "./src/simple.ts";

const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";

async function test() {
  const runtime = typeof Deno !== 'undefined' ? 'Deno' : 
                 typeof process !== 'undefined' ? 'Node.js' :
                 typeof (globalThis as any).Bun !== 'undefined' ? 'Bun' : 'Unknown';
  
  console.log(`\n🏃 Running on: ${runtime}`);
  
  try {
    const format = await getFormat(testFile);
    console.log(`📄 Format: ${format || '(empty)'}`);
    
    const tags = await readTags(testFile);
    console.log(`🏷️  Tags: ${JSON.stringify({
      title: tags.title || '(empty)',
      artist: tags.artist || '(empty)',
      year: tags.year
    })}`);
    
    const props = await readProperties(testFile);
    console.log(`🎧 Props: Duration=${props.length}s, Bitrate=${props.bitrate}kbps`);
    
    console.log("✅ Success!");
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

test();
EOF

echo -e "\n📦 Testing with Deno..."
if command -v deno &> /dev/null; then
  deno run --allow-read runtime-test.ts
else
  echo "❌ Deno not installed"
fi

echo -e "\n📦 Testing with Bun..."
if command -v bun &> /dev/null; then
  bun run runtime-test.ts
else
  echo "❌ Bun not installed"
fi

echo -e "\n📦 Testing with Node.js..."
if command -v node &> /dev/null; then
  # Node needs TypeScript transpilation
  npx tsx runtime-test.ts 2>/dev/null || echo "❌ Node.js test failed (needs tsx installed)"
else
  echo "❌ Node.js not installed"
fi

# Cleanup
rm runtime-test.ts

echo -e "\n✨ Runtime tests complete!"