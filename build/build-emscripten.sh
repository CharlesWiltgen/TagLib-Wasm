#!/bin/bash
# Phase 1: Build script for Emscripten toolchain
# Compiles TagLib and C API for browser/Node environments

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔨 Building TagLib-Wasm with Emscripten"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/capi"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
BUILD_DIR="$PROJECT_ROOT/build/emscripten"
DIST_DIR="$PROJECT_ROOT/dist/browser"

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}❌ emcc not found. Please install Emscripten.${NC}"
    echo "Visit: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

echo "Found emcc: $(which emcc)"
emcc --version | head -1

# Create build directories
mkdir -p "$BUILD_DIR/taglib"
mkdir -p "$DIST_DIR"

# Step 1: Configure TagLib with Emscripten
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Step 1: Building TagLib with Emscripten"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR/taglib"

# Configure TagLib with CMake for Emscripten
echo "Configuring TagLib with CMake..."
emcmake cmake "$TAGLIB_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_STATIC=ON \
    -DWITH_MP4=ON \
    -DWITH_ASF=ON \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_TESTS=OFF \
    -DBUILD_BINDINGS=OFF \
    -DCMAKE_CXX_FLAGS="-O3" \
    -DCMAKE_C_FLAGS="-O3"

# Build TagLib
echo "Building TagLib..."
emmake make -j$(nproc)

if [ ! -f "$BUILD_DIR/taglib/taglib/libtag.a" ]; then
    echo -e "${RED}❌ TagLib build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TagLib built successfully${NC}"
ls -lh "$BUILD_DIR/taglib/taglib/libtag.a"

# Step 1.5: Verify MessagePack headers (git submodule)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1.5: Verifying MessagePack headers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MSGPACK_DIR="$PROJECT_ROOT/lib/msgpack"
if [ ! -f "$MSGPACK_DIR/include/msgpack.hpp" ]; then
    echo -e "${RED}❌ MessagePack headers not found.${NC}"
    echo "Please run: git submodule update --init --recursive"
    exit 1
fi
echo -e "${GREEN}✅ MessagePack headers found${NC}"

# Step 1.6: Build mpack library for Emscripten
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1.6: Building mpack library"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MPACK_DIR="$PROJECT_ROOT/lib/mpack"
MPACK_BUILD_DIR="$BUILD_DIR/mpack"

if [ ! -f "$MPACK_BUILD_DIR/libmpack.a" ]; then
    echo "Building mpack library with Emscripten..."
    mkdir -p "$MPACK_BUILD_DIR"
    cd "$MPACK_BUILD_DIR"

    # Compile mpack source files
    emcc \
        "$MPACK_DIR/src/mpack/mpack-common.c" \
        "$MPACK_DIR/src/mpack/mpack-expect.c" \
        "$MPACK_DIR/src/mpack/mpack-node.c" \
        "$MPACK_DIR/src/mpack/mpack-platform.c" \
        "$MPACK_DIR/src/mpack/mpack-reader.c" \
        "$MPACK_DIR/src/mpack/mpack-writer.c" \
        -I"$MPACK_DIR/src" \
        -O3 -c

    # Create static library
    emar rcs libmpack.a *.o

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

# Compile all C API source files (C++ and C)
CAPI_SOURCES=(
    "$SRC_DIR/taglib_api.cpp"
    "$SRC_DIR/core/taglib_memory.cpp"
    "$SRC_DIR/core/taglib_error.cpp"
    "$SRC_DIR/core/taglib_msgpack.c"
    "$SRC_DIR/io/taglib_stream.cpp"
    "$SRC_DIR/io/taglib_buffer.cpp"
    "$SRC_DIR/formats/taglib_mp3.cpp"
    "$SRC_DIR/formats/taglib_flac.cpp"
    "$SRC_DIR/formats/taglib_m4a.cpp"
)

emcc "${CAPI_SOURCES[@]}" \
    "$BUILD_DIR/taglib/taglib/libtag.a" \
    "$MPACK_BUILD_DIR/libmpack.a" \
    -I"$SRC_DIR" \
    -I"$MPACK_DIR/src" \
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
    -I"$PROJECT_ROOT/lib/msgpack/include" \
    -DMSGPACK_NO_BOOST=1 \
    -DMSGPACK_ENDIAN_LITTLE_BYTE=1 \
    -DMSGPACK_ENDIAN_BIG_BYTE=0 \
    -o "$DIST_DIR/taglib_emscripten.js" \
    -s EXPORTED_FUNCTIONS='["_tl_read_tags","_tl_read_tags_ex","_tl_write_tags","_tl_free","_tl_malloc","_tl_version","_tl_get_last_error","_tl_get_last_error_code","_tl_clear_error","_tl_api_version","_tl_has_capability","_tl_detect_format","_tl_format_name","_tl_read_tags_json","_tl_stream_open","_tl_stream_read_metadata","_tl_stream_read_artwork","_tl_stream_close","_tl_read_mp3","_tl_write_mp3","_tl_read_flac","_tl_write_flac","_tl_read_m4a","_tl_write_m4a","_tl_pool_create","_tl_pool_alloc","_tl_pool_reset","_tl_pool_destroy","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8","allocate","ALLOC_NORMAL","getValue","setValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="createTagLibModule" \
    -s ENVIRONMENT='web,worker,node' \
    -s FILESYSTEM=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=2GB \
    -s STACK_SIZE=1MB \
    -DTAGLIB_VERSION=\"2.0.2\" \
    -O3 \
    -std=c++17

# Check results
if [ ! -f "$DIST_DIR/taglib_emscripten.wasm" ]; then
    echo -e "${RED}❌ WASM module build failed${NC}"
    exit 1
fi

# Generate TypeScript definitions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Step 3: Generating TypeScript definitions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > "$DIST_DIR/taglib_emscripten.d.ts" << 'EOF'
export interface TagLibEmscriptenModule {
  _tl_read_tags(path: number, buf: number, len: number): number;
  _tl_write_tags(path: number, buf: number, len: number, json: number, outBuf: number, outLen: number): number;
  _tl_free(ptr: number): void;
  _tl_version(): number;
  _tl_get_last_error(): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  
  ccall: (ident: string, returnType: string | null, argTypes: string[], args: any[]) => any;
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => Function;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, outPtr: number, maxBytes: number) => void;
  lengthBytesUTF8: (str: string) => number;
  allocate: (size: number, type: string) => number;
  ALLOC_NORMAL: string;
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
}

declare const createTagLibModule: () => Promise<TagLibEmscriptenModule>;
export default createTagLibModule;
EOF

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WASM_SIZE=$(ls -lh "$DIST_DIR/taglib_emscripten.wasm" | awk '{print $5}')
JS_SIZE=$(ls -lh "$DIST_DIR/taglib_emscripten.js" | awk '{print $5}')

echo -e "${GREEN}✅ Emscripten build successful${NC}"
echo ""
echo "Output files:"
echo "  📦 WASM: $DIST_DIR/taglib_emscripten.wasm ($WASM_SIZE)"
echo "  📜 JS:   $DIST_DIR/taglib_emscripten.js ($JS_SIZE)"
echo "  📝 TS:   $DIST_DIR/taglib_emscripten.d.ts"
echo ""
echo "Target environments: Browser, Web Worker, Node.js"