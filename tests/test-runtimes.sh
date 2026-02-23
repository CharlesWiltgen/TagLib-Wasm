#!/bin/bash

# Test script for different runtimes
echo "Testing TagLib-Wasm across different runtimes"
echo "=============================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WASI_TEST="$SCRIPT_DIR/cross-runtime-wasi.ts"
FAILURES=0

# --- Simple API tests (may use Emscripten fallback) ---

cat > "$PROJECT_ROOT/runtime-test.ts" << 'EOF'
// Simple runtime test
import { readTags, readProperties, readFormat } from "./src/simple.ts";

const testFile = "./tests/test-files/mp3/kiss-snippet.mp3";

async function test() {
  const runtime = typeof Deno !== 'undefined' ? 'Deno' :
                 typeof process !== 'undefined' ? 'Node.js' :
                 typeof (globalThis as any).Bun !== 'undefined' ? 'Bun' : 'Unknown';

  console.log(`\nRunning on: ${runtime}`);

  try {
    const format = await readFormat(testFile);
    console.log(`Format: ${format || '(empty)'}`);

    const tags = await readTags(testFile);
    console.log(`Tags: ${JSON.stringify({
      title: tags.title || '(empty)',
      artist: tags.artist || '(empty)',
      year: tags.year
    })}`);

    const props = await readProperties(testFile);
    console.log(`Props: Duration=${props.length}s, Bitrate=${props.bitrate}kbps`);

    console.log("Success!");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

test();
EOF

echo ""
echo "=== Simple API Tests ==="

echo -e "\nTesting with Deno (Simple API)..."
if command -v deno &> /dev/null; then
  (cd "$PROJECT_ROOT" && deno run --allow-read runtime-test.ts) || ((FAILURES++))
else
  echo "Deno not installed"
fi

echo -e "\nTesting with Bun (Simple API)..."
if command -v bun &> /dev/null; then
  (cd "$PROJECT_ROOT" && bun run runtime-test.ts) || ((FAILURES++))
else
  echo "Bun not installed"
fi

echo -e "\nTesting with Node.js (Simple API)..."
if command -v node &> /dev/null; then
  (cd "$PROJECT_ROOT" && npx tsx runtime-test.ts 2>/dev/null) || { echo "Node.js test failed (needs tsx installed)"; ((FAILURES++)); }
else
  echo "Node.js not installed"
fi

rm -f "$PROJECT_ROOT/runtime-test.ts"

# --- WASI Host tests (exercises loadWasiHost directly) ---

echo ""
echo "=== WASI Host Tests ==="

if [ ! -f "$PROJECT_ROOT/dist/wasi/taglib_wasi.wasm" ]; then
  echo "Skipping WASI host tests: dist/wasi/taglib_wasi.wasm not found"
else
  echo -e "\nTesting with Deno (WASI Host)..."
  if command -v deno &> /dev/null; then
    deno run --allow-read --allow-write --allow-env "$WASI_TEST" || ((FAILURES++))
  else
    echo "Deno not installed"
  fi

  echo -e "\nTesting with Bun (WASI Host)..."
  if command -v bun &> /dev/null; then
    bun run "$WASI_TEST" || ((FAILURES++))
  else
    echo "Bun not installed"
  fi

  echo -e "\nTesting with Node.js (WASI Host)..."
  if command -v node &> /dev/null; then
    # Node requires --experimental-wasm-exnref for Wasm exception handling
    node --experimental-wasm-exnref --import tsx "$WASI_TEST" 2>/dev/null || { echo "Node.js WASI test failed (needs tsx + Node 22+)"; ((FAILURES++)); }
  else
    echo "Node.js not installed"
  fi
fi

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "Runtime tests complete: $FAILURES failure(s)"
  exit 1
else
  echo "Runtime tests complete: all passed!"
fi
