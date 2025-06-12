#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building TagLib WebAssembly module with Embind...${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
BUILD_DIR="$SCRIPT_DIR"
TAGLIB_DIR="$PROJECT_DIR/lib/taglib"

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Error: Emscripten (emcc) not found in PATH${NC}"
    echo "Please install Emscripten and activate it:"
    echo "  source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

echo -e "${YELLOW}Using Emscripten:${NC}"
emcc --version | head -n 1

# Create build directory for TagLib
TAGLIB_BUILD_DIR="$BUILD_DIR/taglib-build"
mkdir -p "$TAGLIB_BUILD_DIR"

# Configure and build TagLib with CMake
echo -e "${GREEN}Configuring TagLib with CMake...${NC}"
cd "$TAGLIB_BUILD_DIR"

emcmake cmake "$TAGLIB_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_STATIC_RUNTIME=ON \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_BINDINGS=OFF \
    -DWITH_ZLIB=OFF \
    -DCMAKE_CXX_FLAGS="-O3 -fexceptions" \
    -DCMAKE_C_FLAGS="-O3"

echo -e "${GREEN}Building TagLib...${NC}"
emmake make -j$(nproc)

# Build the WebAssembly module with Embind wrapper
echo -e "${GREEN}Building WASM module with Embind...${NC}"
cd "$BUILD_DIR"

# Compile the Embind wrapper
emcc "$BUILD_DIR/taglib_embind.cpp" \
    "$TAGLIB_BUILD_DIR/taglib/libtag.a" \
    -I"$TAGLIB_DIR" \
    -I"$TAGLIB_DIR/taglib" \
    -I"$TAGLIB_DIR/taglib/toolkit" \
    -I"$TAGLIB_DIR/taglib/mpeg" \
    -I"$TAGLIB_DIR/taglib/mpeg/id3v2" \
    -I"$TAGLIB_DIR/taglib/mpeg/id3v1" \
    -I"$TAGLIB_DIR/taglib/mp4" \
    -I"$TAGLIB_DIR/taglib/ogg" \
    -I"$TAGLIB_DIR/taglib/ogg/vorbis" \
    -I"$TAGLIB_DIR/taglib/ogg/opus" \
    -I"$TAGLIB_DIR/taglib/flac" \
    -I"$TAGLIB_DIR/taglib/riff" \
    -I"$TAGLIB_DIR/taglib/riff/wav" \
    -I"$TAGLIB_DIR/taglib/riff/aiff" \
    -I"$TAGLIB_BUILD_DIR" \
    -o taglib.js \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createTagLibModule" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MAXIMUM_MEMORY=1GB \
    -s EXPORTED_RUNTIME_METHODS='["allocate", "getValue", "setValue", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
    -s NO_FILESYSTEM=1 \
    -s ENVIRONMENT='web,webview,worker,node' \
    -s EXPORT_ES6=0 \
    -s SINGLE_FILE=0 \
    -s STACK_SIZE=1MB \
    -s ASSERTIONS=0 \
    -s DISABLE_EXCEPTION_CATCHING=0 \
    -fexceptions \
    -lembind \
    --no-entry

# Optimize the generated WASM file
if command -v wasm-opt &> /dev/null; then
    echo -e "${GREEN}Optimizing WASM with wasm-opt...${NC}"
    wasm-opt -O3 taglib.wasm -o taglib.wasm
fi

# Print results
echo -e "${GREEN}Build complete!${NC}"
echo -e "${YELLOW}Generated files:${NC}"
ls -lh taglib.js taglib.wasm

# Show file sizes
echo -e "${YELLOW}File sizes:${NC}"
echo -n "JavaScript: "
ls -lh taglib.js | awk '{print $5}'
echo -n "WebAssembly: "
ls -lh taglib.wasm | awk '{print $5}'

echo -e "${GREEN}✓ taglib-wasm module built successfully with Embind!${NC}"