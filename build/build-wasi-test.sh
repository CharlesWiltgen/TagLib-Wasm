#!/bin/bash
# Quick WASI test build for unified loader demonstration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Building minimal WASI test binary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist/wasi"

# Source WASI environment
source "$SCRIPT_DIR/wasi-env.sh"

# Check for WASI SDK
if [ -z "$WASI_SDK_PATH" ] || [ ! -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo "❌ WASI SDK not found. Please run: ./build/setup-wasi-sdk.sh"
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

echo "Building minimal WASI test binary..."

# Compile minimal test binary
"$WASI_SDK_PATH/bin/clang++" \
    "$SCRIPT_DIR/test-wasi-minimal.cpp" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -o "$DIST_DIR/taglib_wasi.wasm" \
    -Wl,--export=malloc \
    -Wl,--export=free \
    -Wl,--export=tl_version \
    -Wl,--export=tl_read_tags \
    -Wl,--export=tl_read_tags_ex \
    -Wl,--export=tl_write_tags \
    -Wl,--export=tl_free \
    -Wl,--export=tl_get_last_error \
    -Wl,--export=tl_get_last_error_code \
    -Wl,--export=tl_clear_error \
    -Wl,--export=tl_detect_format \
    -Wl,--export=tl_format_name \
    -Wl,--initial-memory=1048576 \
    -Wl,--max-memory=16777216 \
    -Wl,-z,stack-size=131072 \
    -O3 \
    -std=c++17

# Check results
if [ ! -f "$DIST_DIR/taglib_wasi.wasm" ]; then
    echo "❌ WASM test build failed"
    exit 1
fi

# Generate metadata
cat > "$DIST_DIR/taglib_wasi.json" << EOF
{
  "name": "taglib_wasi_test",
  "version": "3.0.0-test",
  "target": "wasm32-wasi",
  "description": "Minimal test binary for unified loader demonstration",
  "exports": [
    "tl_version",
    "tl_read_tags",
    "tl_write_tags",
    "malloc",
    "free"
  ],
  "memory": {
    "initial": 1048576,
    "maximum": 16777216
  },
  "features": {
    "filesystem": true,
    "messagepack": true,
    "test_mode": true
  }
}
EOF

WASM_SIZE=$(ls -lh "$DIST_DIR/taglib_wasi.wasm" | awk '{print $5}')

echo ""
echo -e "${GREEN}✅ WASI test build successful${NC}"
echo ""
echo "Output files:"
echo "  📦 WASM: $DIST_DIR/taglib_wasi.wasm ($WASM_SIZE)"
echo "  📝 Meta: $DIST_DIR/taglib_wasi.json"
echo ""
echo "This is a minimal test binary for demonstrating the unified loader."
echo "It returns test data and validates the WASI integration pipeline."