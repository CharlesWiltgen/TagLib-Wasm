# BACKLOG.md

## 🚨 Critical Issues - Must Fix

These are blocking issues that prevent the library from working properly.

### 1. Split Large Files to Comply with Code Standards

- **Priority**: CRITICAL
- **Issue**: Files exceed the 250-line limit per CLAUDE.md guidelines
- **Files**:
  - `src/taglib.ts` (1229 lines) - Exceeds limit by 979 lines
  - `src/types.ts` (639 lines) - Exceeds limit by 389 lines
  - `src/errors.ts` (264 lines) - Slightly over by 14 lines
- **Tasks**:
  - Extract interface definitions from `taglib.ts` into separate files
  - Move metadata mapping logic from `types.ts` to a dedicated module
  - Consider splitting error classes into separate files by category
- **Impact**: Compliance with SonarQube metrics, better maintainability

### 2. Implement Proper Memory Management

- **Priority**: CRITICAL
- **Issue**: Missing try-finally blocks for WebAssembly memory cleanup
- **Current Pattern** (incorrect):

  ```typescript
  dataPtr = this.module._malloc(buffer.length);
  this.module.HEAPU8.set(buffer, dataPtr);
  // ... operations ...
  // No explicit _free() call found
  ```

- **Required Pattern**:

  ```typescript
  const ptr = module._malloc(data.length);
  try {
    module.HEAPU8.set(data, ptr);
    // Process data
    return result;
  } finally {
    module._free(ptr);
  }
  ```

- **Tasks**:
  - Audit all `_malloc()` usage in the codebase
  - Add try-finally blocks to ensure `_free()` is always called
  - Update workers.ts, taglib.ts, and any other files using direct memory allocation
- **Impact**: Prevent memory leaks, better resource management

## 🔧 High Priority Improvements

These should be addressed before widespread adoption to improve developer experience.

## 🧪 Testing Infrastructure Improvements

### Current Test Status (as of 2025-01-14)

- **Problem**: RESOLVED - Test suite now runs successfully in Deno
- **Solution**: Added sed patch in build script to convert `import("module")` to `import("node:module")`
- **Tests Status**:
  - 25/25 tests passing
  - Test coverage includes: Core API, Simple API, Workers API, Performance, Format tests, Integration tests
  - All audio formats (WAV, MP3, FLAC, OGG, M4A) working correctly

## 📚 Medium Priority - Documentation & Distribution

### 5. Document Memory Management

- **Priority**: MEDIUM
- **Tasks**:
  - Document what happens without `dispose()`
  - Add best practices for long-running applications
  - Document memory usage patterns with large files
  - Add memory leak detection examples

### 6. Add Bundle Size Documentation

- **Priority**: MEDIUM
- **Tasks**:
  - Document 370KB WASM file impact
  - Add lazy loading strategies
  - Provide CDN hosting recommendations
  - Show code splitting examples

### 7. Fix Package Author Information

- **Priority**: MEDIUM
- **Issue**: package.json has placeholder author info
- **Tasks**:
  - Update author field in package.json
  - Ensure consistent author info across all package files

### 8. Add Migration Guides

- **Priority**: LOW
- **Tasks**:
  - Create migration guide from node-taglib
  - Create migration guide from music-metadata
  - Add comparison table with other libraries

### 9. Add Performance Benchmarks

- **Priority**: LOW
- **Tasks**:
  - Benchmark processing time for different file sizes
  - Compare with native libraries
  - Document memory usage patterns
  - Test performance across runtimes

## 🚀 Future Directions

### 10. Leverage Web Audio API for ReplayGain Tag Creation

- **Priority**: FUTURE - Research/Planning
- **Concept**: Integrate ReplayGain analysis with Web Audio API's native decoders for efficient client-side loudness calculation
- **Architecture**:
  - Web Audio API handles audio decoding (MP3, AAC, FLAC, etc.) using browser's optimized native decoders
  - Pass decoded PCM data (Float32Array) from AudioBuffer to TagLib-Wasm
  - TagLib-Wasm performs ReplayGain calculations (K-weighting, RMS, LUFS gating)
  - Return calculated gain/peak values to JavaScript for tag writing
- **Implementation Plan**:
  1. **Audio Decoding Layer**:
     - Use `AudioContext.decodeAudioData()` for format-agnostic decoding
     - Leverage `OfflineAudioContext` for faster-than-realtime processing
     - Extract channel data as Float32Arrays from AudioBuffer
  2. **Wasm Analysis Module**:
     - Implement ITU-R BS.1770 algorithm in C++ (K-weighting filter, gating, integration)
     - Export `analyzeReplayGain(channel1Data, channel2Data, sampleRate)` function
     - Calculate track gain (dB) and peak amplitude values
  3. **JavaScript Integration**:
     - Create high-level API: `await calculateReplayGain(file)`
     - Handle file → ArrayBuffer → AudioBuffer → analysis pipeline
     - Write calculated values back to file metadata
- **Benefits**:
  - Eliminates need for bundling audio decoders (libavcodec, FFmpeg) in Wasm
  - Leverages browser's hardware-accelerated, optimized decoders
  - Smaller Wasm bundle size (analysis code only, not decoders)
  - Clean separation of concerns (browser: I/O & decoding, Wasm: computation)
  - Works with any format the browser can decode
- **Technical Requirements**:
  - Expose raw PCM data interface in TagLib-Wasm
  - Implement ReplayGain 2.0 algorithm (EBU R128 based)
  - Support both track and album gain calculations
  - Handle mono/stereo/multichannel audio
  - Efficient memory transfer between JavaScript and Wasm
- **Use Cases**:
  - Web-based music players with client-side normalization
  - Online mastering tools and DAWs
  - Batch processing tools for music libraries
  - Privacy-preserving audio analysis (no server upload needed)
- **Challenges**:
  - Memory constraints for very large files (may need streaming approach)
  - Cross-browser AudioContext compatibility
  - Performance optimization for batch processing
- **Estimated Effort**: Medium-High (requires ReplayGain algorithm implementation)

### 11. WebAssembly Port of rsgain (ReplayGain Analysis)

- **Priority**: FUTURE - Research/Experiment
- **Concept**: Port rsgain (ReplayGain 2.0 scanner) to WebAssembly for client-side loudness analysis
- **Benefits**:
  - Enable ReplayGain analysis directly in browsers without server infrastructure
  - Privacy-preserving (audio never leaves user's device)
  - Direct integration with web audio applications and DAWs
  - Universal deployment without platform-specific binaries
- **Challenges**:
  - Performance would be 2-4x slower than native (but likely acceptable)
  - Would need to replace FFmpeg with lightweight decoders (e.g., dr_libs, minimp3)
  - Memory constraints for very large files
  - No effective multithreading compared to native rsgain
- **Use Cases**:
  - Web-based music players wanting client-side normalization
  - Online audio editors/DAWs
  - Educational tools demonstrating loudness concepts
  - Processing small to medium files (< 100MB)
- **Technical Requirements**:
  - Implement ITU-R BS.1770 algorithm (K-weighting, gating, integration)
  - Support basic ReplayGain tags (track/album gain and peak)
  - Make computationally expensive features (true peak) optional
  - Target bundle size < 1MB
- **Impact**: Would fill a gap in the web audio ecosystem - currently no browser-based ReplayGain analysis exists

---

## ReplayGain 2 Calculation Feature

### Overview

Add ReplayGain 2.0 calculation capabilities to taglib-wasm, enabling loudness normalization analysis directly in JavaScript environments. ReplayGain 2.0 uses the EBU R128/ITU BS.1770 standard for perceptual loudness measurement, providing more accurate results than the original ReplayGain specification.

**Key Benefits:**

- Client-side loudness analysis without server infrastructure
- Privacy-preserving (audio never leaves user's device)
- Consistent loudness across music libraries
- Support for both track and album normalization

### Background

ReplayGain 2.0 measures audio loudness using:

- **ITU-R BS.1770-4**: Defines the K-weighting filter and loudness measurement algorithm
- **EBU R128**: Specifies -23 LUFS as the target loudness level
- **Gating**: Excludes silence (< -70 LUFS) and quiet passages (< -10 LU relative)
- **True Peak**: Prevents clipping by measuring inter-sample peaks

### Implementation Options

#### Option A: Integrate ebur128-wasm (Recommended for Quick Implementation)

**Approach**: Use the existing `ebur128-wasm` npm package, which provides a Rust-based EBU R128 implementation compiled to WebAssembly.

**Pros:**

- Immediate availability - can be integrated quickly
- Well-tested Rust implementation
- Small footprint (~200KB)
- Handles the complex loudness algorithm correctly

**Cons:**

- Additional dependency
- Limited customization options
- Requires audio to be decoded first

**Implementation Steps:**

1. Add `ebur128-wasm` as a dependency
2. Create adapter layer to bridge with taglib-wasm's API
3. Handle audio decoding before analysis
4. Write calculated values back to file metadata

**Example Integration:**

```typescript
import { analyzeReplayGain } from './replaygain';

// Add to AudioFile class
async calculateReplayGain(): Promise<ReplayGainInfo> {
  const pcmData = await this.decodeToPCM();
  return analyzeReplayGain(pcmData, this.sampleRate);
}

// Add to Simple API
export async function calculateAndWriteReplayGain(
  path: string | Uint8Array
): Promise<void> {
  const file = await taglib.open(path);
  try {
    const replayGain = await file.calculateReplayGain();
    await file.tag.setReplayGainTrackGain(replayGain.trackGain);
    await file.tag.setReplayGainTrackPeak(replayGain.trackPeak);
    await file.save();
  } finally {
    file.dispose();
  }
}
```

#### Option B: Port libebur128 to WebAssembly (Recommended for Full Control)

**Approach**: Compile the C library libebur128 to WebAssembly and integrate directly into taglib-wasm.

**Pros:**

- Full control over implementation
- Can optimize for taglib-wasm's architecture
- No external dependencies
- Can be customized for specific needs

**Cons:**

- More development effort required
- Need to maintain the port
- Larger initial time investment

**Implementation Steps:**

1. Add libebur128 as a git submodule
2. Modify build-wasm.sh to compile libebur128
3. Create C++ wrapper functions for Emscripten
4. Expose through taglib-wasm's existing API

**Build Integration:**

```bash
# In build-wasm.sh
echo "Building libebur128..."
emcc -O3 -s WASM=1 \
  lib/libebur128/ebur128/ebur128.c \
  -I lib/libebur128/ebur128 \
  -c -o build/ebur128.o

# Link with taglib
emcc ... build/ebur128.o ...
```

#### Option C: Web Audio API + Custom Analysis (Recommended for Browsers)

**Approach**: Leverage the Web Audio API for audio decoding in browsers, passing decoded PCM to a custom WebAssembly analysis module.

**Pros:**

- Uses browser's optimized, hardware-accelerated decoders
- No need to bundle audio decoders in Wasm
- Smaller Wasm footprint
- Works with any format the browser supports

**Cons:**

- Browser-only solution
- Requires fallback for Node.js/Deno
- More complex implementation

**Architecture:**

```typescript
// Browser implementation
class BrowserReplayGainAnalyzer {
  private audioContext: OfflineAudioContext;

  async analyze(file: File | Blob): Promise<ReplayGainInfo> {
    // 1. Decode audio using Web Audio API
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // 2. Extract PCM data
    const channelData = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }

    // 3. Pass to Wasm analyzer
    return this.wasmAnalyzer.calculateLoudness(
      channelData,
      audioBuffer.sampleRate,
    );
  }
}

// Server implementation (Node.js/Deno)
class ServerReplayGainAnalyzer {
  async analyze(buffer: Uint8Array): Promise<ReplayGainInfo> {
    // Use taglib to decode audio
    const pcmData = await this.decodeWithTagLib(buffer);
    return this.wasmAnalyzer.calculateLoudness(
      pcmData.channels,
      pcmData.sampleRate,
    );
  }
}
```

### Proposed API Design

#### Core API Extensions

```typescript
// In AudioFile class
interface AudioFile {
  // ... existing methods ...

  /**
   * Calculate ReplayGain values for this audio file
   * @returns Promise resolving to track gain and peak values
   */
  calculateReplayGain(): Promise<ReplayGainInfo>;

  /**
   * Decode audio to PCM for analysis
   * @returns Promise resolving to PCM data
   */
  decodeToPCM(): Promise<PCMData>;
}

interface ReplayGainInfo {
  /** Track gain in dB (typically negative) */
  trackGain: number;
  /** Track peak value (0.0 to 1.0) */
  trackPeak: number;
  /** LUFS loudness value */
  loudness: number;
}

interface PCMData {
  /** Audio channels as Float32Arrays */
  channels: Float32Array[];
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of samples per channel */
  length: number;
}
```

#### Simple API Extensions

```typescript
/**
 * Calculate and write ReplayGain tags to an audio file
 * @param path Path to audio file or buffer
 * @param options Analysis options
 */
export async function calculateReplayGain(
  path: string | Uint8Array,
  options?: ReplayGainOptions,
): Promise<ReplayGainInfo>;

/**
 * Calculate album ReplayGain for multiple tracks
 * @param paths Array of file paths or buffers
 * @param options Analysis options
 */
export async function calculateAlbumReplayGain(
  paths: (string | Uint8Array)[],
  options?: ReplayGainOptions,
): Promise<AlbumReplayGainInfo>;

interface ReplayGainOptions {
  /** Write calculated values to file (default: true) */
  writeTags?: boolean;
  /** Calculate true peak (slower but more accurate) */
  calculateTruePeak?: boolean;
  /** Target loudness in LUFS (default: -18 for ReplayGain 2.0) */
  targetLoudness?: number;
}

interface AlbumReplayGainInfo {
  /** Individual track results */
  tracks: ReplayGainInfo[];
  /** Album gain in dB */
  albumGain: number;
  /** Album peak (max of all track peaks) */
  albumPeak: number;
}
```

### Technical Requirements

#### Algorithm Implementation

1. **K-weighting Filter**:
   - Stage 1: High-frequency shelf filter (4.0 dB boost above 1500 Hz)
   - Stage 2: High-pass filter (RLB weighting curve)

2. **Loudness Calculation**:
   - Mean square of filtered samples over blocks
   - 400ms blocks for momentary loudness
   - 3-second blocks for short-term loudness
   - Gated integration for overall loudness

3. **Gating**:
   - Absolute gate: -70 LUFS (silence removal)
   - Relative gate: -10 LU below ungated loudness

4. **True Peak Detection** (optional):
   - 4x oversampling
   - Measure inter-sample peaks
   - Prevent digital clipping

#### Memory Considerations

- Process audio in chunks for large files
- Reuse buffers where possible
- Clear intermediate data promptly
- Provide streaming API for very large files

### Implementation Phases

#### Phase 1: Basic Integration (1-2 weeks)

- Integrate ebur128-wasm for proof of concept
- Add basic ReplayGain calculation to Core API
- Implement Simple API wrappers
- Add tests for accuracy

#### Phase 2: Native Implementation (3-4 weeks)

- Port libebur128 to WebAssembly
- Integrate with build system
- Replace ebur128-wasm with native implementation
- Optimize performance

#### Phase 3: Browser Optimization (2-3 weeks)

- Implement Web Audio API decoder integration
- Add OfflineAudioContext for faster processing
- Create unified API across environments
- Add progress callbacks for long operations

#### Phase 4: Advanced Features (2-3 weeks)

- Album gain calculation
- Batch processing optimization
- Streaming analysis for large files
- True peak detection option

### Testing Strategy

1. **Accuracy Tests**:
   - Compare with reference implementations (ffmpeg, rsgain)
   - Test with EBU test vectors
   - Verify gating behavior

2. **Performance Tests**:
   - Benchmark against native tools
   - Memory usage profiling
   - Large file handling

3. **Integration Tests**:
   - Test with all supported audio formats
   - Verify tag writing correctness
   - Cross-runtime compatibility

### Challenges and Solutions

#### Challenge 1: Audio Decoding

- **Browser**: Use Web Audio API
- **Node.js/Deno**: Need separate decoder
- **Solution**: Abstract decoder interface with runtime-specific implementations

#### Challenge 2: Performance

- **Issue**: JavaScript processing can be slow
- **Solution**: Move heavy computation to WebAssembly
- **Optimization**: Process in chunks, use Web Workers

#### Challenge 3: Memory Usage

- **Issue**: Large files may exceed memory
- **Solution**: Implement streaming analysis
- **Fallback**: Provide file size warnings

#### Challenge 4: Accuracy

- **Issue**: Floating-point differences between implementations
- **Solution**: Use reference test vectors
- **Tolerance**: Allow small variations (< 0.1 dB)

### Success Metrics

- Calculation accuracy within 0.1 dB of reference
- Performance within 2-4x of native implementation
- Memory usage under 50MB for typical files
- Support for 95% of common audio formats
- Zero crashes on invalid input

### Alternative Approaches Considered

1. **Pure JavaScript Implementation**: Too slow for practical use
2. **Server-Side Only**: Defeats purpose of client-side library
3. **FFmpeg Integration**: Too large, licensing concerns
4. **External Service**: Privacy concerns, requires internet

### References

- [EBU R128 Specification](https://tech.ebu.ch/docs/r/r128.pdf)
- [ITU-R BS.1770-4](https://www.itu.int/rec/R-REC-BS.1770-4-201510-I)
- [libebur128 GitHub](https://github.com/jiixyj/libebur128)
- [ReplayGain 2.0 Specification](https://wiki.hydrogenaud.io/index.php?title=ReplayGain_2.0_specification)

---

## Making taglib-wasm More "Deno 2 Native"

This document tracks potential improvements to make the project more native to the Deno 2 ecosystem.

### Top Priority Improvements

#### 1. Consolidate to Single Distribution

- **Goal**: Eliminate the NPM/JSR dual distribution complexity
- **Tasks**:
  - Keep only JSR distribution with a single implementation
  - Remove duplicate files (`taglib.ts`/`taglib-jsr.ts`, `simple.ts`/`simple-jsr.ts`)
  - Remove `index.ts` and keep only `mod.ts`
  - Node.js users can use `npx jsr add @charleswiltgen/taglib-wasm`
- **Impact**: Major simplification of codebase and maintenance

#### 2. Implement Native Wasm Loading

- **Goal**: Replace Emscripten's JavaScript wrapper with native WebAssembly APIs
- **Tasks**:
  - Implement direct `WebAssembly.instantiate()` for Wasm loading
  - Load the .wasm file as a static asset using Deno's file APIs
  - Remove dependency on generated JavaScript (`taglib.js`)
  - Update `taglib-jsr.ts` to actually work instead of throwing error
- **Impact**: Remove ~500KB of generated JavaScript, more idiomatic Deno code

#### 3. Remove TypeScript Compilation Step

- **Goal**: Leverage Deno's native TypeScript support
- **Tasks**:
  - Delete `tsconfig.json`
  - Remove the `build:ts` npm script
  - Let Deno handle TypeScript natively
  - Use `deno check` for type checking
- **Impact**: Simpler build process, faster development

#### 4. Simplify Module Structure

- **Goal**: Single implementation that works everywhere
- **Tasks**:
  - Merge all duplicate implementations
  - Create unified API that works across all runtimes
  - Use feature detection instead of separate builds
- **Impact**: Easier maintenance, less code duplication

### Secondary Improvements

#### 5. Enhance Deno Test Framework Usage

- **Goal**: Fully leverage Deno's built-in test framework
- **Tasks**:
  - Refactor tests to use `Deno.test()` with proper test steps and sub-tests
  - Add test coverage with `deno test --coverage`
  - Use built-in assertions like `assertSnapshot()` for output comparison
  - Add granular permissions per test
  - Consider using Deno's benchmark tool for performance testing
- **Impact**: Better test organization, coverage tracking

#### 6. Modernize Build Process

- **Goal**: Replace shell scripts with Deno-native tooling
- **Tasks**:
  - Convert `build-wasm.sh` to a Deno TypeScript script
  - Use Deno's subprocess API for Emscripten compilation
  - Make builds cross-platform without shell dependencies
  - Use Deno scripts for build orchestration
- **Impact**: Cross-platform builds, better error handling

#### 7. Native Documentation Generation

- **Goal**: Use Deno's built-in documentation tools
- **Tasks**:
  - Use `deno doc` for API documentation generation
  - Host documentation on deno.land/x or similar Deno-native platforms
  - Remove external documentation tooling
- **Impact**: Automatic API docs, better integration with Deno ecosystem

#### 8. Remove Node.js Patterns

- **Goal**: Eliminate Node.js-specific code and dependencies
- **Tasks**:
  - Delete `package.json` (keep minimal version only for NPM publish if needed)
  - Remove `@types/node` dependency
  - Use `deno task` exclusively instead of npm scripts
  - Remove Node.js-specific test runners
- **Impact**: Cleaner dependency tree, more idiomatic Deno project

### Additional Considerations

#### 9. Improved Import Maps Usage

- Expand import maps beyond standard library
- Map internal imports for cleaner paths
- Use import maps for version management
- Consider workspace features for monorepo management

#### 10. Better Permission System Integration

- Add granular permissions in `deno.json`
- Use permission queries in code for better error messages
- Document required permissions for different use cases

#### 11. Deno Deploy Compatibility

- Ensure Wasm module works with Deno Deploy constraints
- Add deployment examples
- Consider using Deno KV for caching processed metadata

#### 12. Module Resolution Improvements

- Use `https://` imports for external dependencies where appropriate
- Consider using `npm:` specifiers for NPM compatibility
- Use `node:` specifiers for Node.js built-in compatibility

### Migration Strategy

1. **Phase 1**: Implement native Wasm loading (Priority 2)
2. **Phase 2**: Consolidate to single distribution (Priority 1)
3. **Phase 3**: Remove TypeScript compilation and simplify modules (Priorities 3 & 4)
4. **Phase 4**: Implement remaining improvements incrementally

### Notes

- Each change should maintain backward compatibility where possible
- Consider deprecation periods for breaking changes
- Prioritize changes that reduce complexity while maintaining functionality
- The goal is to make the project feel native to Deno while keeping it accessible

---

## 📋 CLAUDE.md Compliance Status

### Summary (as of 2025-06-24)

- **Overall Compliance**: 33% of critical items completed
- **Last Review**: CLAUDE_REVIEW_REPORT.md (2025-06-23)

### ✅ Completed

1. **Enum Replacement** (2025-06-23)
   - Replaced all enums with union types
   - Updated `TagLibErrorCode` and `PictureType`
   - Fixed all imports and type references

2. **Error Message Style Guide**
   - Already compliant with colon usage
   - Proper context inclusion
   - Consistent formatting

### ❌ Remaining High Priority

1. **Split Large Files** - See Critical Issues #1
2. **Memory Management** - See Critical Issues #2

### 🔍 To Be Verified

1. **SonarQube Metrics** - Need to run analysis for exact complexity scores
2. **Test Coverage** - Target: 80% minimum
3. **Function Complexity** - Some functions may exceed cognitive complexity limits

## ✅ Completed Items

### 2025-01-14

#### Deno Runtime Compatibility Fix ✅

- **Completed**: 2025-01-14
- **Issue**: The generated `taglib.js` file contained Node.js-specific imports that broke in Deno
- **Error**: `TypeError: Relative import path "module" not prefixed with / or ./ or ../`
- **Implementation**:
  - Added sed patch in `build-wasm.sh` to convert `import("module")` to conditional import
  - Patch changes to: `import(typeof Deno!=="undefined"?"node:module":"module")`
  - Removed unused `deno-compat.js` pre-js file
- **Result**: All 25 tests now pass successfully in Deno without module loading errors

#### Test Suite Consolidation ✅

- **Completed**: 2025-01-14
- **Implementation**:
  - Consolidated `test-systematic.ts` and `test-integration.ts` into single `taglib.test.ts`
  - Updated test commands in package.json
  - Fixed import paths and TypeScript issues
- **Result**: Single comprehensive test file following KISS principle
- **Issue Discovered**: Tests cannot run in Deno due to module loading compatibility issue

#### BACKLOG Reorganization ✅

- **Completed**: 2025-01-14
- **Implementation**:
  - Reorganized BACKLOG.md with clear priority sections
  - Added critical Deno compatibility issue as top priority
  - Documented current test infrastructure status
- **Result**: Clearer task prioritization and tracking

#### Implement Buffer Return in writeTags() ✅

- **Completed**: 2025-01-14
- **Implementation**: Updated `writeTags()` in `simple.ts` to call `audioFile.getFileBuffer()` after saving
- **Result**: Now correctly returns the modified buffer instead of the original

#### Add Method to Get Modified Buffer from Core API ✅

- **Completed**: 2025-01-14
- **Implementation**:
  - Added `getBuffer()` method to C++ FileHandle class in `taglib_embind.cpp`
  - Exposed via Embind bindings
  - Added `getFileBuffer()` method to TypeScript AudioFile class
  - Converts C++ string buffer to Uint8Array for JavaScript consumption
- **Result**: Core API now provides access to modified file data after save operations

### 2025-01-15

#### Add Comprehensive API Documentation ✅

- **Completed**: 2025-01-15
- **Implementation**:
  - Added JSDoc comments to all public APIs in Core API (taglib.ts)
  - Enhanced documentation in Simple API (simple.ts)
  - Added comprehensive JSDoc to Workers API (workers.ts)
  - Documented all type definitions (types.ts)
  - Added module-level documentation to main entry point (index.ts)
- **Details**:
  - Included `@param`, `@returns`, `@throws`, `@example` tags
  - Documented error conditions and edge cases
  - Added usage examples for all major functions
  - Enhanced type documentation with examples
- **Result**: All public APIs now have comprehensive JSDoc documentation for better developer experience

### 2025-01-15 (continued)

#### Improve Error Messages with Context ✅

- **Completed**: 2025-01-15
- **Implementation**:
  - Created custom error types in `src/errors.ts` with specific error codes
  - Added error types: InvalidFormatError, UnsupportedFormatError, FileOperationError, MetadataError, etc.
  - Each error includes contextual information like file size, format, operation type
  - Error messages now provide helpful hints and debugging information
  - Added type guards for programmatic error handling
- **Updates**:
  - Updated all core APIs (taglib.ts, simple.ts, workers.ts) to use new error types
  - Added comprehensive error handling tests
  - Updated README with error handling documentation and examples
- **Result**: Developers now get detailed, actionable error messages that help them quickly identify and fix issues

### 2025-01-16

#### Fix Unicode String Handling ✅

- **Completed**: 2025-01-16
- **Issue**: Writing non-ASCII Unicode characters (emoji, CJK, RTL text) corrupted audio files
- **Root Cause**: The C++ wrapper was using `to8Bit(true)` which is lossy for Unicode characters
- **Solution**:
  - Changed all string conversions from `to8Bit(true)` to `toCString(true)` in taglib_embind.cpp
  - `toCString(true)` properly handles UTF-8 encoding for all Unicode characters
  - Wrapped results in `std::string()` to satisfy Emscripten's type requirements
- **Result**: All Unicode tests now pass - emoji, CJK characters, RTL text, and mixed scripts work correctly
- **Impact**: Critical fix for international users - the library now fully supports Unicode metadata

### 2025-01-15 (continued)

#### Add Edge Case Testing ✅

- **Completed**: 2025-01-15
- **Issue**: Tests only covered happy path scenarios
- **Implementation**:
  - Created `tests/edge-cases.test.ts` with comprehensive edge case coverage
  - Added Unicode handling tests (emoji, CJK, RTL text, special characters)
  - Added input validation tests (null/undefined, wrong types, empty buffers)
  - Added tests for non-audio data and corrupted files
  - Added illegal audio properties tests
  - Fixed buffer handling issue in `simple.ts` where `.buffer` property could reference larger ArrayBuffer
- **Known Limitations Discovered**:
  - Writing non-ASCII Unicode characters (emoji, CJK, RTL) to tags currently causes file corruption
  - This appears to be a limitation in the TagLib Wasm implementation's string handling
  - Tests document this behavior and will need updating when Unicode support is fixed
- **Result**: 14 new edge case tests added, all passing; edge cases are now properly handled with appropriate errors

---

## 🔍 Project Improvements - January 2025 Review

This section captures improvement opportunities identified during a comprehensive project review.

### Project Organization

#### 1. Consolidate Documentation Structure

- **Priority**: MEDIUM
- **Issue**: Multiple README.md files scattered across subdirectories create confusion
- **Current State**:
  - `/README.md` (main project readme)
  - `/docs/README.md`
  - `/docs/guide/README.md`
  - `/examples/README.md`
  - `/examples/workers/README.md`
  - `/tests/README.md`
  - `/tests/test-files/README.md`
- **Tasks**:
  - Keep only the main README.md
  - Convert subdirectory READMEs to appropriately named files (e.g., `docs/index.md`)
  - Update navigation and links accordingly
- **Impact**: Clearer documentation hierarchy, easier navigation

#### 2. Clean Up Build Artifacts

- **Priority**: MEDIUM
- **Issue**: Generated files and build artifacts in version control
- **Tasks**:
  - Add `dist/` directory to `.gitignore`
  - Consider whether `build/taglib.js` and `build/taglib.wasm` should be in git
  - Clean up `node_modules` references in subdirectories
- **Impact**: Cleaner repository, smaller clone size

#### 3. Simplify Test File Organization

- **Priority**: MEDIUM
- **Issue**: Test files mixed with documentation and utilities
- **Current State**:
  - Test files at multiple levels
  - `IMPROVEMENTS.md` mixed with test files
  - Utility scripts mixed with tests
- **Tasks**:
  - Move `tests/IMPROVEMENTS.md` to `docs/` or BACKLOG
  - Create clear separation between test files and test utilities
  - Consider grouping tests by type (unit, integration, edge-cases)
- **Impact**: Clearer test structure, easier to find specific tests

#### 4. Streamline Example Organization

- **Priority**: LOW
- **Issue**: Examples split between runtime-specific and common directories
- **Tasks**:
  - Consider whether runtime-specific examples are necessary
  - Consolidate common patterns
  - Add clear index of examples in main README
- **Impact**: Easier to find relevant examples

### API Design

#### 5. Unify Error Handling Patterns

- **Priority**: HIGH
- **Issue**: Inconsistent error handling between Core, Simple, and Workers APIs
- **Tasks**:
  - Ensure all APIs use the custom error types consistently
  - Add error code constants for programmatic handling
  - Consider adding error recovery suggestions in error messages
- **Impact**: Better developer experience, easier debugging

#### 6. Standardize Async Patterns

- **Priority**: MEDIUM
- **Issue**: Mix of sync and async APIs can be confusing
- **Tasks**:
  - Document clearly which operations are sync vs async
  - Consider making all file operations consistently async
  - Add sync versions where performance critical
- **Impact**: More predictable API behavior

#### 7. Improve Type Exports

- **Priority**: MEDIUM
- **Issue**: Not all useful types are exported from main entry points
- **Tasks**:
  - Audit all internal types and interfaces
  - Export commonly needed types
  - Add type-only exports for better tree shaking
- **Impact**: Better TypeScript experience

### Developer Experience

#### 8. Add Development Mode Features

- **Priority**: MEDIUM
- **Tasks**:
  - Add debug logging that can be enabled via environment variable
  - Add performance timing for operations in debug mode
  - Add validation mode that checks all inputs thoroughly
- **Impact**: Easier debugging and development

#### 9. Improve Getting Started Experience

- **Priority**: HIGH
- **Tasks**:
  - Add a quick start guide in the main README
  - Create a simple "Hello World" example as the first example
  - Add troubleshooting for common issues
  - Consider adding a CLI tool for testing
- **Impact**: Lower barrier to entry for new users

#### 10. Add Interactive Documentation

- **Priority**: LOW
- **Tasks**:
  - Consider adding a playground/demo site
  - Add runnable examples in documentation
  - Create video tutorials for common use cases
- **Impact**: Better learning experience

### Build & Infrastructure

#### 11. Modernize Build Pipeline

- **Priority**: MEDIUM
- **Tasks**:
  - Consider using a build tool like Vite or esbuild
  - Add watch mode for development
  - Improve build error messages
  - Add build performance metrics
- **Impact**: Faster development cycle

#### 12. Add Continuous Integration

- **Priority**: HIGH
- **Tasks**:
  - Add GitHub Actions for automated testing
  - Add automated build verification
  - Add size tracking for the Wasm bundle
  - Consider adding automated benchmarks
- **Impact**: Higher reliability, catch issues early

#### 13. Improve Package Distribution

- **Priority**: MEDIUM
- **Tasks**:
  - Add ESM and CJS builds for better compatibility
  - Consider CDN distribution for browser usage
  - Add Deno.land/x distribution
  - Improve package.json exports field
- **Impact**: Easier adoption across different environments

### Testing & Quality

#### 14. Expand Test Coverage

- **Priority**: HIGH
- **Tasks**:
  - Add code coverage reporting
  - Add mutation testing
  - Add property-based testing for edge cases
  - Add stress tests for memory management
  - Add cross-browser testing
- **Impact**: Higher reliability, fewer bugs

#### 15. Add Integration Tests

- **Priority**: MEDIUM
- **Tasks**:
  - Test with real-world audio files
  - Test with very large files (>100MB)
  - Test batch processing scenarios
  - Test error recovery scenarios
- **Impact**: Better real-world reliability

#### 16. Improve Performance Testing

- **Priority**: MEDIUM
- **Tasks**:
  - Add automated performance benchmarks
  - Track performance over time
  - Add memory usage benchmarks
  - Compare with native implementations
- **Impact**: Maintain and improve performance

### Code Quality

#### 17. Add Code Quality Tools

- **Priority**: MEDIUM
- **Tasks**:
  - Add ESLint with strict rules
  - Add Prettier for consistent formatting
  - Add pre-commit hooks
  - Consider adding SonarQube or similar
- **Impact**: More maintainable code

#### 18. Improve Code Documentation

- **Priority**: MEDIUM
- **Tasks**:
  - Add inline comments for complex algorithms
  - Document architectural decisions
  - Add diagrams for data flow
  - Create contributor guidelines
- **Impact**: Easier for contributors to understand and modify

#### 19. Refactor for Maintainability

- **Priority**: LOW
- **Tasks**:
  - Extract common patterns into utilities
  - Reduce code duplication
  - Improve naming consistency
  - Consider splitting large files
- **Impact**: Easier long-term maintenance

### Reliability & Robustness

#### 20. Add Retry Logic

- **Priority**: MEDIUM
- **Tasks**:
  - Add configurable retry for transient failures
  - Add exponential backoff
  - Add circuit breaker pattern for repeated failures
- **Impact**: Better reliability in production

#### 21. Enhanced Error Handling (User Request)

- **Priority**: HIGH
- **Feedback**: User requested improvements to error handling
- **Tasks**:
  - Add retry logic for file access issues
  - Better validation of tag data before writing
  - Atomic operations with rollback on failure
- **Use Cases**:
  - Handling temporary file locks or access issues
  - Preventing partial writes that corrupt files
  - Ensuring data integrity during batch operations
- **Implementation Ideas**:
  - Add transaction-like API for batch operations
  - Validate tag data against format-specific constraints
  - Create backup before modifications with automatic rollback
- **Impact**: More robust file operations, reduced risk of data loss

#### 22. Improve Memory Management

- **Priority**: HIGH
- **Tasks**:
  - Add automatic cleanup on errors
  - Add memory pressure detection
  - Add configurable memory limits
  - Improve documentation on memory patterns
- **Impact**: Prevent memory leaks, better resource usage

#### 23. Add Telemetry Support

- **Priority**: LOW
- **Tasks**:
  - Add optional telemetry for usage patterns
  - Add performance metrics collection
  - Add error reporting integration
  - Ensure privacy-preserving implementation
- **Impact**: Better understanding of real-world usage
