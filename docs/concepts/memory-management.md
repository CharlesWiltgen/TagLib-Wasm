# Memory Management

This guide explains how TagLib-Wasm manages memory and best practices for
optimal performance.

## Memory Usage Patterns

### Base Memory Requirements

- **Wasm Module**: ~2-4MB (loaded once)
- **Per File**: ~2x file size during processing
- **Peak Usage**: ~3x file size during save operations

### Memory Usage by Operation

| Operation    | Memory Usage  | Duration       |
| ------------ | ------------- | -------------- |
| Loading file | 2x file size  | Until disposed |
| Reading tags | No additional | Instant        |
| Writing tags | No additional | Instant        |
| Saving file  | 3x file size  | During save()  |

## Explicit Memory Management

TagLib-Wasm provides explicit memory management through the `using` keyword
(via `Symbol.dispose`):

```typescript
using audioFile = await taglib.open("song.mp3");
// Work with the file
const tags = audioFile.tag();
console.log(tags.title());
// Automatically disposed when audioFile goes out of scope
```

The `dispose()` method is also available as a fallback for environments that
don't support `using`:

```typescript
const audioFile = await taglib.open("song.mp3");
try {
  const tags = audioFile.tag();
  console.log(tags.title());
} finally {
  audioFile.dispose();
}
```

### What Disposal Does

Disposal (whether via `using` or `dispose()`):

1. Explicitly destroys the C++ object, freeing Wasm heap memory immediately
2. Clears all JavaScript references
3. Prevents memory accumulation in long-running applications

## Best Practices

### 1. Always Use `using` Statements

```typescript
{
  using audioFile = await taglib.open(buffer);
  // Your code here
} // Guaranteed cleanup when scope exits
```

### 2. Process Files Sequentially for Large Batches

```typescript
// Good: Process one at a time
for (const file of files) {
  using audio = await taglib.open(file);
  await processFile(audio);
}

// Bad: Loading all at once
const audioFiles = await Promise.all(
  files.map((f) => taglib.open(f)),
); // Risk of memory exhaustion
```

### 3. Monitor Memory Usage

```typescript
// Check Wasm heap usage (if available)
if (taglib.module.HEAP8) {
  const heapMB = taglib.module.HEAP8.byteLength / 1024 / 1024;
  console.log(`Wasm heap: ${heapMB.toFixed(1)}MB`);
}
```

## Memory Limits

- **Wasm Heap Limit**: 1GB (configurable at build time)
- **Recommended Max File Size**: ~300MB
- **Concurrent Files**: Depends on total size

### Handling Large Files

For files larger than 100MB:

```typescript
// Check file size before processing
const stats = await Deno.stat(filePath);
if (stats.size > 100 * 1024 * 1024) {
  console.warn(
    `Large file (${
      (stats.size / 1024 / 1024).toFixed(1)
    }MB), processing may be slow`,
  );
}
```

## Common Memory Issues

### 1. Memory Accumulation

**Problem**: Not disposing files leads to memory accumulation.

**Solution**: Always use `using` statements or the Simple API which handles
disposal automatically.

### 2. Out of Memory Errors

**Problem**: Processing too many large files concurrently.

**Solution**: Process files sequentially or in small batches.

### 3. Browser Memory Limits

**Problem**: Browsers have lower memory limits than Node.js.

**Solution**:

- Use smaller batch sizes in browsers
- Consider streaming approaches for very large files
- Monitor memory usage and provide user feedback

## Simple API Memory Management

The Simple API automatically handles memory management:

```typescript
// Memory is automatically managed
const tags = await readTags("song.mp3");
console.log(tags.title);

// No need to call dispose() - handled internally
```

## Performance Tips

1. **Reuse TagLib Instance**: The TagLib instance can be reused for multiple
   files
2. **Dispose Early**: Use `using` to ensure files are disposed as soon as the
   scope exits
3. **Batch Wisely**: Balance between memory usage and performance
4. **Monitor Production**: Add memory monitoring in production applications

## Example: Batch Processing with Memory Management

```typescript
import { TagLib } from "taglib-wasm";

async function processMusicLibrary(files: string[]) {
  const taglib = await TagLib.initialize();
  const batchSize = 10;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    await Promise.all(batch.map(async (file) => {
      using audio = await taglib.open(file);
      const tags = audio.tag();
      console.log(`${file}: ${tags.artist()} - ${tags.title()}`);
    }));

    // Optional: Log memory usage after each batch
    if (taglib.module.HEAP8) {
      const heapMB = taglib.module.HEAP8.byteLength / 1024 / 1024;
      console.log(`Batch ${i / batchSize + 1}: Heap ${heapMB.toFixed(1)}MB`);
    }
  }
}
```
