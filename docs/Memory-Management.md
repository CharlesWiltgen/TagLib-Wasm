# Memory Management

This guide explains how taglib-wasm manages memory and best practices for optimal performance.

## Memory Usage Patterns

### Base Memory Requirements
- **Wasm Module**: ~2-4MB (loaded once)
- **Per File**: ~2x file size during processing
- **Peak Usage**: ~3x file size during save operations

### Memory Usage by Operation

| Operation | Memory Usage | Duration |
|-----------|--------------|----------|
| Loading file | 2x file size | Until dispose() |
| Reading tags | No additional | Instant |
| Writing tags | No additional | Instant |
| Saving file | 3x file size | During save() |

## Explicit Memory Management

taglib-wasm provides explicit memory management through the `dispose()` method:

```typescript
const audioFile = await taglib.open("song.mp3");
try {
  // Work with the file
  const tags = audioFile.tag();
  console.log(tags.title());
} finally {
  // Always dispose to free memory immediately
  audioFile.dispose();
}
```

### What dispose() Does

As of v0.3.6+, `dispose()`:
1. Explicitly destroys the C++ object, freeing Wasm heap memory immediately
2. Clears all JavaScript references
3. Prevents memory accumulation in long-running applications

## Best Practices

### 1. Always Use Try-Finally

```typescript
const audioFile = await taglib.open(buffer);
try {
  // Your code here
} finally {
  audioFile.dispose(); // Guaranteed cleanup
}
```

### 2. Process Files Sequentially for Large Batches

```typescript
// Good: Process one at a time
for (const file of files) {
  const audio = await taglib.open(file);
  try {
    await processFile(audio);
  } finally {
    audio.dispose();
  }
}

// Bad: Loading all at once
const audioFiles = await Promise.all(
  files.map(f => taglib.open(f))
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
  console.warn(`Large file (${(stats.size / 1024 / 1024).toFixed(1)}MB), processing may be slow`);
}
```

## Common Memory Issues

### 1. Memory Accumulation

**Problem**: Not calling dispose() leads to memory accumulation.

**Solution**: Always use try-finally or the Simple API which handles disposal automatically.

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

1. **Reuse TagLib Instance**: The TagLib instance can be reused for multiple files
2. **Dispose Early**: Call dispose() as soon as you're done with a file
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
      const audio = await taglib.open(file);
      try {
        // Process file
        const tags = audio.tag();
        console.log(`${file}: ${tags.artist()} - ${tags.title()}`);
      } finally {
        audio.dispose();
      }
    }));
    
    // Optional: Log memory usage after each batch
    if (taglib.module.HEAP8) {
      const heapMB = taglib.module.HEAP8.byteLength / 1024 / 1024;
      console.log(`Batch ${i / batchSize + 1}: Heap ${heapMB.toFixed(1)}MB`);
    }
  }
}
```