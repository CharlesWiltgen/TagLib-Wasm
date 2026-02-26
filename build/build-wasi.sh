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

# Step 0.5: Build zlib for WASI (needed for compressed ID3v2 frames)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 0.5: Building zlib for WASI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ZLIB_VERSION="1.3.2"
ZLIB_BUILD_DIR="$BUILD_DIR/zlib"

if [ ! -f "$ZLIB_BUILD_DIR/libz.a" ]; then
    ZLIB_SRC_DIR="$BUILD_DIR/zlib-src"
    if [ ! -f "$ZLIB_SRC_DIR/CMakeLists.txt" ]; then
        rm -rf "$ZLIB_SRC_DIR"
        echo "Downloading zlib $ZLIB_VERSION..."
        curl -sfL "https://zlib.net/zlib-${ZLIB_VERSION}.tar.gz" -o "$BUILD_DIR/zlib.tar.gz" \
            || curl -sfL "https://github.com/madler/zlib/releases/download/v${ZLIB_VERSION}/zlib-${ZLIB_VERSION}.tar.gz" -o "$BUILD_DIR/zlib.tar.gz"
        tar xzf "$BUILD_DIR/zlib.tar.gz" -C "$BUILD_DIR"
        mv "$BUILD_DIR/zlib-${ZLIB_VERSION}" "$ZLIB_SRC_DIR"
        rm -f "$BUILD_DIR/zlib.tar.gz"
    fi

    echo "Building zlib for wasm32-wasi..."
    mkdir -p "$ZLIB_BUILD_DIR"

    # Compile core zlib sources directly (no configure/cmake needed).
    # gz* files excluded — they use lseek which WASI doesn't provide.
    # TagLib only needs inflate/deflate for compressed ID3v2 frames.
    ZLIB_SRCS="adler32 compress crc32 deflate infback inffast inflate inftrees trees uncompr zutil"
    for src in $ZLIB_SRCS; do
        "$WASI_SDK_PATH/bin/clang" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -O3 -fwasm-exceptions \
            -I"$ZLIB_SRC_DIR" \
            -c -o "$ZLIB_BUILD_DIR/$src.o" "$ZLIB_SRC_DIR/$src.c"
    done
    "$WASI_SDK_PATH/bin/llvm-ar" rcs "$ZLIB_BUILD_DIR/libz.a" "$ZLIB_BUILD_DIR"/*.o
    cp "$ZLIB_SRC_DIR/zlib.h" "$ZLIB_SRC_DIR/zconf.h" "$ZLIB_BUILD_DIR/"

    echo -e "${GREEN}✅ zlib built successfully${NC}"
    ls -lh "$ZLIB_BUILD_DIR/libz.a"
else
    echo -e "${GREEN}✅ zlib already present${NC}"
fi

# Step 1: Build TagLib with WASI SDK
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Step 1: Building TagLib with WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BUILD_DIR/taglib"

# Clear stale cmake cache (CI cache may contain paths from a different SDK version)
rm -f CMakeCache.txt

# Configure TagLib with CMake for WASI
echo "Configuring TagLib with CMake for WASI..."

# Use WASI SDK compilers directly (more portable across SDK versions)
cmake "$TAGLIB_DIR" \
    -DCMAKE_SYSTEM_NAME=WASI \
    -DCMAKE_SYSTEM_VERSION=1 \
    -DCMAKE_SYSTEM_PROCESSOR=wasm32 \
    -DCMAKE_C_COMPILER="$WASI_SDK_PATH/bin/clang" \
    -DCMAKE_CXX_COMPILER="$WASI_SDK_PATH/bin/clang++" \
    -DCMAKE_AR="$WASI_SDK_PATH/bin/llvm-ar" \
    -DCMAKE_RANLIB="$WASI_SDK_PATH/bin/llvm-ranlib" \
    -DCMAKE_C_COMPILER_TARGET=wasm32-wasi \
    -DCMAKE_CXX_COMPILER_TARGET=wasm32-wasi \
    -DCMAKE_SYSROOT="$WASI_SDK_PATH/share/wasi-sysroot" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_STATIC=ON \
    -DWITH_MP4=ON \
    -DWITH_ASF=ON \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_TESTS=OFF \
    -DBUILD_BINDINGS=OFF \
    -DWITH_ZLIB=ON \
    -DZLIB_LIBRARY="$BUILD_DIR/zlib/libz.a" \
    -DZLIB_INCLUDE_DIR="$BUILD_DIR/zlib" \
    -DCMAKE_CXX_FLAGS="-O3 -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false" \
    -DCMAKE_C_FLAGS="-O3"

# Build TagLib
echo "Building TagLib..."
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

if [ ! -f "$BUILD_DIR/taglib/taglib/libtag.a" ]; then
    echo -e "${RED}❌ TagLib build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TagLib built successfully${NC}"
ls -lh "$BUILD_DIR/taglib/taglib/libtag.a"

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
        -O3 -fwasm-exceptions -c

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
    "$SRC_DIR/taglib_pictures.cpp"        # C++ picture encode/decode via complexProperties
    "$SRC_DIR/taglib_ratings.cpp"         # C++ rating encode/decode via format-specific APIs
    "$SRC_DIR/taglib_lyrics.cpp"          # C++ lyrics encode/decode via complexProperties
    "$SRC_DIR/taglib_chapters.cpp"        # C++ chapter encode/decode via ID3v2 CHAP frames
    "$SRC_DIR/taglib_audio_props.cpp"     # C++ extended audio properties via dynamic_cast
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
        # Compile C files with -fwasm-exceptions for feature flag consistency
        "$WASI_SDK_PATH/bin/clang" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -I"$SRC_DIR" -I"$MPACK_DIR/src" \
            -O3 -fwasm-exceptions -c -o "$BUILD_DIR/$obj_name"
    elif [[ "$(basename "$src")" == "taglib_shim.cpp" ]] || \
         [[ "$(basename "$src")" == "taglib_pictures.cpp" ]] || \
         [[ "$(basename "$src")" == "taglib_ratings.cpp" ]] || \
         [[ "$(basename "$src")" == "taglib_lyrics.cpp" ]] || \
         [[ "$(basename "$src")" == "taglib_chapters.cpp" ]] || \
         [[ "$(basename "$src")" == "taglib_audio_props.cpp" ]]; then
        echo "Compiling C++ with TagLib headers + Wasm EH: $src"
        # Collect all TagLib subdirectories for include paths
        TAGLIB_INCLUDES=(-I"$SRC_DIR" -I"$TAGLIB_DIR" -I"$TAGLIB_DIR/taglib" -I"$TAGLIB_DIR/taglib/toolkit" -I"$BUILD_DIR/taglib" -I"$MPACK_DIR/src")
        while IFS= read -r d; do
            TAGLIB_INCLUDES+=(-I"$d")
        done < <(find "$TAGLIB_DIR/taglib" -type d)
        "$WASI_SDK_PATH/bin/clang++" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            "${TAGLIB_INCLUDES[@]}" \
            -O3 -std=c++17 -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false \
            -c -o "$BUILD_DIR/$obj_name"
    else
        echo "Compiling C++ support file with Wasm EH: $src"
        # C++ support files - use Wasm EH for std::string compatibility
        "$WASI_SDK_PATH/bin/clang++" "$src" \
            --target=wasm32-wasi \
            --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
            -I"$SRC_DIR" \
            -I"$MPACK_DIR/src" \
            -O3 -std=c++17 -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false \
            -c -o "$BUILD_DIR/$obj_name"
    fi
    CAPI_OBJECTS+=("$BUILD_DIR/$obj_name")
done

# Link everything together with Wasm EH support for TagLib
"$WASI_SDK_PATH/bin/clang++" "${CAPI_OBJECTS[@]}" \
    "$BUILD_DIR/taglib/taglib/libtag.a" \
    "$MPACK_BUILD_DIR/libmpack.a" \
    "$ZLIB_BUILD_DIR/libz.a" \
    --target=wasm32-wasi \
    --sysroot="$WASI_SDK_PATH/share/wasi-sysroot" \
    -mexec-model=reactor \
    -o "$DIST_DIR/taglib_wasi.wasm" \
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
    -DTAGLIB_VERSION=\"2.1.1\" \
    -O3 \
    -std=c++17 \
    -fwasm-exceptions \
    -mllvm -wasm-use-legacy-eh=false \
    -lunwind

# Check results
if [ ! -f "$DIST_DIR/taglib_wasi.wasm" ]; then
    echo -e "${RED}❌ WASM module build failed${NC}"
    exit 1
fi

# Step 3: Optimize with wasm-opt
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Step 3: Optimizing WASM modules"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v wasm-opt &> /dev/null; then
    echo "Optimizing with wasm-opt..."
    wasm-opt -Oz \
        --enable-bulk-memory \
        --enable-exception-handling \
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
  "name": "taglib-wasi",
  "version": "3.0.0",
  "target": "wasm32-wasi",
  "exports": [
    "tl_read_tags",
    "tl_read_tags_ex",
    "tl_write_tags",
    "tl_free",
    "tl_malloc",
    "tl_version",
    "tl_get_last_error",
    "tl_get_last_error_code",
    "tl_clear_error",
    "tl_api_version",
    "tl_has_capability",
    "tl_detect_format",
    "tl_format_name",
    "malloc",
    "free"
  ],
  "memory": {
    "initial": 16777216,
    "maximum": 2147483648
  },
  "features": {
    "filesystem": true,
    "bulk_memory": true,
    "exception_handling": true,
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

# Copy WASI binary to build/ for JSR publishing
cp "$DIST_DIR/taglib_wasi.wasm" "$PROJECT_ROOT/build/taglib_wasi.wasm"
echo ""
echo "Published copy: build/taglib_wasi.wasm"
