#!/bin/bash
# Build script for Phase 0 Proof-of-Concept
# Compiles minimal C API with both Emscripten and WASI SDK

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Building Phase 0 Proof-of-Concept"
echo ""

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/capi"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
BUILD_DIR="$PROJECT_ROOT/build/poc"
DIST_DIR="$PROJECT_ROOT/dist/poc"

# Source WASI environment
source "$PROJECT_ROOT/build/wasi-env.sh"

# Create directories
mkdir -p "$BUILD_DIR/emscripten"
mkdir -p "$BUILD_DIR/wasi"
mkdir -p "$DIST_DIR"

# First, we need to build TagLib static library
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Building TagLib static library"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if TagLib is already built
TAGLIB_LIB="$PROJECT_ROOT/build/taglib-build/taglib/libtag.a"
if [ ! -f "$TAGLIB_LIB" ]; then
    echo -e "${YELLOW}Building TagLib with current build system...${NC}"
    cd "$PROJECT_ROOT"
    if [ -f "build/build-wasm.sh" ]; then
        ./build/build-wasm.sh
    else
        echo -e "${RED}❌ TagLib build script not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ TagLib already built${NC}"
    echo "   Library: $TAGLIB_LIB"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Building with Emscripten"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v emcc &> /dev/null; then
    echo "Compiling C API with Emscripten..."
    
    emcc "$SRC_DIR/taglib_api.cpp" \
        "$TAGLIB_LIB" \
        -I"$TAGLIB_DIR" \
        -I"$TAGLIB_DIR/taglib" \
        -I"$TAGLIB_DIR/taglib/toolkit" \
        -I"$TAGLIB_DIR/taglib/mpeg/id3v2" \
        -I"$PROJECT_ROOT/build/taglib-build" \
        -o "$DIST_DIR/taglib_emscripten.js" \
        -s EXPORTED_FUNCTIONS='["_tl_read_tags","_tl_write_tags","_tl_free","_tl_version","_tl_get_last_error","_malloc","_free"]' \
        -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s EXPORT_NAME="createTagLibModule" \
        -s ENVIRONMENT='web,worker,node' \
        -s FILESYSTEM=1 \
        -O3 \
        -fno-exceptions \
        -DTAGLIB_VERSION=\"2.0.2\" \
        2>&1 | tee "$BUILD_DIR/emscripten/compile.log"
    
    if [ -f "$DIST_DIR/taglib_emscripten.wasm" ]; then
        EMCC_SIZE=$(ls -lh "$DIST_DIR/taglib_emscripten.wasm" | awk '{print $5}')
        echo -e "${GREEN}✅ Emscripten build successful${NC}"
        echo "   Output: $DIST_DIR/taglib_emscripten.wasm ($EMCC_SIZE)"
    else
        echo -e "${RED}❌ Emscripten build failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  emcc not found${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Building with WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$WASI_SDK_PATH" ] && [ -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo "Compiling C API with WASI SDK..."
    
    # First compile to object file
    "$WASI_SDK_PATH/bin/clang++" \
        -c "$SRC_DIR/taglib_api.cpp" \
        --target=wasm32-wasi \
        -I"$TAGLIB_DIR" \
        -I"$TAGLIB_DIR/taglib" \
        -I"$TAGLIB_DIR/taglib/toolkit" \
        -I"$TAGLIB_DIR/taglib/mpeg/id3v2" \
        -I"$PROJECT_ROOT/build/taglib-build" \
        -o "$BUILD_DIR/wasi/taglib_api.o" \
        -O3 \
        -fno-exceptions \
        -DTAGLIB_VERSION=\"2.0.2\" \
        2>&1 | tee "$BUILD_DIR/wasi/compile.log"
    
    # Then link with TagLib
    "$WASI_SDK_PATH/bin/clang++" \
        "$BUILD_DIR/wasi/taglib_api.o" \
        "$TAGLIB_LIB" \
        --target=wasm32-wasi \
        -o "$DIST_DIR/taglib_wasi.wasm" \
        -Wl,--export=tl_read_tags \
        -Wl,--export=tl_write_tags \
        -Wl,--export=tl_free \
        -Wl,--export=tl_version \
        -Wl,--export=tl_get_last_error \
        -Wl,--export=malloc \
        -Wl,--export=free \
        -Oz \
        2>&1 | tee -a "$BUILD_DIR/wasi/compile.log"
    
    if [ -f "$DIST_DIR/taglib_wasi.wasm" ]; then
        # Optimize with wasm-opt if available
        if command -v wasm-opt &> /dev/null; then
            echo "Optimizing with wasm-opt..."
            wasm-opt -Oz "$DIST_DIR/taglib_wasi.wasm" -o "$DIST_DIR/taglib_wasi.wasm"
        fi
        
        WASI_SIZE=$(ls -lh "$DIST_DIR/taglib_wasi.wasm" | awk '{print $5}')
        echo -e "${GREEN}✅ WASI SDK build successful${NC}"
        echo "   Output: $DIST_DIR/taglib_wasi.wasm ($WASI_SIZE)"
    else
        echo -e "${RED}❌ WASI SDK build failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  WASI SDK not found${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$DIST_DIR/taglib_emscripten.wasm" ]; then
    EMCC_SIZE=$(ls -lh "$DIST_DIR/taglib_emscripten.wasm" | awk '{print $5}')
    echo -e "Emscripten: ${GREEN}✅${NC} $EMCC_SIZE"
else
    echo -e "Emscripten: ${RED}❌ Failed${NC}"
fi

if [ -f "$DIST_DIR/taglib_wasi.wasm" ]; then
    WASI_SIZE=$(ls -lh "$DIST_DIR/taglib_wasi.wasm" | awk '{print $5}')
    echo -e "WASI SDK:   ${GREEN}✅${NC} $WASI_SIZE"
else
    echo -e "WASI SDK:   ${RED}❌ Failed${NC}"
fi

echo ""
echo "Output files in: $DIST_DIR"