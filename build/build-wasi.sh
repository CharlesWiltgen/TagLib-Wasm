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
DIST_DIR="$PROJECT_ROOT/dist"

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

# Step 1: Stub TagLib for minimal working build
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Step 1: Creating minimal WASI binary (TagLib stubbed)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR"

# Create empty TagLib stub library
mkdir -p "taglib"
echo "Creating stub TagLib library..."
touch "taglib/stub.c"
"$WASI_SDK_PATH/bin/clang" "taglib/stub.c" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -c -o "taglib/stub.obj"
"$WASI_SDK_PATH/bin/llvm-ar" rcs "taglib/libtag.a" "taglib/stub.obj"

echo -e "${GREEN}✅ Stub TagLib library created${NC}"

# Step 1.5: Build mpack library (C MessagePack implementation)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1.5: Building mpack library (C MessagePack)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MPACK_DIR="$PROJECT_ROOT/lib/mpack"
MPACK_BUILD_DIR="$BUILD_DIR/mpack"

if [ ! -f "$MPACK_BUILD_DIR/libmpack.a" ]; then
    echo "Building mpack library..."
    mkdir -p "$MPACK_BUILD_DIR"
    cd "$MPACK_BUILD_DIR"
    
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
    ls -lh "$MPACK_BUILD_DIR/libmpack.a"
else
    echo -e "${GREEN}✅ mpack library already present${NC}"
fi

# Step 2: Link final WASM module
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Step 2: Linking final WASM module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_ROOT"

# Compile and link the C API with TagLib and MessagePack
echo "Linking C API with TagLib and MessagePack..."

# Compile C API sources - Minimal version (no memory pooling for now)
CAPI_SOURCES=(
    "$SRC_DIR/taglib_boundary.c"           # Pure C boundary (no exceptions) - WASI exports
    "$SRC_DIR/taglib_shim.cpp"            # Tiny C++ shim with Wasm EH - TagLib exception boundary  
    "$SRC_DIR/core/taglib_error.cpp"      # C++ with pure C internals - compiled with Wasm EH
    "$SRC_DIR/core/taglib_msgpack.c"      # Pure C (no exceptions) - MessagePack implementation
)

# Compile C API sources with proper flags per file type
CAPI_OBJECTS=()
for src in "${CAPI_SOURCES[@]}"; do
    obj_name="$(basename "$src" .cpp).obj"
    if [[ "$src" == *.c ]]; then
        obj_name="$(basename "$src" .c).obj"
        echo "Compiling C file: $src"
        # Compile C files - no exceptions
        "$WASI_SDK_PATH/bin/clang" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -I"$SRC_DIR" -I"$MPACK_DIR/src" \
            -O3 -c -o "$BUILD_DIR/$obj_name"
    elif [[ "$(basename "$src")" == "taglib_shim.cpp" ]]; then
        echo "Compiling C++ shim with Wasm EH: $src"
        # C++ shim - needs Wasm EH to catch TagLib exceptions
        "$WASI_SDK_PATH/bin/clang++" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -I"$SRC_DIR" \
            -I"$TAGLIB_DIR" \
            -I"$TAGLIB_DIR/taglib" \
            -I"$TAGLIB_DIR/taglib/toolkit" \
            -I"$TAGLIB_DIR/taglib/mpeg" \
            -I"$TAGLIB_DIR/taglib/mpeg/id3v2" \
            -I"$TAGLIB_DIR/taglib/flac" \
            -I"$TAGLIB_DIR/taglib/mp4" \
            -I"$TAGLIB_DIR/taglib/ogg" \
            -I"$TAGLIB_DIR/taglib/ogg/vorbis" \
            -I"$TAGLIB_DIR/taglib/ogg/opus" \
            -I"$TAGLIB_DIR/taglib/riff" \
            -I"$TAGLIB_DIR/taglib/riff/wav" \
            -I"$TAGLIB_DIR/taglib/riff/aiff" \
            -I"$BUILD_DIR/taglib" \
            -I"$MPACK_DIR/src" \
            -O3 -std=c++17 -fwasm-exceptions \
            -c -o "$BUILD_DIR/$obj_name"
    else
        echo "Compiling C++ support file with Wasm EH: $src"  
        # C++ support files - use Wasm EH for std::string compatibility
        "$WASI_SDK_PATH/bin/clang++" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -I"$SRC_DIR" \
            -I"$MPACK_DIR/src" \
            -O3 -std=c++17 -fwasm-exceptions \
            -c -o "$BUILD_DIR/$obj_name"
    fi
    CAPI_OBJECTS+=("$BUILD_DIR/$obj_name")
done

# Link everything together with Wasm EH support for TagLib
"$WASI_SDK_PATH/bin/clang++" "${CAPI_OBJECTS[@]}" \
    "$BUILD_DIR/taglib/libtag.a" \
    "$MPACK_BUILD_DIR/libmpack.a" \
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
    -DTAGLIB_VERSION=\"2.0.2\" \
    -O3 \
    -std=c++17 \
    -fwasm-exceptions

# Check results
if [ ! -f "$DIST_DIR/taglib-wasi.wasm" ]; then
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
        "$DIST_DIR/taglib-wasi.wasm" \
        -o "$DIST_DIR/taglib-wasi.wasm"
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
    wasm-strip "$DIST_DIR/taglib-wasi.wasm"
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

cat > "$DIST_DIR/taglib-wasi.json" << EOF
{
  "name": "taglib-wasi",
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

WASM_SIZE=$(ls -lh "$DIST_DIR/taglib-wasi.wasm" | awk '{print $5}')

echo -e "${GREEN}✅ WASI SDK build successful${NC}"
echo ""
echo "Output files:"
echo "  📦 WASM: $DIST_DIR/taglib-wasi.wasm ($WASM_SIZE)"
echo "  📝 Meta: $DIST_DIR/taglib-wasi.json"
echo ""
echo "Target environments: Deno, Node.js (WASI), Cloudflare Workers"
echo "Optimizations: Size-optimized (-Oz), stripped"