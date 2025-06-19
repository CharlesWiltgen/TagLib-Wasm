#!/bin/bash

# Compile script for taglib-wasm Deno example

echo "🔨 Building taglib-wasm Deno executable..."
echo ""

# Option 1: Compile with embedded WASM (offline support)
if [ "$1" = "--embed" ]; then
    echo "📦 Generating embedded WASM module..."
    deno run --allow-read --allow-write ../../scripts/bundle-wasm-base64.ts
    
    echo ""
    echo "🔨 Compiling with embedded WASM..."
    USE_EMBEDDED_WASM=true deno compile \
        --allow-read \
        --allow-env \
        --output taglib-tool-embedded \
        app.ts
    
    echo "✅ Created: taglib-tool-embedded (works offline)"

# Option 2: Compile with CDN loading (smaller size)
else
    echo "🔨 Compiling with CDN loading..."
    deno compile \
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