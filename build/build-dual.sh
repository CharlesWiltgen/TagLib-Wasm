#!/bin/bash
# Phase 1: Master build script for dual-build architecture
# Builds both Emscripten and WASI versions

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "🚀 TagLib-Wasm Dual Build System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Building for both Emscripten and WASI SDK targets"
echo ""

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
SKIP_EMSCRIPTEN=false
SKIP_WASI=false
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-emscripten)
            SKIP_EMSCRIPTEN=true
            shift
            ;;
        --skip-wasi)
            SKIP_WASI=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-emscripten  Skip Emscripten build"
            echo "  --skip-wasi        Skip WASI SDK build"
            echo "  --clean            Clean build directories before building"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo "🧹 Cleaning build directories..."
    rm -rf "$PROJECT_ROOT/build/emscripten"
    rm -rf "$PROJECT_ROOT/build/wasi"
    rm -rf "$PROJECT_ROOT/dist/browser"
    rm -rf "$PROJECT_ROOT/dist/wasi"
    echo -e "${GREEN}✅ Clean complete${NC}"
    echo ""
fi

# Track build results
EMSCRIPTEN_SUCCESS=false
WASI_SUCCESS=false

# Build with Emscripten
if [ "$SKIP_EMSCRIPTEN" = false ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}🌐 Building with Emscripten (Browser/Node)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if "$SCRIPT_DIR/build-emscripten.sh"; then
        EMSCRIPTEN_SUCCESS=true
        echo -e "${GREEN}✅ Emscripten build completed${NC}"
    else
        echo -e "${RED}❌ Emscripten build failed${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping Emscripten build${NC}"
fi

# Build with WASI SDK
if [ "$SKIP_WASI" = false ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}🔧 Building with WASI SDK (Server/CLI)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if "$SCRIPT_DIR/build-wasi.sh"; then
        WASI_SUCCESS=true
        echo -e "${GREEN}✅ WASI SDK build completed${NC}"
    else
        echo -e "${RED}❌ WASI SDK build failed${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping WASI build${NC}"
fi

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Dual Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Emscripten output
if [ "$SKIP_EMSCRIPTEN" = false ]; then
    if [ -f "$PROJECT_ROOT/dist/browser/taglib_emscripten.wasm" ]; then
        EMCC_SIZE=$(ls -lh "$PROJECT_ROOT/dist/browser/taglib_emscripten.wasm" | awk '{print $5}')
        echo -e "Emscripten: ${GREEN}✅ Success${NC}"
        echo "  └─ WASM size: $EMCC_SIZE"
        echo "  └─ Target: Browser, Node.js, Web Workers"
    else
        echo -e "Emscripten: ${RED}❌ Failed${NC}"
    fi
fi

# Check WASI output
if [ "$SKIP_WASI" = false ]; then
    if [ -f "$PROJECT_ROOT/dist/wasi/taglib_wasi.wasm" ]; then
        WASI_SIZE=$(ls -lh "$PROJECT_ROOT/dist/wasi/taglib_wasi.wasm" | awk '{print $5}')
        echo -e "WASI SDK:   ${GREEN}✅ Success${NC}"
        echo "  └─ WASM size: $WASI_SIZE"
        echo "  └─ Target: Deno, Node.js (WASI), Cloudflare Workers"
    else
        echo -e "WASI SDK:   ${RED}❌ Failed${NC}"
    fi
fi

echo ""
echo "Output directory structure:"
echo "  dist/"
echo "  ├── browser/"
echo "  │   ├── taglib_emscripten.wasm"
echo "  │   ├── taglib_emscripten.js"
echo "  │   └── taglib_emscripten.d.ts"
echo "  └── wasi/"
echo "      ├── taglib_wasi.wasm"
echo "      └── taglib_wasi.json"

# Exit with error if any build failed
if [ "$SKIP_EMSCRIPTEN" = false ] && [ "$EMSCRIPTEN_SUCCESS" = false ]; then
    exit 1
fi
if [ "$SKIP_WASI" = false ] && [ "$WASI_SUCCESS" = false ]; then
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Dual build complete!${NC}"