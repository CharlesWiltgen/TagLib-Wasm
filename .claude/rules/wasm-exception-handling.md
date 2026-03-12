# Wasm Exception Handling Architecture

EH-enabled sysroot approach using WASI SDK 31 (LLVM 22).

## Current Solution

**EH-enabled WASI sysroot** — WASI SDK 31 includes PR #590 (C++ exception support)
natively. Build sysroot from source with `-DWASI_SDK_EXCEPTIONS=ON`. No manual
patching required. All function table entries are consistent, enabling `FileRef`
(which uses `dynamic_cast`/RTTI) to work.

```
✅ taglib_boundary.c      - Pure C WASI exports (no EH)
✅ taglib_shim.cpp        - C++ with FileRef + Wasm EH (-fwasm-exceptions)
✅ taglib_error.cpp       - C++ with pure C internals (compiled with Wasm EH)
✅ taglib_msgpack.c       - Pure C MessagePack (mpack library)
✅ wasm_eh_tag.S          - __cpp_exception tag definition (LLVM 22+ requirement)
✅ EH sysroot             - libc++abi + libunwind with exception-handling feature
```

## Historical Context

Previously, mixing Wasm EH and Itanium EH models caused `call_indirect` type
mismatches because WASI SDK's stock libc++abi lacked the `exception-handling`
Wasm feature. The workaround was to avoid FileRef and use format-specific
constructors with `cxa_stubs.c` providing abort-on-throw stubs.

## Exception Model Consistency (MANDATORY)

```bash
# ❌ FATAL: Mixed EH models
clang++ file1.cpp -fwasm-exceptions        # Wasm EH
clang++ file2.cpp -fexceptions             # Itanium EH
# Result: Undefined symbols: __cxa_begin_catch, __cxa_throw, etc.

# ✅ CORRECT: Consistent EH model
clang++ file1.cpp -fwasm-exceptions        # Wasm EH
clang++ file2.cpp -fwasm-exceptions        # Wasm EH
# Result: Clean linkage, working binary
```

## C++ Standard Library EH Symbol Generation

```cpp
// ❌ DANGER: These generate Itanium EH symbols even with -fwasm-exceptions
std::string error_msg = "error";           // __cxa_* symbols
thread_local std::string state;            // __cxa_* symbols
std::vector<int> data;                     // Potential __cxa_* symbols

// ✅ SAFE: Pure C alternatives
char error_msg[256] = "error";             // No EH symbols
static char state[256] = {0};              // No EH symbols
int* data = malloc(sizeof(int) * count);   // No EH symbols
```

## CMake Flag Propagation Issues

```cmake
# ❌ UNRELIABLE: Flags may not propagate to external projects
set(CMAKE_CXX_FLAGS "-fwasm-exceptions")
add_subdirectory(taglib)  # May ignore parent flags

# ✅ RELIABLE: Per-target enforcement
target_compile_options(taglib PRIVATE -fwasm-exceptions)
target_compile_options(my_shim PRIVATE -fwasm-exceptions)
```

## Architecture Verification Commands

```bash
# ✅ ESSENTIAL: Verify no Itanium EH symbols
llvm-objdump -t dist/wasi/taglib_wasi.wasm | grep -E "__cxa_|__gxx_personality"
# Expected result: No output (clean Wasm EH)

# ✅ ALTERNATIVE: Check for undefined symbols
wasm-objdump --details dist/wasi/taglib_wasi.wasm | grep "undefined"
# Should not contain __cxa_begin_catch, __cxa_throw, etc.

# ✅ VERIFY: Wasm EH instructions present
wasm-objdump --disassemble dist/wasi/taglib_wasi.wasm | grep -E "try|catch|throw"
# Should show Wasm EH instructions, not runtime calls
```

## Proven Solution Pattern: EH Sysroot (CURRENT)

```
✅ WORKS: EH-enabled sysroot eliminates EH model mismatch
- build/build-eh-sysroot.sh: Clones wasi-sdk-31, builds with -DWASI_SDK_EXCEPTIONS=ON
- taglib_shim.cpp: Uses FileRef with -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false
- taglib_boundary.c: Pure C (WASI exports, no exceptions)
- wasm_eh_tag.S: Defines __cpp_exception tag (LLVM 22+ requires external definition)
- Linker: -fwasm-exceptions -lunwind (no -mllvm at link time)
```

## Build Configuration

```bash
# One-time: Build EH-enabled sysroot
bash build/build-eh-sysroot.sh

# C files (Pure C boundary — still need -fwasm-exceptions for target_features)
clang -c taglib_boundary.c --target=wasm32-wasip1 -fwasm-exceptions

# C++ files (Exception handling)
clang++ -c taglib_shim.cpp --target=wasm32-wasip1 \
    -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false

# Wasm EH tag (LLVM 22+: __cpp_exception must be defined externally)
clang -c wasm_eh_tag.S --target=wasm32-wasip1 -mexception-handling

# Final linking (Wasm EH + libunwind, no -mllvm at link time)
clang++ *.obj --target=wasm32-wasip1 \
    -fwasm-exceptions -lunwind \
    -o taglib_wasi.wasm
```

## MessagePack Integration

```c
// ✅ PROVEN: mpack C library works perfectly with WASI
#include "mpack/mpack.h"  // Exception-free C implementation

// ✅ Field handler pattern (complexity reduction)
static const field_handler_t HANDLERS[] = {
    {"album", handle_album},      // O(log n) binary search
    {"artist", handle_artist},    // vs O(n) if-else chain
    {"title", handle_title}
};
```

## Pre-Build Checklist

Before any C++ WASM build:

1. ✅ **Verify flag consistency**: All C++ files use same EH model
2. ✅ **Avoid stdlib EH triggers**: No std::string in error paths
3. ✅ **Check external projects**: Ensure TagLib uses -fwasm-exceptions
4. ✅ **Verify with objdump**: No __cxa_* symbols in final binary
5. ✅ **Test exception handling**: Confirm C++ exceptions work correctly

## Red Flags (STOP IMMEDIATELY)

- `undefined symbol: __cxa_begin_catch` in linker output
- `undefined symbol: __cxa_throw` in linker output
- `undefined symbol: __gxx_personality_v0` in linker output
- Mixed `-fexceptions` and `-fwasm-exceptions` in build
- External library (TagLib) without explicit Wasm EH flags

## Green Lights (PROCEED)

- `llvm-objdump -t *.wasm | grep __cxa_` returns empty
- Clean WASI binary links successfully
- C++ exceptions caught correctly in shim
- MessagePack encoding/decoding works perfectly
