# Code Standards

## Naming Conventions

### Files

- Use kebab-case for file names: `audio-parser.ts`
- Test files: `audio-parser.test.ts`
- Type definition files: `audio-types.ts`

### Variables and Functions

- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Use UPPER_SNAKE_CASE for constants
- Prefix private methods with underscore

### Examples

```typescript
// Constants
const MAX_BUFFER_SIZE = 1024 * 1024;

// Types
type AudioMetadata = {
  title: string;
  artist: string;
};

// Functions
function parseAudioBuffer(buffer: ArrayBuffer): AudioMetadata {
  // ...
}

// Classes
class AudioParser {
  private _buffer: ArrayBuffer;

  constructor(buffer: ArrayBuffer) {
    this._buffer = buffer;
  }
}
```

## Code Organization

### Import Order

1. Node.js built-ins
2. External dependencies
3. Internal modules
4. Type imports

### Export Guidelines

- Export only what's needed by consumers
- Group related exports
- Use named exports over default exports
- Re-export from index files for clean API

## Comments and Documentation

### JSDoc

- Document all public APIs
- Include parameter descriptions
- Add usage examples for complex functions

```typescript
/**
 * Parses audio metadata from a buffer
 * @param buffer - The audio file buffer
 * @returns Parsed metadata object
 * @throws {Error} If buffer is invalid or too small
 * @example
 * const metadata = parseAudioBuffer(audioBuffer);
 * console.log(metadata.title);
 */
export function parseAudioBuffer(buffer: ArrayBuffer): AudioMetadata {
  // ...
}
```

### Inline Comments

- Explain why, not what
- Keep comments up-to-date with code
- Remove commented-out code
