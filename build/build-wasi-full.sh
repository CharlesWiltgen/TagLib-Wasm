#!/bin/bash
# Full WASI build script - Builds TagLib and C API for WASI target
# This creates a production-ready WASI binary with full TagLib support

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔨 Building TagLib-Wasm with WASI SDK (Full Build)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/capi"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
BUILD_DIR="$PROJECT_ROOT/build/wasi-full"
DIST_DIR="$PROJECT_ROOT/dist"
MPACK_DIR="$PROJECT_ROOT/lib/mpack"

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
mkdir -p "$BUILD_DIR/taglib-build"
mkdir -p "$BUILD_DIR/mpack"
mkdir -p "$DIST_DIR"

# ============================================================================
# Step 1: Build TagLib with WASI SDK
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Step 1: Building TagLib with WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR/taglib-build"

# Configure TagLib with CMake for WASI
# Note: Using -fwasm-exceptions for C++ exception handling
cmake "$TAGLIB_DIR" \
    -DCMAKE_TOOLCHAIN_FILE="$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake" \
    -DCMAKE_C_COMPILER="$WASI_SDK_PATH/bin/clang" \
    -DCMAKE_CXX_COMPILER="$WASI_SDK_PATH/bin/clang++" \
    -DCMAKE_SYSROOT="$WASI_SDK_PATH/share/wasi-sysroot" \
    -DCMAKE_C_FLAGS="--target=wasm32-wasi" \
    -DCMAKE_CXX_FLAGS="--target=wasm32-wasi -fexceptions" \
    -DCMAKE_WARN_DEPRECATED=OFF \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DBUILD_TESTING=OFF \
    -DBUILD_EXAMPLES=OFF \
    -DWITH_ASF=ON \
    -DWITH_MP4=ON \
    -DWITH_ZLIB=OFF \
    -DCMAKE_INSTALL_PREFIX="$BUILD_DIR/install"

echo "🏗️  Building TagLib..."
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "📋 Installing TagLib..."
make install

echo -e "${GREEN}✅ TagLib built successfully${NC}"
ls -lh "$BUILD_DIR/install/lib/libtag.a"

# ============================================================================
# Step 2: Build mpack library
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2: Building mpack library (C MessagePack)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR/mpack"

if [ ! -f "libmpack.a" ]; then
    echo "Building mpack library..."

    # Compile mpack source files
    "$WASI_SDK_PATH/bin/clang" \
        "$MPACK_DIR/src/mpack/mpack-common.c" \
        "$MPACK_DIR/src/mpack/mpack-expect.c" \
        "$MPACK_DIR/src/mpack/mpack-node.c" \
        "$MPACK_DIR/src/mpack/mpack-platform.c" \
        "$MPACK_DIR/src/mpack/mpack-reader.c" \
        "$MPACK_DIR/src/mpack/mpack-writer.c" \
        --target=wasm32-wasi \
        --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
        -I"$MPACK_DIR/src" \
        -O3 -c

    # Create static library
    "$WASI_SDK_PATH/bin/llvm-ar" rcs libmpack.a *.o

    echo -e "${GREEN}✅ mpack library built successfully${NC}"
else
    echo -e "${GREEN}✅ mpack library already present${NC}"
fi

ls -lh "$BUILD_DIR/mpack/libmpack.a"

# ============================================================================
# Step 3: Compile C API sources
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Step 3: Compiling C API sources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR"

# Include paths for TagLib
TAGLIB_INCLUDES=(
    -I"$BUILD_DIR/install/include"
    -I"$BUILD_DIR/install/include/taglib"
    -I"$TAGLIB_DIR"
    -I"$TAGLIB_DIR/taglib"
    -I"$TAGLIB_DIR/taglib/toolkit"
    -I"$TAGLIB_DIR/taglib/mpeg"
    -I"$TAGLIB_DIR/taglib/mpeg/id3v2"
    -I"$TAGLIB_DIR/taglib/flac"
    -I"$TAGLIB_DIR/taglib/mp4"
    -I"$TAGLIB_DIR/taglib/ogg"
    -I"$TAGLIB_DIR/taglib/ogg/vorbis"
    -I"$TAGLIB_DIR/taglib/riff"
    -I"$TAGLIB_DIR/taglib/riff/wav"
)

# Architecture:
# - taglib_boundary.c: Pure C exports (tl_malloc, tl_free, tl_read_tags, etc.)
# - taglib_shim.cpp: C++ shim that calls TagLib (compiled with Wasm EH)
# - taglib_msgpack.c: MessagePack encoding/decoding
# - taglib_error.cpp: Error handling

# Compile C files (no exceptions needed)
echo "Compiling C boundary files..."
"$WASI_SDK_PATH/bin/clang" \
    "$SRC_DIR/taglib_boundary.c" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -I"$SRC_DIR" -I"$MPACK_DIR/src" \
    -O3 -c -o taglib_boundary.o

"$WASI_SDK_PATH/bin/clang" \
    "$SRC_DIR/core/taglib_msgpack.c" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -I"$SRC_DIR" -I"$MPACK_DIR/src" \
    -O3 -c -o taglib_msgpack.o

# Compile exception stubs (provides __cxa_* for WASI)
"$WASI_SDK_PATH/bin/clang" \
    "$SRC_DIR/core/cxa_stubs.c" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -O3 -c -o cxa_stubs.o

# Compile C++ shim with Wasm exceptions (calls TagLib)
echo "Compiling C++ shim with Wasm EH..."
"$WASI_SDK_PATH/bin/clang++" \
    "$SRC_DIR/taglib_shim.cpp" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    "${TAGLIB_INCLUDES[@]}" \
    -I"$SRC_DIR" -I"$MPACK_DIR/src" \
    -O3 -std=c++17 -fexceptions \
    -c -o taglib_shim.o

"$WASI_SDK_PATH/bin/clang++" \
    "$SRC_DIR/core/taglib_error.cpp" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -I"$SRC_DIR" -I"$MPACK_DIR/src" \
    -O3 -std=c++17 -fexceptions \
    -c -o taglib_error.o

echo -e "${GREEN}✅ C API compiled${NC}"

# ============================================================================
# Step 4: Link everything
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Step 4: Linking final WASM module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

"$WASI_SDK_PATH/bin/clang++" \
    taglib_boundary.o \
    taglib_msgpack.o \
    cxa_stubs.o \
    taglib_shim.o \
    taglib_error.o \
    "$BUILD_DIR/install/lib/libtag.a" \
    "$BUILD_DIR/mpack/libmpack.a" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -o "$DIST_DIR/taglib-wasi.wasm" \
    -Wl,--export=tl_read_tags \
    -Wl,--export=tl_read_tags_ex \
    -Wl,--export=tl_write_tags \
    -Wl,--export=tl_free \
    -Wl,--export=tl_malloc \
    -Wl,--export=tl_version \
    -Wl,--export=tl_get_last_error \
    -Wl,--export=tl_get_last_error_code \
    -Wl,--export=tl_clear_error \
    -Wl,--export=tl_api_version \
    -Wl,--export=tl_has_capability \
    -Wl,--export=tl_detect_format \
    -Wl,--export=tl_format_name \
    -Wl,--export=malloc \
    -Wl,--export=free \
    -Wl,--export=__heap_base \
    -Wl,--export=__data_end \
    -Wl,--initial-memory=16777216 \
    -Wl,--max-memory=2147483648 \
    -O3 \
    -std=c++17 \
    -fexceptions \
    -lc++abi

# Check results
if [ ! -f "$DIST_DIR/taglib-wasi.wasm" ]; then
    echo -e "${RED}❌ WASM module build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ WASM module linked${NC}"

# ============================================================================
# Step 5: Optimize
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Step 5: Optimizing WASM module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v wasm-opt &> /dev/null; then
    echo "Optimizing with wasm-opt..."
    wasm-opt -Oz \
        --enable-bulk-memory \
        --enable-exception-handling \
        "$DIST_DIR/taglib-wasi.wasm" \
        -o "$DIST_DIR/taglib-wasi.wasm"
    echo -e "${GREEN}✅ Optimization complete${NC}"
else
    echo -e "${YELLOW}⚠️  wasm-opt not found, skipping optimization${NC}"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WASM_SIZE=$(ls -lh "$DIST_DIR/taglib-wasi.wasm" | awk '{print $5}')

echo -e "${GREEN}✅ WASI SDK full build successful${NC}"
echo ""
echo "Output files:"
echo "  📦 WASM: $DIST_DIR/taglib-wasi.wasm ($WASM_SIZE)"
echo ""
echo "Features: Full TagLib support, MessagePack API, Wasm exceptions"
echo "Target environments: Deno, Node.js (WASI), Cloudflare Workers"
