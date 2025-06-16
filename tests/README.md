# taglib-wasm Test Suite

This directory contains the comprehensive test suite for taglib-wasm.

## Test Structure

### Main Test Entry Point
- **`index.test.ts`** - Imports and runs all test modules

### Core Test Modules

#### `taglib.test.ts` - Core functionality & integration tests
- ✅ Format testing (all 5 audio formats: WAV, MP3, FLAC, OGG, M4A)
- ✅ Core API tests (initialization, properties, tags)
- ✅ Simple API tests
- ✅ Performance benchmarks
- ✅ Integration tests:
  - Music library processing
  - Batch tag updates
  - Cross-format tag transfer
  - Concurrent operations

#### `picture-api.test.ts` - Picture/cover art functionality
- ✅ Core picture API (getPictures, setPictures, addPicture, removePictures)
- ✅ Simple API helpers (getCoverArt, setCoverArt, findPictureByType)
- ✅ File utilities (import/export cover art)
- ✅ Web utilities (data URL conversion)

#### `edge-cases.test.ts` - Edge case and Unicode testing
- ✅ Unicode character support (with documented limitations)
- ✅ Empty string handling
- ✅ Special characters
- ✅ Input validation

#### `error-handling.test.ts` - Error handling tests
- ✅ Error messages and context
- ✅ Format-specific errors
- ✅ Error type guards
- ✅ Error recovery

#### `memory.test.ts` - Memory management tests
- ✅ Dispose() functionality
- ✅ Memory leak prevention
- ✅ Resource cleanup

#### `extended-metadata.test.ts` - Extended metadata fields
- 🚧 MusicBrainz IDs (planned)
- 🚧 ReplayGain values (planned)
- 🚧 AcoustID fingerprints (planned)
- 🚧 Apple Sound Check (planned)

### Shared Utilities

#### `test-utils.ts` - Common test utilities and constants
- Test file paths for all formats
- Test image data (RED_PNG, BLUE_JPEG)
- Test metadata constants
- Helper functions:
  - `createTestImages()` - Create temp test images
  - `createTestFileWithMetadata()` - Create test files with tags
  - `measureTime()` - Performance measurement
  - `createTestFiles()` - Batch file creation
  - `withTempFile()` - Temporary file operations

### Test Data
- **`test-files/`** - Sample audio files for testing
  - Real audio samples in all supported formats
  - Small file sizes for fast testing
  - Consistent content across formats

## Running Tests

### Quick Start
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Running Specific Test Suites
```bash
# Core functionality tests
npm run test:core

# Picture/cover art tests
npm run test:pictures

# Edge cases and Unicode
npm run test:edge

# Error handling
npm run test:errors

# Memory management
npm run test:memory

# Extended metadata (when implemented)
npm run test:extended
```

### Multi-Runtime Testing
```bash
# Test across Deno, Node.js, and Bun
npm run test:multi-runtime

# Individual runtimes
npm run test:bun
npm run test:node
```

### Performance Testing
The test suite includes performance benchmarks. To run only performance tests:
```bash
deno test --allow-read --allow-write tests/ --filter "Performance"
```

## Writing Tests

### Test Structure
```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.223.0/assert/mod.ts";
import { TEST_FILES, TEST_TAGS, measureTime } from "./test-utils.ts";

Deno.test("Feature: Description", async () => {
  // Arrange
  const testData = await createTestFileWithMetadata("mp3", TEST_TAGS.basic);
  
  // Act
  const result = await performOperation(testData);
  
  // Assert
  assertEquals(result.expected, actual);
});
```

### Best Practices
1. Use shared utilities from `test-utils.ts`
2. Clean up temporary files with `withTempFile()` helper
3. Test across all formats when applicable
4. Include performance measurements for critical operations
5. Document known limitations or platform-specific behavior

## Coverage Goals
- ✅ Core functionality: 95%+ coverage
- ✅ Picture API: 90%+ coverage
- ✅ Error handling: 85%+ coverage
- 🚧 Extended metadata: 0% (not yet implemented)
- Target: 90%+ overall coverage

## Contributing
When adding new features:
1. Add corresponding tests in the appropriate test file
2. Update this README with new test coverage
3. Run `npm run test:coverage` to ensure coverage doesn't decrease
4. Test across multiple runtimes with `npm run test:multi-runtime`