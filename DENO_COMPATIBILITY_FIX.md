# Deno Compatibility Fix for taglib-wasm

## Problem Summary

The taglib-wasm npm package (v0.3.19) was incompatible with Deno due to several issues:

1. **Environment Detection**: The Emscripten-generated code incorrectly detected Deno as Node.js because Deno has a `process` object
2. **Node.js-specific imports**: The code tried to use `createRequire` and Node.js modules (`fs`, `path`, `url`) which don't work in Deno
3. **WebAssembly initialization**: The error "RangeError: WebAssembly.Table.get(): invalid address" occurred due to improper environment handling

## Root Cause

The Emscripten-generated `taglib-wrapper.js` file uses this logic:

```javascript
var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
if (ENVIRONMENT_IS_NODE) {
  const { createRequire } = await import("module");
  var require = createRequire(import.meta.url);
  // ... uses require("fs"), require("path"), etc.
}
```

Since Deno has a `process` object (for Node.js compatibility), it gets detected as Node.js, but then fails when trying to use Node.js-specific features.

## Solution

Created comprehensive Deno compatibility patches that:

1. **Properly detect Deno**: Add `ENVIRONMENT_IS_DENO` check before `ENVIRONMENT_IS_NODE`
2. **Avoid Node.js imports in Deno**: Only use `createRequire` when actually in Node.js
3. **Use Deno APIs**: Use `Deno.readFile()` and `fetch()` for file operations in Deno
4. **Fix WebAssembly loading**: Ensure proper environment checks for Wasm instantiation

## Implementation

### 1. Created `scripts/fix-deno-compat.js`
- Patches the source `build/taglib-wrapper.js` after Emscripten compilation
- Applied during the build process

### 2. Created `scripts/fix-deno-compat-dist.js`
- Patches the distributed `dist/taglib-wrapper.js` 
- Applied during the postbuild process

### 3. Updated build scripts
- `build/build-wasm.sh`: Uses the new compatibility fix instead of simple sed command
- `scripts/postbuild.js`: Applies fixes to distributed files

## Testing

Created `scripts/test-deno-npm-compat.ts` to verify:
- Local build works with Deno
- npm package works with Deno
- Simple API functions correctly

## Files Changed

1. `scripts/fix-deno-compat.js` - Main compatibility fix script
2. `scripts/fix-deno-compat-dist.js` - Distribution-specific fix script
3. `build/build-wasm.sh` - Updated to use new fix
4. `scripts/postbuild.js` - Updated to apply fixes to dist
5. `scripts/test-deno-npm-compat.ts` - Test script for verification

## Result

After applying these fixes, taglib-wasm will work correctly in Deno when imported from npm, resolving the WebAssembly initialization errors and Node.js-specific import failures.