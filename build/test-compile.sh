#!/bin/bash
# Quick test to verify C API compiles

set -e

echo "Testing C API compilation with simplified build..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/capi"

# Try to compile just the core modules with emcc
if command -v emcc &> /dev/null; then
    echo "Testing with Emscripten..."
    
    # Compile core modules
    emcc -c "$SRC_DIR/core/taglib_memory.cpp" \
        -I"$SRC_DIR" \
        -I"$PROJECT_ROOT/lib/taglib" \
        -o /tmp/taglib_memory.o \
        -std=c++17 \
        -fno-exceptions \
        -fno-rtti
    
    echo "✅ taglib_memory.cpp compiled"
    
    emcc -c "$SRC_DIR/core/taglib_error.cpp" \
        -I"$SRC_DIR" \
        -I"$PROJECT_ROOT/lib/taglib" \
        -DTAGLIB_VERSION=\"2.0.2\" \
        -o /tmp/taglib_error.o \
        -std=c++17 \
        -fno-exceptions \
        -fno-rtti
    
    echo "✅ taglib_error.cpp compiled"
    
    echo ""
    echo "Basic compilation test passed!"
else
    echo "Emscripten not found, skipping test"
fi