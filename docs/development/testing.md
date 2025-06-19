# Testing Guide

This guide covers the taglib-wasm test suite, including how to run tests, write
new tests, and maintain test quality.

## Test Suite Overview

The test suite is comprehensive and covers all aspects of the library:

- **Core functionality** - Basic operations, format support
- **API coverage** - Full API, Simple API, Workers API
- **Edge cases** - Unicode, empty values, invalid inputs
- **Error handling** - Error types, messages, recovery
- **Memory management** - Cleanup, leak prevention
- **Performance** - Benchmarks, concurrent operations
- **Integration** - Real-world scenarios

## Test Structure

### Test Files

Located in the `tests/` directory:

- **`index.test.ts`** - Main entry point that imports all test modules
- **`taglib.test.ts`** - Core functionality & integration tests
- **`picture-api.test.ts`** - Picture/cover art functionality
- **`edge-cases.test.ts`** - Edge case and Unicode testing
- **`error-handling.test.ts`** - Error handling tests
- **`memory.test.ts`** - Memory management tests
- **`extended-metadata.test.ts`** - Extended metadata fields (planned)

### Test Utilities

**`test-utils.ts`** provides shared utilities:

```typescript
// Test file paths
export const TEST_FILES = {
  wav: resolve("tests/test-files/wav/kiss-snippet.wav"),
  mp3: resolve("tests/test-files/mp3/kiss-snippet.mp3"),
  flac: resolve("tests/test-files/flac/kiss-snippet.flac"),
  ogg: resolve("tests/test-files/ogg/kiss-snippet.ogg"),
  m4a: resolve("tests/test-files/mp4/kiss-snippet.m4a"),
};

// Test metadata
export const TEST_TAGS = {
  basic: {
    title: "Test Title",
    artist: "Test Artist",
    album: "Test Album",
    year: 2024,
    track: 1,
    genre: "Test Genre",
    comment: "Test Comment",
  },
  unicode: {
    title: "Unicode: 你好世界 🎵",
    artist: "Артист טֶסט",
    album: "🎸 Heavy Metal 🤘",
  },
};

// Helper functions
export async function createTestFileWithMetadata(format: string, tags: any);
export async function measureTime(fn: () => Promise<void>);
export async function withTempFile(fn: (path: string) => Promise<void>);
```

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# With coverage
npm run test:coverage
```

### Running Specific Tests

```bash
# Core functionality only
deno test tests/taglib.test.ts

# Picture API only
deno test tests/picture-api.test.ts

# Edge cases
deno test tests/edge-cases.test.ts

# Run tests matching a pattern
deno test --filter "Unicode"
```

### Multi-Runtime Testing

Test across different JavaScript runtimes:

```bash
# Test all runtimes
npm run test:multi-runtime

# Individual runtimes
npm run test:deno
npm run test:node
npm run test:bun
```

### Performance Testing

Run performance benchmarks:

```bash
deno test --allow-read --allow-write tests/ --filter "Performance"
```

## Writing Tests

### Test Structure

Follow this pattern for consistency:

```typescript
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.223.0/assert/mod.ts";
import { measureTime, TEST_FILES, TEST_TAGS } from "./test-utils.ts";

Deno.test("Feature: Description", async () => {
  // Arrange
  const testData = await createTestFileWithMetadata("mp3", TEST_TAGS.basic);

  // Act
  const result = await performOperation(testData);

  // Assert
  assertEquals(result.expected, actual);

  // Cleanup (if needed)
  await cleanup();
});
```

### Best Practices

1. **Use Shared Utilities**
   ```typescript
   // Good - uses shared test data
   const buffer = await Deno.readFile(TEST_FILES.mp3);

   // Avoid - hardcoded paths
   const buffer = await Deno.readFile("./some/path/file.mp3");
   ```

2. **Test Across Formats**
   ```typescript
   for (const [format, path] of Object.entries(TEST_FILES)) {
     Deno.test(`Feature works with ${format}`, async () => {
       // Test implementation
     });
   }
   ```

3. **Clean Up Resources**
   ```typescript
   // Use the withTempFile helper
   await withTempFile(async (tempPath) => {
     // Test with temporary file
     // Cleanup is automatic
   });
   ```

4. **Measure Performance**
   ```typescript
   const duration = await measureTime(async () => {
     // Performance-critical operation
   });
   console.log(`Operation took ${duration}ms`);
   ```

5. **Document Fixed Issues**
   ```typescript
   Deno.test("Unicode: Works correctly", async () => {
     // Unicode support was fixed in v0.3.12
     // All Unicode characters now work correctly
   });
   ```

### Adding New Tests

When adding new features:

1. Add tests to the appropriate test file
2. Update test utilities if needed
3. Run coverage to ensure no regression
4. Test across multiple runtimes
5. Update this documentation

## Test Coverage

### Current Coverage Goals

- ✅ Core functionality: 95%+ coverage
- ✅ Picture API: 90%+ coverage
- ✅ Error handling: 85%+ coverage
- 🚧 Extended metadata: 0% (not yet implemented)
- **Target**: 90%+ overall coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Improving Coverage

1. Run coverage report
2. Identify uncovered lines
3. Add tests for edge cases
4. Focus on error paths
5. Test boundary conditions

## Integration Tests

The test suite includes real-world scenarios:

### Music Library Processing

Simulates processing an album:

```typescript
Deno.test("Integration: Music library processing", async () => {
  // Create album structure
  // Process all tracks
  // Verify consistency
});
```

### Batch Operations

Tests concurrent file processing:

```typescript
Deno.test("Integration: Concurrent operations", async () => {
  // Process 20 files simultaneously
  // Measure performance
  // Verify correctness
});
```

### Cross-Format Operations

Tests tag transfer between formats:

```typescript
Deno.test("Integration: Cross-format tag transfer", async () => {
  // Read tags from MP3
  // Write to FLAC
  // Verify preservation
});
```

## Debugging Tests

### Verbose Output

```bash
# Run with verbose logging
DEBUG=* deno test tests/

# Or set in test
Deno.test("Debug test", async () => {
  console.log("Debug info:", data);
});
```

### Isolate Failing Tests

```bash
# Run single test file
deno test tests/specific-test.ts

# Run single test by name
deno test --filter "exact test name"
```

### Common Issues

1. **Module Loading Errors**
   - Ensure WASM is built: `npm run build:wasm`
   - Check import paths

2. **File Not Found**
   - Run from project root
   - Check test file paths

3. **Permission Errors**
   - Add required permissions: `--allow-read --allow-write`

4. **Memory Issues**
   - Ensure proper cleanup with `dispose()`
   - Check for memory leaks

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm install

      - name: Build WASM
        run: npm run build:wasm

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Contributing

When contributing tests:

1. Follow existing patterns
2. Add meaningful test descriptions
3. Test edge cases
4. Ensure tests are deterministic
5. Document any platform-specific behavior
6. Run full test suite before submitting

## Next Steps

- See [Contributing Guidelines](/CONTRIBUTING.md) for more details
- Check [Performance Guide](/Performance.md) for benchmark guidelines
- Read [Error Handling](/Error-Handling.md) for error testing patterns
