#!/bin/bash
# Build an EH-enabled WASI sysroot from wasi-sdk 31 source
#
# WASI SDK 31 includes PR #590 (C++ exception support) natively.
# This script clones the source and builds the sysroot with -DWASI_SDK_EXCEPTIONS=ON.
# No manual patches required.
#
# Prerequisites: cmake, ninja, git, python3

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WASI_SDK_DIR="$PROJECT_ROOT/build/wasi-sdk"

# Source wasi-env.sh to get WASI_SDK_PATH (set by setup-wasi-sdk.sh)
source "$SCRIPT_DIR/wasi-env.sh" 2>/dev/null || true

if [ -z "$WASI_SDK_PATH" ] || [ ! -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo -e "${RED}WASI SDK not found. Run setup-wasi-sdk.sh first.${NC}"
    exit 1
fi

echo "Building EH-enabled WASI sysroot"
echo "Using toolchain from: $WASI_SDK_PATH"

# Check prerequisites
for cmd in cmake ninja git python3; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}Required command not found: $cmd${NC}"
        exit 1
    fi
done

WASI_SDK_SRC="$SCRIPT_DIR/wasi-sdk-src"
SYSROOT_BUILD="$SCRIPT_DIR/sysroot-build"

# Step 1: Clone wasi-sdk source at the wasi-sdk-31 tag
echo ""
echo -e "${BLUE}Step 1: Cloning wasi-sdk source${NC}"

if [ -d "$WASI_SDK_SRC" ] && [ -f "$WASI_SDK_SRC/CMakeLists.txt" ]; then
    echo -e "${GREEN}wasi-sdk source already cloned${NC}"
else
    rm -rf "$WASI_SDK_SRC"
    git clone --depth 1 --branch wasi-sdk-31 \
        https://github.com/WebAssembly/wasi-sdk.git "$WASI_SDK_SRC"
fi

cd "$WASI_SDK_SRC"

# Step 2: Initialize required submodules
echo ""
echo -e "${BLUE}Step 2: Initializing submodules${NC}"

git submodule update --init --depth 1 src/llvm-project src/wasi-libc

echo -e "${GREEN}Submodules initialized${NC}"

# Step 3: Build the EH-enabled sysroot
echo ""
echo -e "${BLUE}Step 3: Building EH-enabled sysroot${NC}"
echo "This will take ~5-10 minutes..."

rm -rf "$SYSROOT_BUILD"

cmake -G Ninja -B "$SYSROOT_BUILD" -S . \
    -DCMAKE_TOOLCHAIN_FILE="$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake" \
    -DCMAKE_INSTALL_PREFIX="$WASI_SDK_PATH" \
    -DWASI_SDK_EXCEPTIONS=ON \
    -DWASI_SDK_INCLUDE_TESTS=OFF \
    -DWASI_SDK_LTO=OFF

cmake --build "$SYSROOT_BUILD"

# Step 4: Install the EH sysroot into the SDK
echo ""
echo -e "${BLUE}Step 4: Installing EH sysroot into SDK${NC}"

cmake --install "$SYSROOT_BUILD" --prefix "$WASI_SDK_PATH"

# Step 5: Verify
echo ""
echo -e "${BLUE}Step 5: Verifying EH support${NC}"

# Check that libunwind was built
LIBUNWIND="$WASI_SDK_PATH/share/wasi-sysroot/lib/wasm32-wasip1/libunwind.a"
if [ -f "$LIBUNWIND" ]; then
    echo -e "${GREEN}libunwind.a found${NC}"
    ls -lh "$LIBUNWIND"
else
    # Try alternate location (some SDK versions use wasm32-wasi)
    LIBUNWIND=$(find "$WASI_SDK_PATH" -name "libunwind.a" 2>/dev/null | head -1)
    if [ -n "$LIBUNWIND" ]; then
        echo -e "${GREEN}libunwind.a found at: $LIBUNWIND${NC}"
    else
        echo -e "${RED}libunwind.a not found — EH sysroot may not have built correctly${NC}"
        exit 1
    fi
fi

# Check that libc++abi was rebuilt with EH
LIBCXXABI="$WASI_SDK_PATH/share/wasi-sysroot/lib/wasm32-wasip1/libc++abi.a"
if [ -f "$LIBCXXABI" ]; then
    if "$WASI_SDK_PATH/bin/llvm-objdump" --section=target_features "$LIBCXXABI" 2>/dev/null | grep -q "exception-handling"; then
        echo -e "${GREEN}libc++abi.a has exception-handling feature${NC}"
    else
        echo -e "${YELLOW}Could not verify exception-handling feature in libc++abi.a (may still work)${NC}"
    fi
else
    LIBCXXABI=$(find "$WASI_SDK_PATH" -name "libc++abi.a" 2>/dev/null | head -1)
    if [ -n "$LIBCXXABI" ]; then
        echo -e "${GREEN}libc++abi.a found at: $LIBCXXABI${NC}"
        if "$WASI_SDK_PATH/bin/llvm-objdump" --section=target_features "$LIBCXXABI" 2>/dev/null | grep -q "exception-handling"; then
            echo -e "${GREEN}libc++abi.a has exception-handling feature${NC}"
        else
            echo -e "${YELLOW}Could not verify exception-handling feature in libc++abi.a (may still work)${NC}"
        fi
    else
        echo -e "${YELLOW}libc++abi.a not found at expected location${NC}"
    fi
fi

echo ""
echo -e "${GREEN}EH-enabled sysroot build complete${NC}"
echo "The sysroot has been installed into: $WASI_SDK_PATH"
echo ""
echo "Next: rebuild TagLib with 'bash build/build-wasi.sh'"
