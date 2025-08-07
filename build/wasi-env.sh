#!/bin/bash
# Source this file to set up WASI SDK environment
export WASI_SDK_PATH="/Users/Charles/Projects/taglib-wasm/build/wasi-sdk/wasi-sdk-27.0-arm64-macos"
export PATH="$WASI_SDK_PATH/bin:$PATH"
echo "WASI SDK 27.0 environment configured"
echo "  WASI_SDK_PATH: $WASI_SDK_PATH"
echo "  Compiler: $WASI_SDK_PATH/bin/clang"