# Memory Management Audit Report for taglib-wasm

## Summary

I've conducted a thorough search for `_malloc` usage in the taglib-wasm codebase to identify any memory allocations that don't have proper try-finally blocks for cleanup. Here are the findings:

## Files with _malloc Usage

1. **src/workers.ts** - Line 387
2. **src/wasm-workers.ts** - Line 169
3. **src/deno-compile-loader.ts** - Line 68 (checking for _malloc existence only)
4. **src/wasm.ts** - Line 18 (interface definition only)
5. **build/taglib-wrapper.d.ts** - Generated file

## Analysis of Memory Allocations

### ✅ src/workers.ts (Lines 382-421)

**Status: PROPERLY HANDLED**

```typescript
let dataPtr: number;
try {
  if (this.module.allocate && this.module.ALLOC_NORMAL !== undefined) {
    dataPtr = this.module.allocate(buffer, this.module.ALLOC_NORMAL);
  } else {
    dataPtr = this.module._malloc(buffer.length);
    this.module.HEAPU8.set(buffer, dataPtr);
  }

  // ... use dataPtr ...

  // Free the temporary buffer copy (TagLib has made its own copy in ByteVector)
  this.module._free(dataPtr);

  return new AudioFileWorkers(this.module, fileId);
} catch (error) {
  // Always free allocated memory on error
  if (dataPtr) {
    this.module._free(dataPtr);
  }
  throw error;
}
```

This code properly handles memory cleanup with:

- Try-catch block to ensure cleanup on error
- Explicit `_free` call in the try block after use
- Cleanup in catch block if an error occurs

### ⚠️ src/wasm-workers.ts (Lines 161-179)

**Status: PARTIAL HANDLING**

```typescript
export function jsToCString(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");

  // Use allocate if available, otherwise use _malloc
  if (module.allocate && module.ALLOC_NORMAL !== undefined) {
    return module.allocate(bytes, module.ALLOC_NORMAL);
  } else {
    const ptr = module._malloc(bytes.length);
    try {
      module.HEAPU8.set(bytes, ptr);
      return ptr;
    } catch (error) {
      // Free memory if set operation fails
      module._free(ptr);
      throw error;
    }
  }
}
```

This function allocates memory but **returns the pointer to the caller**, who is responsible for freeing it. The function itself has proper error handling, but all callers must ensure they free the memory.

### ✅ Callers of jsToCString (Lines 140-201 in workers.ts)

**Status: PROPERLY HANDLED**

All callers of `jsToCString` properly use try-finally blocks:

```typescript
setTitle(title: string): void {
  if (this.tagPtr === 0) return;
  const titlePtr = jsToCString(this.module, title);
  try {
    this.module._taglib_tag_set_title?.(this.tagPtr, titlePtr);
  } finally {
    this.module._free(titlePtr);
  }
}
```

This pattern is correctly repeated for:

- `setTitle` (lines 138-146)
- `setArtist` (lines 152-160)
- `setAlbum` (lines 166-174)
- `setComment` (lines 180-188)
- `setGenre` (lines 194-202)

### ✅ src/deno-compile-loader.ts

**Status: NO ALLOCATION**

This file only checks for the existence of `_malloc` function as part of module validation. No actual memory allocation occurs.

### ✅ src/taglib.ts

**Status: NO DIRECT ALLOCATION**

The main taglib.ts file doesn't use `_malloc` directly. It uses the Embind API which handles memory management internally.

## Recommendations

1. **Document Memory Management Pattern**: The `jsToCString` function should have clear documentation that the caller is responsible for freeing the returned pointer.

2. **Consider a Wrapper Function**: For additional safety, consider creating a wrapper function that handles the allocation and cleanup:

```typescript
export async function withCString<T>(
  module: TagLibModule,
  str: string,
  fn: (ptr: number) => T,
): Promise<T> {
  const ptr = jsToCString(module, str);
  try {
    return await fn(ptr);
  } finally {
    module._free(ptr);
  }
}
```

3. **Add Memory Leak Tests**: Consider adding tests that verify memory is properly freed in all code paths.

## Conclusion

The memory management in the taglib-wasm codebase is **generally well-handled**. All direct `_malloc` calls have proper cleanup with try-finally blocks or try-catch blocks. The main area of concern is the `jsToCString` function which delegates cleanup responsibility to callers, but all current callers handle this correctly.

No memory leaks were identified in the current implementation.
