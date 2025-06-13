# Embind Runtime Analysis for JSR Compatibility

## Summary

This document describes the minimal Embind runtime implementation for JSR compatibility with the taglib-wasm project.

## Key Findings

### 1. Current State

The taglib-wasm project uses Emscripten with Embind to compile C++ classes to JavaScript. The build produces:
- `taglib.wasm` - The WebAssembly binary with Embind-compiled code
- `taglib.js` - Full Emscripten runtime with Embind support

### 2. Embind Runtime Requirements

For the Embind-compiled WASM to work, it requires:

#### Core Runtime Functions
- Memory management (`_malloc`, `_free`, `allocate`)
- Type conversion (`UTF8ToString`, `stringToUTF8`, `lengthBytesUTF8`)
- Memory views (HEAP8, HEAPU8, etc.)
- Exception handling (`___cxa_throw`, `___cxa_begin_catch`, etc.)

#### Embind-Specific Functions
- Type registration (`__embind_register_*` functions)
- Value conversion (`__emval_*` functions)
- Method invocation trampolines (`invoke_*` functions)

### 3. Minimal Runtime Implementation

The `wasm-jsr.ts` file implements a minimal runtime that:

1. **Provides core memory management** - Direct WASM memory access and allocation
2. **Implements string conversion** - UTF-8 encoding/decoding for C++ interop
3. **Stubs Embind registration functions** - Minimal implementations that satisfy imports
4. **Provides fallback class implementations** - JavaScript implementations of the expected Embind classes

### 4. Compatibility Mode

Since implementing a full Embind runtime is complex, the JSR version uses a "compatibility mode":
- Provides the same API as Embind classes
- Uses fallback JavaScript implementations
- Maintains the same interface for TypeScript consumers

### 5. Classes Provided

The minimal runtime provides these Embind-compatible classes:
- `FileHandle` - Main file handling class
- `TagWrapper` - Tag metadata access
- `AudioPropertiesWrapper` - Audio properties access
- `createFileHandle()` - Factory function

## Implementation Details

### Memory Management

```typescript
// Allocate memory and copy data
allocate: (array: Uint8Array, type: number) => {
  const ptr = module._malloc(array.length);
  module.HEAPU8.set(array, ptr);
  return ptr;
}
```

### String Conversion

```typescript
// UTF-8 string to C pointer
const stringToUTF8 = (str: string, outPtr: number, maxBytesToWrite: number): number => {
  // Encodes JavaScript string to UTF-8 bytes in WASM memory
}

// C pointer to JavaScript string  
const UTF8ToString = (ptr: number): string => {
  // Decodes UTF-8 bytes from WASM memory to JavaScript string
}
```

### Embind Class Emulation

```typescript
const createEmbindClass = (className: string, methods: Record<string, Function>) => {
  // Creates a JavaScript class that mimics Embind behavior
  // Includes $$ property for Embind compatibility
  // Provides delete() method for cleanup
}
```

## Limitations

1. **No actual C++ binding** - The fallback classes don't call into the WASM
2. **Limited functionality** - Only provides API compatibility, not full TagLib features
3. **No type safety** - Embind's type checking is not implemented

## Recommendations

For full functionality, use:
- **NPM package** (`taglib-wasm`) - Includes full Emscripten runtime
- **Direct import** of `taglib.js` - When Emscripten JS is acceptable

For JSR compatibility with limitations:
- **JSR package** (`@charleswiltgen/taglib-wasm`) - Uses minimal runtime
- **Import from** `mod.ts` - Provides API compatibility

## Future Improvements

1. **Implement actual WASM binding** - Connect fallback classes to WASM exports
2. **Add more Embind runtime features** - Support for more type conversions
3. **Create a proper Embind subset** - Implement the most commonly used features
4. **Generate bindings from C++** - Parse Embind declarations to generate JS