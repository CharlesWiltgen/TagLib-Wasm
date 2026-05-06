#!/bin/bash
# Build and run C++ unit tests for TagLib-Wasm C API

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Building and running C++ unit tests for TagLib-Wasm C API${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_BUILD_DIR="$PROJECT_ROOT/build/tests"
SRC_DIR="$PROJECT_ROOT/src/capi"

# Create test build directory
mkdir -p "$TEST_BUILD_DIR"

echo -e "${YELLOW}📦 Step 1: Compiling C++ unit tests${NC}"

# Check for compiler
if command -v g++ &> /dev/null; then
    COMPILER="g++"
elif command -v clang++ &> /dev/null; then
    COMPILER="clang++"
else
    echo -e "${RED}❌ No C++ compiler found (g++ or clang++)${NC}"
    exit 1
fi

echo "Using compiler: $COMPILER"

# Compile the memory pool test with the C API source files
echo "Compiling memory pool unit tests..."
$COMPILER \
    "$SCRIPT_DIR/capi_memory_pool.test.cpp" \
    "$SRC_DIR/core/taglib_memory.cpp" \
    "$SRC_DIR/core/taglib_error.cpp" \
    -I"$SRC_DIR" \
    -I"$SRC_DIR/core" \
    -std=c++17 \
    -pthread \
    -O2 \
    -Wall \
    -Wextra \
    -Werror=return-type \
    -o "$TEST_BUILD_DIR/capi_memory_pool_test"

if [ ! -f "$TEST_BUILD_DIR/capi_memory_pool_test" ]; then
    echo -e "${RED}❌ Failed to compile memory pool tests${NC}"
    exit 1
fi

echo "Compiling LAME parser unit tests..."
$COMPILER \
    "$SCRIPT_DIR/capi_lame_parser.test.cpp" \
    "$SRC_DIR/formats/taglib_lame.cpp" \
    -I"$SRC_DIR" \
    -I"$SRC_DIR/formats" \
    -std=c++17 \
    -O2 \
    -Wall \
    -Wextra \
    -Werror=return-type \
    -o "$TEST_BUILD_DIR/capi_lame_parser_test"

if [ ! -f "$TEST_BUILD_DIR/capi_lame_parser_test" ]; then
    echo -e "${RED}❌ Failed to compile LAME parser tests${NC}"
    exit 1
fi

echo -e "${GREEN}✅ C++ unit tests compiled successfully${NC}"

echo ""
echo -e "${YELLOW}🏃 Step 2: Running unit tests${NC}"
echo ""

# Run the tests
if "$TEST_BUILD_DIR/capi_memory_pool_test"; then
    if "$TEST_BUILD_DIR/capi_lame_parser_test"; then
        echo -e "${GREEN}✅ LAME parser tests passed${NC}"
    else
        echo -e "${RED}❌ LAME parser tests failed${NC}"
        exit 1
    fi
    echo ""
    echo -e "${GREEN}✅ All C++ unit tests passed!${NC}"
    
    # Compile and run performance benchmarks
    echo ""
    echo -e "${YELLOW}🔥 Step 3: Compiling performance benchmarks${NC}"
    
    echo "Compiling performance benchmarks..."
    $COMPILER \
        "$SCRIPT_DIR/capi_performance.benchmark.cpp" \
        "$SRC_DIR/core/taglib_memory.cpp" \
        "$SRC_DIR/core/taglib_error.cpp" \
        -I"$SRC_DIR" \
        -I"$SRC_DIR/core" \
        -std=c++17 \
        -pthread \
        -O2 \
        -Wall \
        -Wextra \
        -Werror=return-type \
        -o "$TEST_BUILD_DIR/capi_performance_benchmark"
    
    if [ ! -f "$TEST_BUILD_DIR/capi_performance_benchmark" ]; then
        echo -e "${RED}❌ Failed to compile performance benchmarks${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Performance benchmarks compiled successfully${NC}"
    echo ""
    echo -e "${YELLOW}⚡ Step 4: Running performance benchmarks${NC}"
    echo ""
    
    "$TEST_BUILD_DIR/capi_performance_benchmark"
    
    echo ""
    echo -e "${GREEN}✅ All tests and benchmarks completed successfully!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some C++ unit tests failed!${NC}"
    exit 1
fi