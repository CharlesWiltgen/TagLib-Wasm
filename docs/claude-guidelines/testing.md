# Testing Guidelines

## Test Structure

### File Organization

```typescript
// Group related tests
describe("AudioParser", () => {
  describe("parseBuffer", () => {
    it("should parse valid MP3 buffer", () => {
      // Test implementation
    });

    it("should throw on invalid buffer", () => {
      // Test implementation
    });
  });
});
```

### Test Naming

- Use descriptive test names that explain what is being tested
- Start with "should" for behavior tests
- Include the condition and expected outcome

## Testing Patterns

### Arrange-Act-Assert

```typescript
it("should extract metadata from valid audio file", () => {
  // Arrange
  const buffer = createTestBuffer("mp3");
  const parser = new AudioParser();

  // Act
  const metadata = parser.parse(buffer);

  // Assert
  expect(metadata.title).toBe("Test Song");
  expect(metadata.artist).toBe("Test Artist");
});
```

### Error Testing

```typescript
it("should throw descriptive error for small buffer", () => {
  const smallBuffer = new ArrayBuffer(100);

  expect(() => parseAudioBuffer(smallBuffer))
    .toThrow(
      "Invalid audio file format: Buffer too small. Buffer size: 100 bytes.",
    );
});
```

### Async Testing

```typescript
it("should load WebAssembly module", async () => {
  await init();

  expect(getModule()).toBeDefined();
  expect(getModule()._malloc).toBeInstanceOf(Function);
});
```

## WebAssembly Testing

### Mock the Module

```typescript
const mockModule = {
  _malloc: jest.fn().mockReturnValue(1000),
  _free: jest.fn(),
  _processAudio: jest.fn().mockReturnValue(2000),
  HEAPU8: new Uint8Array(1024 * 1024),
};

beforeEach(() => {
  jest.clearAllMocks();
  setModule(mockModule);
});
```

### Memory Leak Testing

```typescript
it("should free allocated memory", () => {
  const buffer = new ArrayBuffer(1024);

  processAudioBuffer(buffer);

  expect(mockModule._malloc).toHaveBeenCalledOnce();
  expect(mockModule._free).toHaveBeenCalledWith(1000);
});
```

## Test Data

### Test Fixtures

```typescript
// Create reusable test data
export const testBuffers = {
  validMp3: createAudioBuffer("mp3", {
    title: "Test",
    artist: "Artist",
  }),
  corruptedFile: new ArrayBuffer(500),
  emptyFile: new ArrayBuffer(0),
};
```

### Edge Cases

Always test:

- Empty inputs
- Null/undefined values
- Boundary values
- Invalid formats
- Large files
- Unicode strings

## Performance Testing

```typescript
it("should process large file within time limit", () => {
  const largeBuffer = new ArrayBuffer(50 * 1024 * 1024); // 50MB

  const start = performance.now();
  processAudioBuffer(largeBuffer);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(1000); // Should complete in < 1 second
});
```

## Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for public API
- Test all error paths
- Test all edge cases

## Best Practices

1. **Keep tests independent** - Each test should be able to run in isolation
2. **Use descriptive assertions** - Make failures easy to understand
3. **Avoid implementation details** - Test behavior, not internal state
4. **Keep tests fast** - Mock heavy operations
5. **Test one thing** - Each test should verify a single behavior

## Continuous Integration

Tests must pass in CI environment:

- No external dependencies
- No file system access (unless mocked)
- Deterministic results
- Cross-platform compatible
