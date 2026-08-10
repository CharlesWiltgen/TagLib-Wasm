#!/bin/bash
set -e

echo "🔧 Building TagLib-Wasm..."

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
  echo "❌ Emscripten not found. Please install Emscripten SDK first:"
  echo "   https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

# Pin Binaryen to Emscripten's own vendored wasm-opt. emcc otherwise falls back
# to `shutil.which('wasm-opt')` on PATH (the version check is a warning, not an
# error), so a stray/unpinned wasm-opt (e.g. from `npm install -g wasm-opt`)
# can minify the wasm's import module names inconsistently with the generated
# glue — shipping a wasm that imports "./a" while the glue provides {a:...},
# which fails to instantiate. This was the root cause of the 1.4.1 Deno
# regression (taglib-*). The consistency guard below enforces it.
BINARYEN_ROOT="$(em-config BINARYEN_ROOT 2>/dev/null || true)"
if [ -z "$BINARYEN_ROOT" ] || [ ! -x "$BINARYEN_ROOT/bin/wasm-opt" ]; then
  # Fallback: derive from emcc's location (emsdk layout is
  # .../upstream/emscripten/emcc with binaryen at .../upstream/bin).
  EMCC_REAL="$(readlink -f "$(command -v emcc)" 2>/dev/null || command -v emcc)"
  CAND="$(dirname "$(dirname "$EMCC_REAL")")"
  [ -x "$CAND/bin/wasm-opt" ] && BINARYEN_ROOT="$CAND"
fi
if [ -n "$BINARYEN_ROOT" ] && [ -x "$BINARYEN_ROOT/bin/wasm-opt" ]; then
  export BINARYEN_ROOT
  echo "🧩 Pinned BINARYEN_ROOT=$BINARYEN_ROOT ($("$BINARYEN_ROOT/bin/wasm-opt" --version 2>/dev/null))"
else
  echo "⚠️  Could not pin BINARYEN_ROOT; the consistency guard below is the backstop."
fi

# Build directory
BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$BUILD_DIR")"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
OUTPUT_DIR="$BUILD_DIR"

# Create CMake build directory (clean rebuild to ensure flag changes take effect)
CMAKE_BUILD_DIR="$BUILD_DIR/cmake-build"
rm -rf "$CMAKE_BUILD_DIR"
mkdir -p "$CMAKE_BUILD_DIR"
cd "$CMAKE_BUILD_DIR"

echo "📦 Configuring TagLib with Emscripten..."

# Configure TagLib with CMake for Emscripten.
# NOTE: -fwasm-exceptions must match the final emcc link below (and the WASI
# build). Mixing Wasm EH with the legacy JS exception model across objects
# breaks linkage, so TagLib and the shim must be compiled the same way.
emcmake cmake "$TAGLIB_DIR" \
  -DCMAKE_WARN_DEPRECATED=OFF \
  -DCMAKE_CXX_FLAGS="-Wno-character-conversion -frtti -sUSE_ZLIB=1 -fwasm-exceptions" \
  -DCMAKE_C_FLAGS="-sUSE_ZLIB=1 -fwasm-exceptions" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DWITH_ASF=ON \
  -DWITH_MP4=ON \
  -DWITH_ZLIB=ON \
  -DCMAKE_INSTALL_PREFIX="$CMAKE_BUILD_DIR/install"

echo "🏗️  Building TagLib..."
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "📋 Installing TagLib..."
emmake make install

echo "🌐 Creating Wasm bindings with Embind..."

# Use the Embind wrapper
cp "$BUILD_DIR/taglib_embind.cpp" "$BUILD_DIR/taglib_wasm.cpp"

echo "🔗 Compiling Wasm module with Embind..."

# Compile the Wasm module with Embind.
# DEFAULT_TO_CXX: Emscripten >= 6.0.4 tightened the C++ runtime default for
# emcc on .cpp inputs (wasm-ld: undefined symbol: operator new); opt in
# explicitly so old and new toolchains link C++ deterministically.
# NOTE: Emscripten 6.0.2 dropped wasmBinary from the default INCOMING_MODULE_JS_API.
# The runtime loaders (src/runtime/module-loader.ts, module-loader-browser.ts,
# unified-loader/module-loading.ts) pass moduleConfig.wasmBinary and locateFile into
# createTagLibModule(), so both must be re-listed below or the provided bytes are
# silently ignored (ASSERTIONS=0 means no debug warning).
emcc "$BUILD_DIR/taglib_wasm.cpp" \
  "$PROJECT_ROOT/src/capi/formats/taglib_lame.cpp" \
  -I"$PROJECT_ROOT/src/capi/formats" \
  -I"$CMAKE_BUILD_DIR/install/include" \
  -I"$CMAKE_BUILD_DIR/install/include/taglib" \
  "$CMAKE_BUILD_DIR/install/lib/libtag.a" \
  "$CMAKE_BUILD_DIR/install/lib/libtag_c.a" \
  -o "$OUTPUT_DIR/taglib-wrapper.js" \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s DEFAULT_TO_CXX=1 \
  -s EXPORT_NAME="createTagLibModule" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=4GB \
  -s EXPORTED_RUNTIME_METHODS='["getValue", "setValue", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
  -s NO_FILESYSTEM=1 \
  -s INCOMING_MODULE_JS_API=wasmBinary,locateFile \
  -s ENVIRONMENT='web,worker,node' \
  -s EXPORT_ES6=1 \
  -s SINGLE_FILE=0 \
  -s STACK_SIZE=1MB \
  -s ASSERTIONS=0 \
  -fwasm-exceptions \
  -frtti \
  -lembind \
  -sUSE_ZLIB=1 \
  --no-entry \
  -O3

echo "🔧 Applying Deno compatibility patches..."

# Apply comprehensive Deno compatibility fixes
node "$PROJECT_ROOT/scripts/fix-deno-compat.js"

# Rename the WASM file to taglib-web.wasm
mv "$OUTPUT_DIR/taglib-wrapper.wasm" "$OUTPUT_DIR/taglib-web.wasm"

# Update the JS file to reference taglib-web.wasm instead of taglib-wrapper.wasm
sed -i.bak 's/taglib-wrapper\.wasm/taglib-web.wasm/g' "$OUTPUT_DIR/taglib-wrapper.js"
rm "$OUTPUT_DIR/taglib-wrapper.js.bak"

# ── Build-time consistency guard (do NOT remove) ──────────────────────────
# Validates that the freshly-built wasm's (minified) import MODULE name matches
# the glue's import-object key, so a build-time skew (e.g. a stray wasm-opt) that
# desyncs them can't ship. NOTE: this cannot catch Deno's *publish-time* wasm
# unfurl (deno publish >= 2.8.2 rewrites the published wasm's import names) — that
# is handled by the "./"-aliased import objects (fix-deno-compat.js,
# wasi-host-loader.ts) plus the post-publish smoke test in publish-everywhere.yml.
WASM_DIS="${BINARYEN_ROOT:+$BINARYEN_ROOT/bin/wasm-dis}"
[ -x "$WASM_DIS" ] || WASM_DIS="wasm-dis"
WASM_IMPORT_MODULE="$("$WASM_DIS" "$OUTPUT_DIR/taglib-web.wasm" 2>/dev/null \
  | grep -m1 -oE '\(import "[^"]+"' | sed 's/(import "//; s/"$//')"
# Match the first import-object key (glue may now alias it as {a:...,"./a":...}).
GLUE_IMPORT_KEY="$(grep -oE 'var imports=\{[A-Za-z_]+:wasmImports' "$OUTPUT_DIR/taglib-wrapper.js" \
  | grep -m1 -oE '\{[A-Za-z_]+:' | tr -d '{:')"
if [ -z "$WASM_IMPORT_MODULE" ] || [ -z "$GLUE_IMPORT_KEY" ]; then
  echo "❌ Build guard: could not extract import module names" \
       "(wasm='$WASM_IMPORT_MODULE' glue='$GLUE_IMPORT_KEY')"
  exit 1
fi
if [ "$WASM_IMPORT_MODULE" != "$GLUE_IMPORT_KEY" ]; then
  echo "❌ Build guard FAILED: wasm import module '$WASM_IMPORT_MODULE'" \
       "!= glue import key '$GLUE_IMPORT_KEY'"
  echo "   A skewed wasm-opt minified the wasm inconsistently with the glue;" \
       "the module would not instantiate. Aborting."
  exit 1
fi
echo "✅ Build guard: wasm/glue import module consistent ('$WASM_IMPORT_MODULE')"

echo "✅ TagLib-Wasm build complete!"
echo "📁 Output files:"
echo "   - $OUTPUT_DIR/taglib-wrapper.js"
echo "   - $OUTPUT_DIR/taglib-web.wasm"

# Clean up temporary files
rm -rf "$CMAKE_BUILD_DIR"
rm -f "$BUILD_DIR/taglib_wasm.cpp"

echo "🎉 Build finished successfully!"