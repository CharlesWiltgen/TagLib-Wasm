# Project Status and Backlog

**Last Updated**: 2025-06-26\
**Overall CLAUDE.md Compliance**: 75% of critical items completed

## 📊 Compliance Summary

### ✅ Completed (3/4 High Priority Items)

1. **Enum Replacement** (Completed: 2025-06-23)
   - Replaced all enums with union types
   - Updated `TagLibErrorCode` and `PictureType`
   - Fixed all imports and type references

2. **Error Message Style Guide** (Already Compliant)
   - Uses colons (`:`) for introducing details
   - Includes relevant context (buffer sizes, file paths)
   - Ends sentences with periods
   - Error classes properly categorize different error types

3. **Memory Management** (Completed: commit cf3ced40)
   - Implemented proper try-finally blocks for WebAssembly cleanup
   - All `_malloc()` calls now have corresponding `_free()` in finally blocks
   - Follows the required pattern from CLAUDE.md guidelines

4. **SonarQube Issues** (Completed: 2025-06-26)
   - Resolved all BLOCKER issues
   - Resolved all CRITICAL issues
   - Resolved all MAJOR issues
   - Resolved 46 MINOR issues (nullish coalescing)

### ❌ Remaining High Priority (1/4)

#### 1. Split Large Files to Comply with 250-line Limit

**Priority**: CRITICAL\
**Issue**: 11 files exceed the 250-line limit per CLAUDE.md guidelines

**Files to Split**:

- `src/taglib.ts` (1,233 lines) - Exceeds by 983 lines
- `src/simple.ts` (1,136 lines) - Exceeds by 886 lines
- `src/types.ts` (698 lines) - Exceeds by 448 lines
- `src/folder-api.ts` (688 lines) - Exceeds by 438 lines
- `src/constants.ts` (674 lines) - Exceeds by 424 lines
- `src/file-utils.ts` (510 lines) - Exceeds by 260 lines
- `src/workers.ts` (492 lines) - Exceeds by 242 lines
- `src/worker-pool.ts` (480 lines) - Exceeds by 230 lines
- `src/web-utils.ts` (348 lines) - Exceeds by 98 lines
- `src/utils/file.ts` (280 lines) - Exceeds by 30 lines
- `src/errors.ts` (262 lines) - Exceeds by 12 lines

**Recommended Approach**:

- Extract interface definitions from `taglib.ts` into separate files
- Split `simple.ts` into feature-specific modules
- Move metadata mapping logic from `types.ts` to dedicated modules
- Extract constants into format-specific files
- Split utility functions by domain

## 🔧 High Priority Improvements

### 1. Fix Worker Type Checking Context Issues

**Priority**: HIGH\
**Issue**: Workers fail type checking in Deno because they're checked in window/DOM context

**Root Cause**:

- Worker files are type-checked as window scripts, not worker scripts
- Import chain contamination from DOM-dependent modules
- `deno.json` specifies `"lib": ["deno.window", "dom"]` globally

**Solutions**:

1. Isolate worker code from DOM dependencies
2. Add triple-slash directives: `/// <reference lib="webworker" />`
3. Refactor import structure to avoid DOM types in workers

### 2. Test Coverage Verification

**Priority**: MEDIUM\
**Target**: 80% minimum coverage\
**Action**: Run coverage analysis and address gaps

## 📚 Medium Priority - Documentation & Distribution

### 1. Make taglib-wasm More "Deno 2 Native"

**Priority**: MEDIUM

**Key Tasks**:

1. Consolidate to single JSR distribution
2. Implement native Wasm loading (replace Emscripten wrapper)
3. Remove TypeScript compilation step
4. Simplify module structure
5. Remove Node.js patterns

### 2. Document Memory Management

**Priority**: MEDIUM\
**Tasks**:

- Document what happens without `dispose()`
- Add best practices for long-running applications
- Document memory usage patterns with large files

### 3. Add Bundle Size Documentation

**Priority**: MEDIUM\
**Tasks**:

- Document 370KB WASM file impact
- Add lazy loading strategies
- Provide CDN hosting recommendations

## 🚀 Future Features

### 1. ReplayGain 2.0 Calculation

**Priority**: FUTURE - Well Documented Plan\
**Concept**: Add loudness normalization analysis directly in JavaScript

**Implementation Options**:

- Option A: Integrate ebur128-wasm (quick implementation)
- Option B: Port libebur128 to WebAssembly (full control)
- Option C: Web Audio API + Custom Analysis (browser-optimized)

**Benefits**:

- Client-side loudness analysis without server infrastructure
- Privacy-preserving (audio never leaves device)
- Direct integration with web audio applications

### 2. Enhanced Error Handling

**Priority**: HIGH (User Request)\
**Tasks**:

- Add retry logic for file access issues
- Better validation of tag data before writing
- Atomic operations with rollback on failure
- Transaction-like API for batch operations

## 🧪 Testing Infrastructure

### Current Status

- **Tests**: 25/25 passing
- **Coverage**: All formats (WAV, MP3, FLAC, OGG, M4A) working
- **Edge Cases**: Comprehensive edge case tests added
- **Unicode**: Full Unicode support implemented and tested

## 📋 Progress Tracking

### Completed in 2025

- ✅ Deno Runtime Compatibility Fix (Jan 14)
- ✅ Test Suite Consolidation (Jan 14)
- ✅ Buffer Return in writeTags() (Jan 14)
- ✅ Get Modified Buffer from Core API (Jan 14)
- ✅ Comprehensive API Documentation (Jan 15)
- ✅ Improve Error Messages with Context (Jan 15)
- ✅ Unicode String Handling Fix (Jan 16)
- ✅ Edge Case Testing (Jan 15)
- ✅ Memory Management Fix (cf3ced40)
- ✅ SonarQube Issues Resolution (Jun 26)

### In Progress

- 🔄 None currently

### Blocked/Waiting

- ❌ Split large files (11 files exceed 250-line limit)
- ❌ Worker type checking fixes
- ❌ Test coverage verification

## 🎯 Next Steps

1. **Immediate**: Split the 11 large files to meet 250-line limit
2. **This Week**: Fix worker type checking issues
3. **Next Week**: Verify test coverage meets 80% minimum
4. **This Month**: Consolidate to single JSR distribution

## 📈 Metrics

- **Code Standards Compliance**: 75% (3/4 high priority items)
- **Test Status**: 100% passing (25/25 tests)
- **File Size Compliance**: 0% (11 files exceed limit)
- **Documentation**: Comprehensive JSDoc coverage
- **Error Handling**: Custom error types with context
- **Memory Management**: Proper cleanup patterns implemented
- **Unicode Support**: Full UTF-8 support for all characters
