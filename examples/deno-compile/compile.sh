#!/bin/bash

# Compile script for TagLib-Wasm Deno example

echo "🔨 Building TagLib-Wasm Deno executable..."
echo ""

# Option 1: Compile with embedded WASM (offline support)
if [ "$1" = "--embed" ]; then
    echo "📦 Generating embedded WASM module..."
    cd ../.. && deno run --allow-read --allow-write scripts/bundle-wasm-base64.ts
    cd examples/deno-compile
    
    echo ""
    echo "🔨 Compiling with embedded WASM..."
    echo "  Including WASM file directly in binary..."
    deno compile \
        --no-check \
        --allow-read \
        --allow-env \
        --include ../../build/taglib.wasm \
        --output taglib-tool-embedded \
        app.ts
    
    echo "✅ Created: taglib-tool-embedded (works offline)"

# Option 2: Compile with CDN loading (smaller size)
else
    echo "🔨 Compiling with CDN loading..."
    deno compile \
        --no-check \
        --allow-read \
        --allow-net \
        --allow-env \
        --output taglib-tool \
        app.ts
    
    echo "✅ Created: taglib-tool (requires network)"
fi

echo ""
echo "📚 Usage:"
echo "  ./taglib-tool [audio files...]"
echo ""
echo "🎯 Examples:"
echo "  ./taglib-tool song.mp3"
echo "  ./taglib-tool *.mp3"
echo "  WASM_URL=https://my-cdn.com/taglib.wasm ./taglib-tool song.flac"