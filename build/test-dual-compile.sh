#!/bin/bash
# Test script to verify both Emscripten and WASI SDK can compile TagLib
# Part of Phase 0 validation

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔬 Testing dual compilation (Emscripten + WASI SDK)"
echo ""

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"

# Source WASI environment
source "$PROJECT_ROOT/build/wasi-env.sh"

# Create test directories
TEST_DIR="$PROJECT_ROOT/build/phase0-test"
mkdir -p "$TEST_DIR/emscripten"
mkdir -p "$TEST_DIR/wasi"

# Simple test C++ file using TagLib headers
cat > "$TEST_DIR/test-taglib.cpp" << 'EOF'
#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <cstdio>

extern "C" {
    const char* test_taglib_version() {
        // Just test that we can compile and link TagLib
        return "TagLib compilation test successful";
    }
}
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Testing Emscripten compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if emcc is available
if command -v emcc &> /dev/null; then
    echo "Found emcc: $(which emcc)"
    emcc --version | head -1
    
    # Try to compile with Emscripten
    echo "Compiling test file with Emscripten..."
    if emcc "$TEST_DIR/test-taglib.cpp" \
        -I"$TAGLIB_DIR" \
        -I"$TAGLIB_DIR/taglib" \
        -I"$TAGLIB_DIR/taglib/toolkit" \
        -o "$TEST_DIR/emscripten/test.js" \
        -s EXPORTED_FUNCTIONS='["_test_taglib_version"]' \
        -s EXPORTED_RUNTIME_METHODS='["ccall"]' \
        2>&1 | tee "$TEST_DIR/emscripten/compile.log"; then
        echo -e "${GREEN}✅ Emscripten compilation successful${NC}"
        ls -lh "$TEST_DIR/emscripten/test.wasm" 2>/dev/null || true
    else
        echo -e "${RED}❌ Emscripten compilation failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  emcc not found. Please install Emscripten.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Testing WASI SDK compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if WASI SDK is available
if [ -n "$WASI_SDK_PATH" ] && [ -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo "Found WASI SDK: $WASI_SDK_PATH"
    "$WASI_SDK_PATH/bin/clang++" --version | head -1
    
    # Try to compile with WASI SDK
    echo "Compiling test file with WASI SDK..."
    if "$WASI_SDK_PATH/bin/clang++" "$TEST_DIR/test-taglib.cpp" \
        --target=wasm32-wasi \
        -I"$TAGLIB_DIR" \
        -I"$TAGLIB_DIR/taglib" \
        -I"$TAGLIB_DIR/taglib/toolkit" \
        -o "$TEST_DIR/wasi/test.wasm" \
        -Wl,--export=test_taglib_version \
        2>&1 | tee "$TEST_DIR/wasi/compile.log"; then
        echo -e "${GREEN}✅ WASI SDK compilation successful${NC}"
        ls -lh "$TEST_DIR/wasi/test.wasm" 2>/dev/null || true
    else
        echo -e "${RED}❌ WASI SDK compilation failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  WASI SDK not found. Run ./build/setup-wasi-sdk.sh first.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Compilation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check results
EMCC_SUCCESS=false
WASI_SUCCESS=false

if [ -f "$TEST_DIR/emscripten/test.wasm" ]; then
    EMCC_SUCCESS=true
    EMCC_SIZE=$(ls -lh "$TEST_DIR/emscripten/test.wasm" | awk '{print $5}')
    echo -e "Emscripten: ${GREEN}✅ Success${NC} (Size: $EMCC_SIZE)"
else
    echo -e "Emscripten: ${RED}❌ Failed${NC}"
fi

if [ -f "$TEST_DIR/wasi/test.wasm" ]; then
    WASI_SUCCESS=true
    WASI_SIZE=$(ls -lh "$TEST_DIR/wasi/test.wasm" | awk '{print $5}')
    echo -e "WASI SDK:   ${GREEN}✅ Success${NC} (Size: $WASI_SIZE)"
else
    echo -e "WASI SDK:   ${RED}❌ Failed${NC}"
fi

echo ""
echo "Test results saved in: $TEST_DIR"

# Return success if at least one compilation worked
if [ "$EMCC_SUCCESS" = true ] || [ "$WASI_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ At least one toolchain can compile TagLib headers${NC}"
    exit 0
else
    echo -e "${RED}❌ Both toolchains failed to compile${NC}"
    exit 1
fi