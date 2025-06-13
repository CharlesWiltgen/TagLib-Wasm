# STANDALONE_WASM Analysis for taglib-wasm

## Executive Summary

Switching to STANDALONE_WASM=1 and SIDE_MODULE=1 for JSR compatibility would introduce significant risks and limitations that could break existing functionality. **I strongly recommend against this approach** and suggest maintaining separate builds for NPM and JSR instead.

## 1. Features We Would Lose with STANDALONE_WASM=1

### Critical Losses:

1. **Emscripten's `allocate()` Function**
   - Our entire memory management strategy relies on `module.allocate()`
   - This is the critical fix that made all audio formats work correctly
   - Without it, we'd need to revert to manual memory management which causes data corruption

2. **Runtime Helper Functions**
   - `getValue()`, `setValue()` - Used for reading/writing memory
   - `UTF8ToString()`, `stringToUTF8()` - String conversion utilities
   - `lengthBytesUTF8()` - String length calculations
   - These would need to be manually reimplemented

3. **Automatic Memory Growth**
   - `ALLOW_MEMORY_GROWTH=1` behavior changes in standalone mode
   - Memory must be pre-allocated or manually managed
   - Could lead to out-of-memory errors for large files

4. **Exception Handling**
   - C++ exceptions become more limited
   - Error reporting may be less detailed
   - Stack traces unavailable

5. **Module Loading Conveniences**
   - No more `MODULARIZE=1` with automatic initialization
   - No `onRuntimeInitialized` callback
   - Manual WASM instantiation required

## 2. Impact on NPM Builds

### Breaking Changes:

1. **API Incompatibility**
   - Current NPM users rely on Emscripten's JS runtime
   - Would break all existing integrations
   - Migration would require significant code changes

2. **Node.js Compatibility**
   - Node.js users expect standard Emscripten module loading
   - File system emulation features would be lost
   - CommonJS/ESM module loading patterns would break

3. **Browser Support**
   - Web Workers compatibility affected
   - Async loading patterns would change
   - Bundle size may increase due to polyfills

## 3. Performance Implications

### Negative Impacts:

1. **Memory Allocation Overhead**
   - Manual memory management is slower
   - No optimized allocator from Emscripten
   - Potential memory fragmentation

2. **String Operations**
   - UTF-8 conversion becomes manual and slower
   - No optimized string handling from runtime

3. **Function Call Overhead**
   - Direct WASM calls without JS wrapper optimizations
   - No inlining of common operations

### Potential Benefits:

1. **Smaller Initial Size**
   - ~100KB less JavaScript code
   - Faster initial parse time

2. **Direct WASM Loading**
   - Skip JS initialization overhead
   - Better for simple use cases

## 4. Memory Management Concerns

### Critical Issue: The `allocate()` Problem

Our current implementation relies heavily on Emscripten's `allocate()`:

```typescript
// This is what makes taglib-wasm work correctly
const dataPtr = this.module.allocate(buffer, this.module.ALLOC_NORMAL);
```

Without this, we'd need to:

```typescript
// This approach causes data corruption!
const ptr = module._malloc(buffer.length);
module.HEAPU8.set(buffer, ptr);
```

The manual approach has proven to cause data corruption due to memory synchronization issues between JavaScript and WASM memory spaces.

### Memory Lifecycle Changes:

1. **Allocation**
   - Would need custom allocator implementation
   - Risk of alignment issues
   - No automatic garbage collection integration

2. **Deallocation**
   - Manual tracking of all allocations
   - Higher risk of memory leaks
   - No automatic cleanup on errors

## 5. Exception Handling & Error Reporting

### Current State:
- C++ exceptions are caught and converted to JS errors
- Stack traces available for debugging
- Detailed error messages from TagLib

### With STANDALONE_WASM:
- Limited exception support
- Generic error codes instead of messages
- Debugging becomes much harder
- No integration with browser DevTools

## 6. Dual Build Strategy Assessment

### Option A: Single STANDALONE Build (NOT RECOMMENDED)
```bash
# Would break existing functionality
-s STANDALONE_WASM=1
-s SIDE_MODULE=1
```

### Option B: Separate Builds (RECOMMENDED)
```bash
# NPM Build (current approach)
-s MODULARIZE=1
-s EXPORT_NAME="TagLibWASM"
-s ENVIRONMENT='web,node'

# JSR Build (new, minimal)
-s STANDALONE_WASM=1
-s ENVIRONMENT='web'
```

### Option C: Hybrid Approach (INVESTIGATE)
- Keep current build for NPM
- Create minimal wrapper for JSR that loads the same WASM
- Implement critical functions (allocate, string handling) in pure JS

## 7. C++ Wrapper Dependencies

Our C++ wrapper uses:

1. **Emscripten Headers** (currently unused)
   ```cpp
   #include <emscripten/bind.h>
   #include <emscripten/val.h>
   ```
   - These can be removed safely

2. **Standard C++ Features**
   - `std::map`, `std::unique_ptr` - Should work in standalone
   - `std::string` - May have issues with memory allocation
   - Exception handling - Limited in standalone mode

3. **No Direct JS Dependencies**
   - All functions use `extern "C"`
   - No `EM_ASM` or `EM_JS` macros
   - Should be compatible with standalone

## Critical Discovery: JSR Implementation Already Has The Problem!

Looking at the current JSR implementation (`src/wasm-jsr.ts`), it's already using the manual memory allocation approach that causes data corruption:

```typescript
allocate: (array: Uint8Array, type: number) => {
  const ptr = module._malloc(array.length);
  // ... memory view updates ...
  module.HEAPU8.set(array, ptr);  // ← THIS CAUSES DATA CORRUPTION!
  return ptr;
},
```

**This means the JSR version likely has the same memory corruption issues that plagued the original implementation!** This is a critical bug that needs to be fixed.

## Recommendations

### 1. **Don't Use STANDALONE_WASM for Main Build**
- The loss of `allocate()` alone makes this a non-starter
- Would require rewriting core memory management
- High risk of introducing bugs that took months to solve

### 2. **Maintain Separate Builds**
- **NPM**: Current Emscripten approach with full runtime
- **JSR**: Either:
  - Create a minimal JS wrapper that provides `allocate()` functionality
  - Use the current approach but optimize the JS wrapper for JSR
  - Investigate if JSR's restrictions can be relaxed

### 3. **If STANDALONE_WASM is Required**
- Implement custom `allocate()` function in C++
- Extensive testing required for memory corruption
- Plan for 2-3 months of stabilization
- Maintain extensive test suite for both builds

### 4. **Short-term Solution**
- Keep current architecture
- For JSR, minimize the JS wrapper but keep critical functions
- Document the technical requirements clearly
- Work with JSR team to understand if exceptions can be made

## Conclusion

The switch to STANDALONE_WASM would fundamentally break the memory management solution that makes taglib-wasm reliable. The `allocate()` function is not just a convenience—it's the critical piece that prevents data corruption when passing buffers between JavaScript and WebAssembly.

While STANDALONE_WASM offers some benefits (smaller size, direct loading), the costs far outweigh them:
- Loss of proven memory management
- Breaking changes for all existing users  
- Significant development effort to reimplement core functionality
- High risk of reintroducing bugs that were difficult to solve

**Recommendation**: Maintain the current Emscripten-based approach and explore alternative solutions for JSR compatibility that don't compromise the core functionality.

## Immediate Action Items

### 1. Fix JSR Implementation Memory Bug
The current JSR implementation has a critical bug. Replace:
```typescript
// BROKEN - causes data corruption
allocate: (array: Uint8Array, type: number) => {
  const ptr = module._malloc(array.length);
  module.HEAPU8.set(array, ptr);
  return ptr;
}
```

With a proper implementation that handles memory synchronization correctly.

### 2. Alternative JSR Solutions

#### Option A: Minimal Emscripten Runtime
Create a minimal JS file that includes only essential Emscripten functions:
- `allocate()` implementation
- UTF-8 string handling
- Memory view management

#### Option B: C++ Implementation
Implement a custom allocator in C++ that handles the memory synchronization:
```cpp
extern "C" void* allocate_and_copy(const uint8_t* data, size_t size) {
    void* ptr = malloc(size);
    if (ptr) {
        memcpy(ptr, data, size);
        // Ensure memory fence for synchronization
        std::atomic_thread_fence(std::memory_order_seq_cst);
    }
    return ptr;
}
```

#### Option C: WebAssembly.Memory Direct Access
Use WebAssembly.Memory APIs directly with proper synchronization:
```typescript
allocate: (array: Uint8Array, type: number) => {
  const ptr = module._malloc(array.length);
  // Create a new view each time to ensure synchronization
  const view = new Uint8Array(module.memory.buffer, ptr, array.length);
  view.set(array);
  return ptr;
}
```

### 3. Testing Requirements
Before any changes:
1. Create comprehensive memory corruption tests
2. Test with all 5 audio formats
3. Test with files > 10MB to catch memory issues
4. Verify no data loss or corruption
5. Performance benchmarks to ensure no regression

### 4. Documentation Updates
- Document why `allocate()` is critical
- Add warnings about manual memory management
- Create migration guide if API changes
- Update Implementation.md with new findings