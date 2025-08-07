#!/bin/bash
# Test MessagePack integration

set -e

echo "Testing MessagePack integration..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Download MessagePack headers if not present
MSGPACK_DIR="$PROJECT_ROOT/lib/msgpack"
if [ ! -d "$MSGPACK_DIR" ]; then
    echo "Downloading MessagePack headers..."
    mkdir -p "$MSGPACK_DIR"
    cd "$MSGPACK_DIR"
    
    # Download header-only version
    wget -q https://github.com/msgpack/msgpack-c/releases/download/cpp-6.1.0/msgpack-cxx-6.1.0.tar.gz
    tar xzf msgpack-cxx-6.1.0.tar.gz
    mv msgpack-cxx-6.1.0/include .
    rm -rf msgpack-cxx-6.1.0 msgpack-cxx-6.1.0.tar.gz
    
    echo "✅ MessagePack headers downloaded"
fi

# Create a simple test file
cat > /tmp/test_msgpack.cpp << 'EOF'
#include <msgpack.hpp>
#include <iostream>
#include <string>
#include <map>

int main() {
    // Create a simple map
    std::map<std::string, int> data;
    data["test"] = 42;
    
    // Pack it
    msgpack::sbuffer buffer;
    msgpack::packer<msgpack::sbuffer> packer(buffer);
    packer.pack(data);
    
    // Unpack it
    msgpack::object_handle oh = msgpack::unpack(buffer.data(), buffer.size());
    msgpack::object obj = oh.get();
    
    std::map<std::string, int> result;
    obj.convert(result);
    
    std::cout << "Test value: " << result["test"] << std::endl;
    return 0;
}
EOF

# Try to compile with emcc
if command -v emcc &> /dev/null; then
    echo "Compiling test with Emscripten..."
    emcc /tmp/test_msgpack.cpp \
        -I"$MSGPACK_DIR/include" \
        -DMSGPACK_NO_BOOST=1 \
        -DMSGPACK_ENDIAN_LITTLE_BYTE=1 \
        -DMSGPACK_ENDIAN_BIG_BYTE=0 \
        -o /tmp/test_msgpack.js \
        -std=c++17
    
    echo "✅ MessagePack test compiled successfully"
    
    # Try to run it
    if command -v node &> /dev/null; then
        echo "Running test..."
        node /tmp/test_msgpack.js
    fi
else
    echo "Emscripten not found"
fi