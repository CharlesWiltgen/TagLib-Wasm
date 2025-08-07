#!/bin/bash
# WASI SDK Setup Script for TagLib-Wasm Phase 0 Research
# Installs WASI SDK for dual-build (Emscripten + WASI) architecture

set -e

# Configuration - Using latest stable version
WASI_SDK_VERSION="27"
WASI_SDK_VERSION_FULL="27.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WASI_SDK_DIR="$PROJECT_ROOT/build/wasi-sdk"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Setting up WASI SDK ${WASI_SDK_VERSION_FULL} for TagLib-Wasm dual-build"
echo "   Installation directory: $WASI_SDK_DIR"
echo ""

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)
        PLATFORM="linux"
        ;;
    Darwin*)
        PLATFORM="macos"
        # Map x86_64 and arm64 appropriately for macOS
        if [ "$ARCH" = "x86_64" ]; then
            ARCH="x86_64"
        elif [ "$ARCH" = "arm64" ]; then
            ARCH="arm64"
        fi
        ;;
    *)
        echo -e "${RED}❌ Unsupported operating system: $OS${NC}"
        exit 1
        ;;
esac

# Check if WASI SDK is already installed
if [ -d "$WASI_SDK_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}" ]; then
    echo -e "${GREEN}✅ WASI SDK ${WASI_SDK_VERSION_FULL} is already installed${NC}"
    echo "   Path: $WASI_SDK_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}"
    echo ""
    echo "To use it, set:"
    echo "export WASI_SDK_PATH=\"$WASI_SDK_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}\""
    exit 0
fi

# Construct download URL
if [ "$PLATFORM" = "macos" ]; then
    TARBALL="wasi-sdk-${WASI_SDK_VERSION_FULL}-${ARCH}-macos.tar.gz"
else
    TARBALL="wasi-sdk-${WASI_SDK_VERSION_FULL}-${ARCH}-${PLATFORM}.tar.gz"
fi
DOWNLOAD_URL="https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_SDK_VERSION}/${TARBALL}"

echo "📦 Downloading WASI SDK from:"
echo "   $DOWNLOAD_URL"
echo ""

# Create directory
mkdir -p "$WASI_SDK_DIR"
cd "$WASI_SDK_DIR"

# Download WASI SDK
if command -v curl &> /dev/null; then
    curl -L -o "$TARBALL" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget -O "$TARBALL" "$DOWNLOAD_URL"
else
    echo -e "${RED}❌ Neither curl nor wget is available${NC}"
    exit 1
fi

# Extract
echo ""
echo "📂 Extracting WASI SDK..."
tar xzf "$TARBALL"

# Clean up tarball
rm "$TARBALL"

# Verify installation - handle different directory naming conventions
WASI_SDK_PATH="$WASI_SDK_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}"
# Check for architecture-specific directory name
if [ "$PLATFORM" = "macos" ]; then
    WASI_SDK_PATH="$WASI_SDK_DIR/wasi-sdk-${WASI_SDK_VERSION_FULL}-${ARCH}-macos"
fi

if [ -f "$WASI_SDK_PATH/bin/clang" ]; then
    echo -e "${GREEN}✅ WASI SDK ${WASI_SDK_VERSION_FULL} installed successfully!${NC}"
    echo ""
    echo "Installation path: $WASI_SDK_PATH"
    echo ""
    echo "To use WASI SDK, add to your environment:"
    echo "export WASI_SDK_PATH=\"$WASI_SDK_PATH\""
    echo ""
    
    # Create a convenience script for setting environment
    cat > "$PROJECT_ROOT/build/wasi-env.sh" << EOF
#!/bin/bash
# Source this file to set up WASI SDK environment
export WASI_SDK_PATH="$WASI_SDK_PATH"
export PATH="\$WASI_SDK_PATH/bin:\$PATH"
echo "WASI SDK ${WASI_SDK_VERSION_FULL} environment configured"
echo "  WASI_SDK_PATH: \$WASI_SDK_PATH"
echo "  Compiler: \$WASI_SDK_PATH/bin/clang"
EOF
    chmod +x "$PROJECT_ROOT/build/wasi-env.sh"
    
    echo "💡 Quick setup: source build/wasi-env.sh"
    echo ""
    
    # Show version info
    echo "Compiler version:"
    "$WASI_SDK_PATH/bin/clang" --version | head -n 1
else
    echo -e "${RED}❌ Installation verification failed${NC}"
    echo "   Could not find: $WASI_SDK_PATH/bin/clang"
    exit 1
fi

echo ""
echo "📝 Next steps for Phase 0:"
echo "  1. Source the environment: source build/wasi-env.sh"
echo "  2. Test compilation: build/test-wasi-compile.sh"
echo "  3. Run benchmarks: deno run --allow-all tests/phase0-benchmarks.ts"