#!/bin/bash
# Phase 1: Developer Environment Setup Script
# Sets up complete development environment for TagLib-Wasm dual build

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "🛠️  TagLib-Wasm Developer Environment Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Detect OS
OS_TYPE=""
ARCH_TYPE=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="linux"
    ARCH_TYPE=$(uname -m)
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macos"
    ARCH_TYPE=$(uname -m)
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS_TYPE="windows"
    ARCH_TYPE="x86_64"
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo "Detected OS: $OS_TYPE ($ARCH_TYPE)"
echo ""

# Check for required tools
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Checking Prerequisites"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_command() {
    local cmd=$1
    local install_hint=$2
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✅${NC} $cmd: $(which $cmd)"
        return 0
    else
        echo -e "${RED}❌${NC} $cmd: not found"
        echo "   Install hint: $install_hint"
        return 1
    fi
}

MISSING_TOOLS=false

# Core tools
check_command git "Install git from https://git-scm.com" || MISSING_TOOLS=true
check_command cmake "Install cmake from https://cmake.org/download/" || MISSING_TOOLS=true
check_command make "Install build tools for your OS" || MISSING_TOOLS=true
check_command python3 "Install Python 3 from https://python.org" || MISSING_TOOLS=true
check_command node "Install Node.js from https://nodejs.org" || MISSING_TOOLS=true
check_command npm "Comes with Node.js installation" || MISSING_TOOLS=true

# Optional but recommended
echo ""
echo "Optional tools:"
check_command deno "Install from https://deno.land" || true
check_command bun "Install from https://bun.sh" || true
check_command wasm-opt "npm install -g wasm-opt" || true
check_command wasm-strip "npm install -g wasm-strip" || true

if [ "$MISSING_TOOLS" = true ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some required tools are missing. Please install them first.${NC}"
    exit 1
fi

# Install Emscripten
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Setting up Emscripten"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v emcc &> /dev/null; then
    echo -e "${GREEN}✅ Emscripten already installed${NC}"
    emcc --version | head -1
else
    echo "Installing Emscripten SDK..."
    
    # Clone emsdk
    if [ ! -d "$HOME/emsdk" ]; then
        git clone https://github.com/emscripten-core/emsdk.git "$HOME/emsdk"
    fi
    
    cd "$HOME/emsdk"
    
    # Install latest SDK
    ./emsdk install latest
    ./emsdk activate latest
    
    # Add to shell config
    SHELL_CONFIG=""
    if [ -f "$HOME/.zshrc" ]; then
        SHELL_CONFIG="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_CONFIG="$HOME/.bashrc"
    fi
    
    if [ -n "$SHELL_CONFIG" ] && ! grep -q "emsdk_env.sh" "$SHELL_CONFIG"; then
        echo "" >> "$SHELL_CONFIG"
        echo "# Emscripten SDK" >> "$SHELL_CONFIG"
        echo "source $HOME/emsdk/emsdk_env.sh > /dev/null 2>&1" >> "$SHELL_CONFIG"
        echo -e "${GREEN}✅ Added Emscripten to $SHELL_CONFIG${NC}"
    fi
    
    # Source for current session
    source "$HOME/emsdk/emsdk_env.sh"
    
    echo -e "${GREEN}✅ Emscripten installed${NC}"
    emcc --version | head -1
fi

# Install WASI SDK
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Setting up WASI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WASI_SDK_DIR="$PROJECT_ROOT/build/wasi-sdk"
WASI_VERSION="30.0"

# Determine WASI SDK download URL based on OS and architecture
WASI_SDK_NAME=""
case "$OS_TYPE-$ARCH_TYPE" in
    linux-x86_64)
        WASI_SDK_NAME="wasi-sdk-${WASI_VERSION}-x86_64-linux"
        ;;
    linux-aarch64)
        WASI_SDK_NAME="wasi-sdk-${WASI_VERSION}-arm64-linux"
        ;;
    macos-x86_64)
        WASI_SDK_NAME="wasi-sdk-${WASI_VERSION}-x86_64-macos"
        ;;
    macos-arm64)
        WASI_SDK_NAME="wasi-sdk-${WASI_VERSION}-arm64-macos"
        ;;
    windows-x86_64)
        WASI_SDK_NAME="wasi-sdk-${WASI_VERSION}-x86_64-windows"
        ;;
    *)
        echo -e "${RED}❌ Unsupported architecture for WASI SDK: $OS_TYPE-$ARCH_TYPE${NC}"
        exit 1
        ;;
esac

WASI_INSTALL_PATH="$WASI_SDK_DIR/$WASI_SDK_NAME"

if [ -d "$WASI_INSTALL_PATH" ] && [ -f "$WASI_INSTALL_PATH/bin/clang++" ]; then
    echo -e "${GREEN}✅ WASI SDK already installed${NC}"
    echo "   Path: $WASI_INSTALL_PATH"
else
    echo "Installing WASI SDK v$WASI_VERSION..."
    
    mkdir -p "$WASI_SDK_DIR"
    cd "$WASI_SDK_DIR"
    
    # Download WASI SDK
    WASI_URL="https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_VERSION%%.*}/${WASI_SDK_NAME}.tar.gz"
    
    echo "Downloading from: $WASI_URL"
    if command -v wget &> /dev/null; then
        wget -q --show-progress "$WASI_URL"
    elif command -v curl &> /dev/null; then
        curl -L -O "$WASI_URL"
    else
        echo -e "${RED}❌ Neither wget nor curl found. Cannot download WASI SDK.${NC}"
        exit 1
    fi
    
    # Extract
    echo "Extracting..."
    tar xzf "${WASI_SDK_NAME}.tar.gz"
    rm "${WASI_SDK_NAME}.tar.gz"
    
    echo -e "${GREEN}✅ WASI SDK installed${NC}"
    echo "   Path: $WASI_INSTALL_PATH"
fi

# Update wasi-env.sh with correct path
cat > "$PROJECT_ROOT/build/wasi-env.sh" << EOF
#!/bin/bash
# Source this file to set up WASI SDK environment
export WASI_SDK_PATH="$WASI_INSTALL_PATH"
export PATH="\$WASI_SDK_PATH/bin:\$PATH"
echo "WASI SDK $WASI_VERSION environment configured"
echo "  WASI_SDK_PATH: \$WASI_SDK_PATH"
echo "  Compiler: \$WASI_SDK_PATH/bin/clang"
EOF

chmod +x "$PROJECT_ROOT/build/wasi-env.sh"

# Install Node.js dependencies
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Installing Node.js dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_ROOT"

if [ -f "package.json" ]; then
    echo "Installing npm packages..."
    npm install
    echo -e "${GREEN}✅ npm packages installed${NC}"
else
    echo -e "${YELLOW}⚠️  No package.json found${NC}"
fi

# Install global tools
echo ""
echo "Installing global WebAssembly tools..."
npm install -g wasm-opt wasm-strip 2>/dev/null || true

# Initialize git submodules
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Initializing TagLib submodule"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "$PROJECT_ROOT/lib/taglib/CMakeLists.txt" ]; then
    echo "Initializing TagLib submodule..."
    git submodule update --init --recursive
    echo -e "${GREEN}✅ TagLib submodule initialized${NC}"
else
    echo -e "${GREEN}✅ TagLib submodule already initialized${NC}"
fi

# Create directory structure
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Creating directory structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p "$PROJECT_ROOT/build/emscripten/taglib"
mkdir -p "$PROJECT_ROOT/build/wasi/taglib"
mkdir -p "$PROJECT_ROOT/dist/browser"
mkdir -p "$PROJECT_ROOT/dist/wasi"

echo "Directory structure created:"
echo "  build/"
echo "  ├── emscripten/     # Emscripten build directory"
echo "  │   └── taglib/     # TagLib built with emcc"
echo "  ├── wasi/           # WASI SDK build directory"
echo "  │   └── taglib/     # TagLib built with wasi-sdk"
echo "  └── wasi-sdk/       # WASI SDK installation"
echo ""
echo "  dist/"
echo "  ├── browser/        # Emscripten output (browser/Node)"
echo "  └── wasi/           # WASI output (Deno/Workers)"

# Make build scripts executable
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Setting up build scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

chmod +x "$PROJECT_ROOT/build"/*.sh
echo -e "${GREEN}✅ Build scripts are executable${NC}"

# Test setup
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test Emscripten
echo -n "Testing Emscripten... "
if emcc --version &> /dev/null; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# Test WASI SDK
echo -n "Testing WASI SDK... "
source "$PROJECT_ROOT/build/wasi-env.sh" > /dev/null 2>&1
if "$WASI_SDK_PATH/bin/clang++" --version &> /dev/null; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Development Environment Ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Build both targets:"
echo -e "   ${CYAN}./build/build-dual.sh${NC}"
echo ""
echo "2. Build Emscripten only:"
echo -e "   ${CYAN}./build/build-emscripten.sh${NC}"
echo ""
echo "3. Build WASI only:"
echo -e "   ${CYAN}source ./build/wasi-env.sh${NC}"
echo -e "   ${CYAN}./build/build-wasi.sh${NC}"
echo ""
echo "4. Run tests:"
echo -e "   ${CYAN}npm test${NC}          # Node.js tests"
echo -e "   ${CYAN}deno task test${NC}    # Deno tests"
echo -e "   ${CYAN}bun test${NC}          # Bun tests"
echo ""
echo "For more information, see docs/phase1-setup.md"