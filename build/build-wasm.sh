#!/bin/bash
set -e

echo "🔧 Building taglib-wasm..."

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
  echo "❌ Emscripten not found. Please install Emscripten SDK first:"
  echo "   https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

# Build directory
BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$BUILD_DIR")"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
OUTPUT_DIR="$BUILD_DIR"

# Create CMake build directory
CMAKE_BUILD_DIR="$BUILD_DIR/cmake-build"
mkdir -p "$CMAKE_BUILD_DIR"
cd "$CMAKE_BUILD_DIR"

echo "📦 Configuring TagLib with Emscripten..."

# Configure TagLib with CMake for Emscripten
emcmake cmake "$TAGLIB_DIR" \
  -DCMAKE_WARN_DEPRECATED=OFF \
  -DCMAKE_CXX_FLAGS="-Wno-character-conversion" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DWITH_ASF=ON \
  -DWITH_MP4=ON \
  -DWITH_ZLIB=OFF \
  -DCMAKE_INSTALL_PREFIX="$CMAKE_BUILD_DIR/install"

echo "🏗️  Building TagLib..."
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "📋 Installing TagLib..."
emmake make install

echo "🌐 Creating WASM bindings with Embind..."

# Use the Embind wrapper
cp "$BUILD_DIR/taglib_embind.cpp" "$BUILD_DIR/taglib_wasm.cpp"

echo "🔗 Compiling WASM module with Embind..."

# Compile the WASM module with Embind
emcc "$BUILD_DIR/taglib_wasm.cpp" \
  -I"$CMAKE_BUILD_DIR/install/include" \
  -I"$CMAKE_BUILD_DIR/install/include/taglib" \
  "$CMAKE_BUILD_DIR/install/lib/libtag.a" \
  "$CMAKE_BUILD_DIR/install/lib/libtag_c.a" \
  -o "$OUTPUT_DIR/taglib.js" \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createTagLibModule" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=1GB \
  -s EXPORTED_RUNTIME_METHODS='["allocate", "getValue", "setValue", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8", "ALLOC_NORMAL"]' \
  -s NO_FILESYSTEM=1 \
  -s ENVIRONMENT='web,worker,node' \
  -s EXPORT_ES6=1 \
  -s SINGLE_FILE=0 \
  -s STACK_SIZE=1MB \
  -s ASSERTIONS=0 \
  -s DISABLE_EXCEPTION_CATCHING=0 \
  -fexceptions \
  -lembind \
  --no-entry \
  -O3

echo "🔧 Applying Deno compatibility patch..."

# Patch the generated JS file for Deno compatibility
# Replace the problematic import("module") with a Deno-compatible version
sed -i.bak 's/const{createRequire}=await import("module")/const{createRequire}=await(typeof Deno!=="undefined"?import("node:module"):import("module"))/' "$OUTPUT_DIR/taglib.js"
rm "$OUTPUT_DIR/taglib.js.bak"

echo "✅ taglib-wasm build complete!"
echo "📁 Output files:"
echo "   - $OUTPUT_DIR/taglib.js"
echo "   - $OUTPUT_DIR/taglib.wasm"

# Clean up temporary files
rm -rf "$CMAKE_BUILD_DIR"
rm -f "$BUILD_DIR/taglib_wasm.cpp"

echo "🎉 Build finished successfully!"