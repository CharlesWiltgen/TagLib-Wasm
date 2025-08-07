#!/bin/bash
# Phase 1: Build script for WASI SDK toolchain
# Compiles TagLib and C API for server/CLI environments

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔨 Building TagLib-Wasm with WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/capi"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
BUILD_DIR="$PROJECT_ROOT/build/wasi"
DIST_DIR="$PROJECT_ROOT/dist/wasi"

# Source WASI environment
source "$SCRIPT_DIR/wasi-env.sh"

# Check for WASI SDK
if [ -z "$WASI_SDK_PATH" ] || [ ! -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo -e "${RED}❌ WASI SDK not found.${NC}"
    echo "Please run: ./build/setup-wasi-sdk.sh"
    exit 1
fi

echo "Found WASI SDK: $WASI_SDK_PATH"
"$WASI_SDK_PATH/bin/clang++" --version | head -1

# Create build directories
mkdir -p "$BUILD_DIR/taglib"
mkdir -p "$DIST_DIR"

# Step 1: Configure TagLib with WASI SDK
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Step 1: Building TagLib with WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR/taglib"

# Configure TagLib with CMake for WASI
echo "Configuring TagLib with CMake for WASI..."
cmake "$TAGLIB_DIR" \
    -DCMAKE_TOOLCHAIN_FILE="$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_STATIC=ON \
    -DWITH_MP4=ON \
    -DWITH_ASF=ON \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_TESTS=OFF \
    -DBUILD_BINDINGS=OFF \
    -DCMAKE_CXX_FLAGS="-O3 -fno-exceptions -fno-rtti" \
    -DCMAKE_C_FLAGS="-O3" \
    -DCMAKE_SYSROOT="$WASI_SDK_PATH/share/wasi-sysroot" \
    -DWASI_SDK_PREFIX="$WASI_SDK_PATH"

# Build TagLib
echo "Building TagLib..."
make -j$(nproc)

if [ ! -f "$BUILD_DIR/taglib/taglib/libtag.a" ]; then
    echo -e "${RED}❌ TagLib build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TagLib built successfully${NC}"
ls -lh "$BUILD_DIR/taglib/taglib/libtag.a"

# Step 2: Link final WASM module
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Step 2: Linking final WASM module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_ROOT"

# Compile and link the C API with TagLib
echo "Linking C API with TagLib..."
"$WASI_SDK_PATH/bin/clang++" "$SRC_DIR/taglib_api.cpp" \
    "$BUILD_DIR/taglib/taglib/libtag.a" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -I"$TAGLIB_DIR" \
    -I"$TAGLIB_DIR/taglib" \
    -I"$TAGLIB_DIR/taglib/toolkit" \
    -I"$TAGLIB_DIR/taglib/mpeg/id3v2" \
    -I"$BUILD_DIR/taglib" \
    -o "$DIST_DIR/taglib_wasi.wasm" \
    -Wl,--export=tl_read_tags \
    -Wl,--export=tl_write_tags \
    -Wl,--export=tl_free \
    -Wl,--export=tl_version \
    -Wl,--export=tl_get_last_error \
    -Wl,--export=malloc \
    -Wl,--export=free \
    -Wl,--export=__heap_base \
    -Wl,--export=__data_end \
    -Wl,--initial-memory=16777216 \
    -Wl,--max-memory=1073741824 \
    -Wl,--stack-size=1048576 \
    -Oz \
    -fno-exceptions \
    -fno-rtti

# Check results
if [ ! -f "$DIST_DIR/taglib_wasi.wasm" ]; then
    echo -e "${RED}❌ WASM module build failed${NC}"
    exit 1
fi

# Step 3: Optimize with wasm-opt
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Step 3: Optimizing WASM module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v wasm-opt &> /dev/null; then
    echo "Optimizing with wasm-opt..."
    wasm-opt -Oz \
        --enable-simd \
        --enable-bulk-memory \
        "$DIST_DIR/taglib_wasi.wasm" \
        -o "$DIST_DIR/taglib_wasi.wasm"
    echo -e "${GREEN}✅ Optimization complete${NC}"
else
    echo -e "${YELLOW}⚠️  wasm-opt not found, skipping optimization${NC}"
    echo "Install with: npm install -g wasm-opt"
fi

# Step 4: Strip debug info
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔪 Step 4: Stripping debug information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v wasm-strip &> /dev/null; then
    echo "Stripping debug info..."
    wasm-strip "$DIST_DIR/taglib_wasi.wasm"
    echo -e "${GREEN}✅ Debug info stripped${NC}"
else
    echo -e "${YELLOW}⚠️  wasm-strip not found, skipping${NC}"
    echo "Install with: npm install -g wasm-strip"
fi

# Generate metadata file
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Step 5: Generating metadata"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > "$DIST_DIR/taglib_wasi.json" << EOF
{
  "name": "taglib_wasi",
  "version": "3.0.0",
  "target": "wasm32-wasi",
  "exports": [
    "tl_read_tags",
    "tl_write_tags",
    "tl_free",
    "tl_version",
    "tl_get_last_error",
    "malloc",
    "free"
  ],
  "memory": {
    "initial": 16777216,
    "maximum": 1073741824
  },
  "features": {
    "filesystem": true,
    "simd": false,
    "bulk_memory": false,
    "threads": false
  },
  "optimized_for": ["Deno", "Node.js", "Cloudflare Workers"]
}
EOF

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WASM_SIZE=$(ls -lh "$DIST_DIR/taglib_wasi.wasm" | awk '{print $5}')

echo -e "${GREEN}✅ WASI SDK build successful${NC}"
echo ""
echo "Output files:"
echo "  📦 WASM: $DIST_DIR/taglib_wasi.wasm ($WASM_SIZE)"
echo "  📝 Meta: $DIST_DIR/taglib_wasi.json"
echo ""
echo "Target environments: Deno, Node.js (WASI), Cloudflare Workers"
echo "Optimizations: Size-optimized (-Oz), stripped"