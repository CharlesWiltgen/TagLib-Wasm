# Migration Guide

This guide helps you migrate from the traditional TagLib API to the new simplified APIs, or between different API styles.

## Table of Contents

1. [Why Migrate?](#why-migrate)
2. [API Comparison](#api-comparison)
3. [Migration Examples](#migration-examples)
4. [Breaking Changes](#breaking-changes)
5. [Gradual Migration Strategy](#gradual-migration-strategy)

## Why Migrate?

The new simplified APIs offer several advantages:

- **Better Performance**: Up to 6.5x faster for batch operations
- **Simpler Code**: Fewer lines of code for common tasks
- **Automatic Resource Management**: No more forgotten `dispose()` calls
- **Better Developer Experience**: Choose the API style that fits your needs

### Performance Comparison

| Operation | Traditional API | Simple API | Fluent API | Improvement |
|-----------|----------------|------------|------------|-------------|
| Read tags | 0.060ms | 0.052ms | 0.040ms | 50% faster |
| Full operation | 0.065ms | 0.109ms | 0.044ms | 47% faster |
| Batch (5 files) | 6.47ms | 1.70ms | 0.99ms | 6.5x faster |

## API Comparison

### Reading Tags

**Traditional API:**
```typescript
const taglib = await TagLib.initialize();
const audioData = await Deno.readFile("song.mp3");
const file = taglib.openFile(audioData);
const tags = file.tag();
console.log(tags.title);
file.dispose();
```

**Simple API:**
```typescript
const tags = await readTags("song.mp3");
console.log(tags.title);
```

**Auto API:**
```typescript
const file = await TagLib.openFile("song.mp3");
console.log(file.tag().title);
file.dispose();

// Or with auto-cleanup:
const title = await withFile("song.mp3", file => file.tag().title);
```

**Fluent API:**
```typescript
const tags = await TagLib.read("song.mp3");
console.log(tags.title);
```

### Writing Tags

**Traditional API:**
```typescript
const taglib = await TagLib.initialize();
const audioData = await Deno.readFile("song.mp3");
const file = taglib.openFile(audioData);
file.setTitle("New Title");
file.setArtist("New Artist");
file.save();
file.dispose();
```

**Simple API:**
```typescript
await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist"
});
```

**Auto API:**
```typescript
await withFile("song.mp3", file => {
  file.setTitle("New Title");
  file.setArtist("New Artist");
  file.save();
});
```

**Fluent API:**
```typescript
await TagLib
  .fromFile("song.mp3")
  .setTitle("New Title")
  .setArtist("New Artist")
  .save();
```

### Advanced Operations

**Traditional API:**
```typescript
const taglib = await TagLib.initialize();
const audioData = await Deno.readFile("song.mp3");
const file = taglib.openFile(audioData);

// Extended metadata
file.setExtendedTag({
  acoustidFingerprint: "...",
  musicbrainzTrackId: "...",
  replayGainTrackGain: "-6.5 dB"
});

// Format-specific operations
if (file.format() === "MP3") {
  // MP3-specific code
}

file.save();
file.dispose();
```

**Auto API (maintains full feature access):**
```typescript
await withFile("song.mp3", file => {
  // Same extended metadata support
  file.setExtendedTag({
    acoustidFingerprint: "...",
    musicbrainzTrackId: "...",
    replayGainTrackGain: "-6.5 dB"
  });
  
  if (file.format() === "MP3") {
    // MP3-specific code
  }
  
  file.save();
});
```

## Migration Examples

### Example 1: Music Library Scanner

**Before (Traditional API):**
```typescript
async function scanMusicLibrary(files: string[]) {
  const taglib = await TagLib.initialize();
  const results = [];
  
  for (const filePath of files) {
    try {
      const data = await Deno.readFile(filePath);
      const file = taglib.openFile(data);
      
      if (file.isValid()) {
        const tags = file.tag();
        const props = file.audioProperties();
        
        results.push({
          path: filePath,
          title: tags.title,
          artist: tags.artist,
          duration: props.length
        });
      }
      
      file.dispose();
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }
  
  return results;
}
```

**After (Simple API):**
```typescript
async function scanMusicLibrary(files: string[]) {
  const results = [];
  
  for (const filePath of files) {
    try {
      const tags = await readTags(filePath);
      const props = await readProperties(filePath);
      
      results.push({
        path: filePath,
        title: tags.title,
        artist: tags.artist,
        duration: props.length
      });
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }
  
  return results;
}
```

**After (Fluent API with batch):**
```typescript
async function scanMusicLibrary(files: string[]) {
  return TagLib.batch(files, async file => {
    const tags = await file.getTags();
    const props = await file.getProperties();
    
    return {
      path: file.getPath(),
      title: tags.title,
      artist: tags.artist,
      duration: props.length
    };
  });
}
```

### Example 2: Metadata Editor

**Before (Traditional API):**
```typescript
class MetadataEditor {
  private taglib: TagLib;
  
  async initialize() {
    this.taglib = await TagLib.initialize();
  }
  
  async updateMetadata(filePath: string, updates: Partial<Tag>) {
    const data = await Deno.readFile(filePath);
    const file = this.taglib.openFile(data);
    
    try {
      if (updates.title) file.setTitle(updates.title);
      if (updates.artist) file.setArtist(updates.artist);
      if (updates.album) file.setAlbum(updates.album);
      if (updates.year) file.setYear(updates.year);
      
      return file.save();
    } finally {
      file.dispose();
    }
  }
}
```

**After (Simple API):**
```typescript
class MetadataEditor {
  async updateMetadata(filePath: string, updates: Partial<Tag>) {
    await writeTags(filePath, updates);
    return true;
  }
}
```

**After (Auto API):**
```typescript
class MetadataEditor {
  async updateMetadata(filePath: string, updates: Partial<Tag>) {
    return withFile(filePath, file => {
      if (updates.title) file.setTitle(updates.title);
      if (updates.artist) file.setArtist(updates.artist);
      if (updates.album) file.setAlbum(updates.album);
      if (updates.year) file.setYear(updates.year);
      
      return file.save();
    });
  }
}
```

## Breaking Changes

### Import Paths

**Before:**
```typescript
import { TagLib } from "taglib-wasm";
```

**After:**
```typescript
// Choose your API style:
import { readTags, writeTags } from "taglib-wasm/simple";
import { TagLib, withFile } from "taglib-wasm/auto";
import { TagLib } from "taglib-wasm/fluent";
```

### Initialization

**Traditional API** requires explicit initialization:
```typescript
const taglib = await TagLib.initialize();
```

**New APIs** auto-initialize on first use:
```typescript
// No initialization needed!
const tags = await readTags("song.mp3");
```

### Resource Management

**Traditional API** requires manual cleanup:
```typescript
file.dispose(); // Don't forget!
```

**New APIs** handle cleanup automatically:
```typescript
// Simple API - automatic cleanup
await readTags("song.mp3");

// Auto API - withFile helper
await withFile("song.mp3", file => {
  // file is automatically disposed
});

// Fluent API - terminal operations cleanup
await TagLib.read("song.mp3"); // Cleaned up automatically
```

## Gradual Migration Strategy

You don't have to migrate everything at once. Here's a recommended approach:

### Step 1: Add New Imports Alongside Old

```typescript
// Keep your existing code working
import { TagLib } from "taglib-wasm";

// Add new API for new features
import { readTags } from "taglib-wasm/simple";
```

### Step 2: Migrate Read-Only Operations

Start with operations that only read data:

```typescript
// Old way (still works)
const taglib = await TagLib.initialize();
const file = taglib.openFile(data);
const tags = file.tag();
file.dispose();

// New way (use for new code)
const tags = await readTags(data);
```

### Step 3: Migrate Simple Write Operations

```typescript
// Replace simple tag updates
await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist"
});
```

### Step 4: Evaluate Complex Operations

For complex operations, consider if you need:
- **Full control**: Keep Traditional API or use Auto API
- **Simplicity**: Use Simple API where possible
- **Elegance**: Use Fluent API for chaining

### Step 5: Remove Old Imports

Once migrated, remove the old imports:

```typescript
// Remove this
import { TagLib } from "taglib-wasm";

// Keep only what you need
import { readTags, writeTags } from "taglib-wasm/simple";
import { withFile } from "taglib-wasm/auto";
```

## Best Practices

### Choose the Right API

- **Simple API**: Best for scripts, simple apps, basic operations
- **Auto API**: Best when you need full features but want convenience
- **Fluent API**: Best for batch operations, method chaining fans
- **Traditional API**: Keep for complex scenarios requiring maximum control

### Mix and Match

You can use multiple APIs in the same project:

```typescript
// Use Simple API for basic operations
const tags = await readTags("song.mp3");

// Use Auto API for advanced features
await withFile("song.mp3", file => {
  file.setExtendedTag({
    musicbrainzTrackId: "..."
  });
  file.save();
});

// Use Fluent API for batch operations
await TagLib.batch(files, async file => {
  // Process multiple files efficiently
});
```

### Error Handling

All APIs throw errors consistently:

```typescript
try {
  await readTags("song.mp3");
} catch (error) {
  console.error("Failed to read tags:", error.message);
}
```

## Need Help?

- Check the [API Styles Guide](./API-Styles.md) for detailed comparisons
- See [examples/](../examples/) for working code
- File an issue if you encounter problems during migration