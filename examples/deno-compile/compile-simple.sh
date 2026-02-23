#!/bin/bash

echo "🔨 Compiling simple TagLib-Wasm example..."
echo ""

# Compile with CDN loading support
deno compile \
    --no-check \
    --allow-read \
    --allow-net \
    --output taglib-simple \
    simple-app.ts

echo "✅ Created: taglib-simple"
echo ""
echo "📚 Usage:"
echo "  ./taglib-simple                    # Test with demo data"
echo "  ./taglib-simple song.mp3           # Read tags from file"
echo "  ./taglib-simple *.mp3              # Read tags from multiple files"
echo ""
echo "Note: This version loads WASM from CDN and requires internet access."