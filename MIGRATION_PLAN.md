# Embind Migration Plan

## Overview

This document outlines the plan to migrate taglib-wasm from the current dual implementation (C-style wrapper + Embind) to a single Embind-based implementation.

## Current State

### Two Parallel Implementations

1. **C-style Implementation** (Original)
   - Build script: `build/build-wasm.sh`
   - C++ wrapper: Inline in build script (lines 46-598)
   - TypeScript: `src/taglib.ts`, `src/wasm.ts`
   - Entry point: `index.ts`
   - Uses integer IDs for file handles
   - Manual memory management with allocate/free
   - Exports C functions like `_taglib_file_new_from_buffer`

2. **Embind Implementation** (New)
   - Build script: `build/build-wasm-embind.sh`
   - C++ wrapper: `build/taglib_embind.cpp`
   - TypeScript: `src/taglib-embind.ts`, `src/wasm-embind.ts`
   - Entry point: `index-embind.ts`
   - Uses JavaScript objects with proper lifetime management
   - Automatic memory management
   - Natural object-oriented API

### Additional Components

3. **Enhanced API** (Partially implemented)
   - File: `src/enhanced-api.ts`
   - Currently contains stubs and examples
   - Referenced types (AcoustIDInfo, MusicBrainzInfo, ReplayGainInfo) are not implemented
   - Needs to be completed or removed from exports

4. **JSR-specific Implementation**
   - Entry point: `mod.ts`
   - TypeScript: `src/taglib-jsr.ts`, `src/wasm-jsr.ts`
   - Uses direct WASM loading without Emscripten JS
   - Currently based on C-style implementation
   - Will need to be updated to work with Embind

### Key Differences

1. **Memory Management**
   - C-style: Manual with `allocate()`, `_malloc()`, `_free()`
   - Embind: Automatic with JavaScript GC

2. **API Design**
   - C-style: Function calls with integer IDs (`_taglib_tag_title(tagPtr)`)
   - Embind: Object methods (`tag.title()`)

3. **String Handling**
   - C-style: Manual UTF8 conversion with pointers
   - Embind: Automatic string conversion

4. **File Loading**
   - C-style: Uses `allocate()` for proper memory transfer
   - Embind: Uses binary string conversion

## Migration Tasks

### Phase 1: Feature Parity Check ✅

1. **Core Functionality** (Both implementations have):
   - [x] File loading from buffer
   - [x] Basic tag reading/writing (title, artist, album, etc.)
   - [x] Audio properties (duration, bitrate, sampleRate, channels)
   - [x] File format detection
   - [x] Save functionality
   - [x] Property map support
   - [x] MP4-specific operations

2. **Missing in Embind** (None - feature complete)

### Phase 2: API Compatibility Layer

Create a compatibility layer to maintain backward compatibility:

1. **Create `src/taglib-compat.ts`**
   - Wraps Embind API to match current C-style API
   - Maintains same exports and interfaces
   - Allows gradual migration

2. **Update `src/taglib.ts`**
   - Import from Embind implementation
   - Add compatibility wrapper for AudioFile class
   - Keep same public API

### Phase 3: Update Build System

1. **Merge build scripts**
   - Make `build-wasm.sh` use Embind approach
   - Remove C-style wrapper code
   - Keep same output files

2. **Update TypeScript compilation**
   - Ensure `taglib.js` exports match expected format
   - Update module loading in `src/wasm.ts`

### Phase 4: Update Tests

1. **Consolidate test files**
   - Merge test-systematic.ts with test-embind.ts
   - Ensure all tests pass with Embind implementation
   - Remove duplicate test files

2. **Update examples**
   - Ensure all examples work with new implementation
   - Update documentation in examples

### Phase 5: Clean Up

1. **Remove old files**
   - `build/build-wasm-embind.sh` (merge into main)
   - `src/taglib-embind.ts` (becomes main)
   - `src/wasm-embind.ts` (becomes main)
   - `index-embind.ts` (merge into index.ts)
   - Old test files

2. **Update documentation**
   - Update README
   - Update API documentation
   - Archive Embind-Migration.md

3. **Fix Enhanced API**
   - Either implement the missing types (AcoustIDInfo, MusicBrainzInfo, ReplayGainInfo)
   - Or remove the exports from index-embind.ts
   - Complete the stub implementations in enhanced-api.ts

## Implementation Steps

### Step 1: Create Compatibility Layer

```typescript
// src/taglib-compat.ts
export class AudioFile {
  private fileHandle: any;
  
  constructor(module: TagLibModule, fileHandle: any) {
    this.fileHandle = fileHandle;
  }
  
  isValid(): boolean {
    return this.fileHandle.isValid();
  }
  
  format(): AudioFormat {
    return this.fileHandle.getFormat();
  }
  
  tag(): Tag {
    const tagWrapper = this.fileHandle.getTag();
    return {
      title: tagWrapper.title() || undefined,
      artist: tagWrapper.artist() || undefined,
      // ... etc
    };
  }
  
  // ... implement all current methods
}
```

### Step 2: Update Main TagLib Class

```typescript
// src/taglib.ts
export class TagLib {
  async openFile(buffer: ArrayBuffer): Promise<AudioFile> {
    const fileHandle = new this.module.FileHandle();
    const binaryString = /* convert buffer */;
    if (!fileHandle.loadFromBuffer(binaryString)) {
      throw new Error("Failed to load file");
    }
    return new AudioFile(this.module, fileHandle);
  }
}
```

### Step 3: Update Build Script

Merge the Embind build script into the main one, replacing the inline C++ code.

### Step 4: Test Everything

Run all tests to ensure compatibility is maintained.

### Step 5: Handle JSR Compatibility

Since JSR doesn't allow generated JavaScript files and Embind requires them, we have several options:

#### Option 1: Dual WASM Builds (Recommended)
- Keep both C-style and Embind exports in the same WASM binary
- Use Embind for NPM (with generated JS)
- Use C-style functions for JSR (direct WASM)
- Minimal overhead, maximum compatibility

#### Option 2: Conditional Loading
- Detect runtime environment
- Load appropriate implementation
- More complex but cleaner separation

#### Option 3: Pure WASM for JSR
- Create a separate minimal WASM build for JSR
- Only include C-style exports
- Smallest size for JSR users

## Benefits of Migration

1. **Code Reduction**: Remove ~600 lines of C++ wrapper code
2. **Simpler API**: Natural JavaScript object model
3. **Better Memory Management**: No manual cleanup needed
4. **Type Safety**: Better TypeScript integration
5. **Maintainability**: Easier to extend and modify

## Risks and Mitigation

1. **Breaking Changes**
   - Mitigation: Compatibility layer maintains exact same API
   - All existing code continues to work

2. **Performance**
   - Embind adds small overhead (~5-10%)
   - Mitigation: Benefits outweigh small performance cost

3. **Binary Size**
   - Embind adds ~50-100KB to WASM
   - Mitigation: Still reasonable for web use

4. **JSR Compatibility**
   - Issue: JSR doesn't allow generated JS files, but Embind requires them
   - Mitigation: Keep C-style exports in WASM for JSR-specific implementation
   - Alternative: Use dynamic imports or conditional loading for JSR

## Timeline

- Phase 1: ✅ Complete (feature parity confirmed)
- Phase 2: 2-3 hours (compatibility layer)
- Phase 3: 1-2 hours (build system)
- Phase 4: 1-2 hours (tests)
- Phase 5: 1 hour (cleanup)

Total: ~6-8 hours of work

## Success Criteria

1. All existing tests pass
2. All examples continue to work
3. No breaking changes to public API
4. Single implementation reduces maintenance burden
5. Documentation updated to reflect new internals

## Next Steps

1. Review this plan
2. Create feature branch for migration
3. Implement compatibility layer
4. Test thoroughly
5. Merge and release as minor version (no breaking changes)