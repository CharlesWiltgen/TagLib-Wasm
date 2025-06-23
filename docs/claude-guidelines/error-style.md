# Error Message Style Guide

## General Principles

1. **Use colons (`:`) to introduce details**, not hyphens (`-`)
   - ✅ "Module not initialized: missing HEAPU8"
   - ❌ "Module not initialized - missing HEAPU8"

2. **Separate sentences with periods**
   - Multiple related points are joined with `.` (period + space)
   - Example: "Invalid audio file format: File may be corrupted. Buffer size: 2.0 KB."

3. **End complete sentences with periods**
   - "Audio files must be at least 1KB to contain valid headers."

4. **Use consistent prefixes with colons**
   - "Buffer size: 2.0 KB"
   - "Path: /path/to/file.mp3"
   - "Field: title"
   - "Required feature: filesystem access"

## Error Categories

### Validation Errors

```typescript
throw new Error("Invalid audio format: Expected MP3, FLAC, OGG, or WAV.");
```

### Resource Errors

```typescript
throw new Error("File not found: Path does not exist. Path: " + filePath);
```

### WebAssembly Errors

```typescript
throw new Error(
  "WebAssembly module not initialized: Call init() before using the API.",
);
```

### Memory Errors

```typescript
throw new Error(
  "Memory allocation failed: Requested size exceeds available memory. Size: " +
    formatSize(size),
);
```

## Context Information

Always include relevant context:

- File paths (use "Path: ")
- Buffer sizes (use "Buffer size: ")
- Field names (use "Field: ")
- Expected vs actual values
- Operation being attempted

## Examples

### Good Error Messages

```typescript
// Specific and informative
throw new Error(
  "Invalid metadata field: Field name cannot be empty. Field: album",
);

// Multiple context points
throw new Error(
  "Audio file too small: Valid audio files must be at least 1KB. Buffer size: 512 bytes.",
);

// Clear action needed
throw new Error(
  "Module not initialized: Call TagLib.init() before reading metadata.",
);
```

### Bad Error Messages

```typescript
// Too vague
throw new Error("Invalid input");

// Wrong punctuation
throw new Error("File not found - check the path");

// Missing context
throw new Error("Operation failed");
```
