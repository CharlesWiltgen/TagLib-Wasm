# Folder Operations Guide

The folder API provides efficient batch operations for processing multiple audio
files, scanning directories, and managing music collections. This API is perfect
for building music library managers, duplicate finders, and batch metadata
editors.

## Overview

The folder API is available through a dedicated import path:

```typescript
import { findDuplicates, scanFolder, updateFolderTags } from "taglib-wasm";
```

::: tip Runtime Support
Folder operations require filesystem access and are available in:

- ✅ Deno
- ✅ Node.js
- ✅ Bun
- ❌ Browsers (no filesystem access)
- ❌ Cloudflare Workers (no filesystem access)
  :::

## Scanning Folders

The `scanFolder()` function recursively scans directories for audio files and
reads their metadata:

```typescript
const result = await scanFolder("/path/to/music", {
  recursive: true, // Scan subdirectories (default: true)
  extensions: [".mp3", ".flac"], // File types to include (default: common audio formats)
  maxFiles: 1000, // Limit number of files (default: unlimited)
  includeProperties: true, // Include audio properties (default: true)
  continueOnError: true, // Continue if files fail (default: true)
  concurrency: 4, // Parallel processing (default: 4)
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});

// Access results
console.log(`Found ${result.totalFound} audio files`);
console.log(`Processed ${result.totalProcessed} successfully`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Time taken: ${result.duration}ms`);

// Process each file
for (const file of result.items) {
  console.log(`Path: ${file.path}`);
  console.log(`Title: ${file.tags.title}`);
  console.log(`Artist: ${file.tags.artist}`);
  console.log(`Duration: ${file.properties?.duration}s`);
  console.log(`Bitrate: ${file.properties?.bitrate} kbps`);
}
```

### Result Structure

```typescript
interface FolderScanResult {
  files: AudioFileMetadata[]; // Successfully processed files
  errors: Array<{ // Failed files with errors
    path: string;
    error: Error;
  }>;
  totalFound: number; // Total audio files found
  totalProcessed: number; // Successfully processed count
  duration: number; // Time taken in milliseconds
}

interface AudioFileMetadata {
  path: string; // File path
  tags: Tag; // Metadata tags
  properties?: AudioProperties; // Audio properties (if requested)
  error?: Error; // Error if processing failed
}
```

## Batch Tag Updates

Update metadata for multiple files efficiently:

```typescript
const updates = [
  {
    path: "/music/song1.mp3",
    tags: { artist: "New Artist", album: "New Album" },
  },
  {
    path: "/music/song2.mp3",
    tags: { genre: "Electronic", year: 2024 },
  },
];

const result = await updateFolderTags(updates, {
  continueOnError: true, // Continue if some files fail
  concurrency: 4, // Process 4 files in parallel
});

console.log(`Updated ${result.successful} files`);
console.log(`Failed: ${result.failed.length}`);
console.log(`Time: ${result.duration}ms`);

// Check failures
for (const failure of result.failed) {
  console.error(`Failed to update ${failure.path}: ${failure.error.message}`);
}
```

## Finding Duplicates

Find duplicate audio files based on metadata criteria:

```typescript
// Find duplicates by artist and title (default criteria)
const duplicates = await findDuplicates("/path/to/music");

console.log(`Found ${duplicates.size} groups of duplicates`);

// Process each duplicate group
for (const [key, files] of duplicates) {
  console.log(`\nDuplicate group: ${key}`);
  for (const file of files) {
    console.log(`  - ${file.path}`);
    console.log(
      `    Size: ${file.properties?.duration}s @ ${file.properties?.bitrate}kbps`,
    );
  }
}

// Find duplicates by different criteria
const albumDuplicates = await findDuplicates("/music", {
  criteria: ["album", "artist"],
});
const exactDuplicates = await findDuplicates("/music", {
  criteria: ["artist", "album", "title", "track"],
});
```

## Exporting Metadata

Export your music library metadata to JSON for cataloging or analysis:

```typescript
await exportFolderMetadata("/path/to/music", "./music-catalog.json", {
  recursive: true,
  includeProperties: true
});

// The exported JSON contains:
{
  "folder": "/path/to/music",
  "scanDate": "2024-01-20T10:30:00.000Z",
  "summary": {
    "totalFiles": 1234,
    "processedFiles": 1230,
    "errors": 4,
    "duration": 5678
  },
  "files": [
    {
      "path": "/path/to/music/song.mp3",
      "tags": {
        "title": "Song Title",
        "artist": "Artist Name",
        // ... all tags
      },
      "properties": {
        "duration": 180,
        "bitrate": 320,
        // ... all properties
      }
    }
    // ... more files
  ],
  "errors": [
    {
      "path": "/path/to/music/corrupt.mp3",
      "error": "Invalid audio file format"
    }
  ]
}
```

## Performance Optimization

### Concurrency Control

The `concurrency` option controls how many files are processed in parallel:

```typescript
// Sequential processing (slower but uses less memory)
const sequential = await scanFolder("/music", { concurrency: 1 });

// Parallel processing (faster but uses more memory)
const parallel = await scanFolder("/music", { concurrency: 8 });
```

### Memory Management

When processing large collections:

```typescript
// Process in smaller batches
const result = await scanFolder("/huge-library", {
  maxFiles: 100, // Process only 100 files at a time
  includeProperties: false, // Skip audio properties to save memory
  concurrency: 2, // Lower concurrency for memory savings
});
```

### Progress Monitoring

For long-running operations:

```typescript
let lastUpdate = Date.now();

const result = await scanFolder("/music", {
  onProgress: (processed, total, file) => {
    const now = Date.now();
    if (now - lastUpdate > 1000) { // Update every second
      const percent = ((processed / total) * 100).toFixed(1);
      console.log(`Progress: ${percent}% (${processed}/${total})`);
      console.log(`Current: ${file}`);

      const elapsed = now - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = (total - processed) / rate;
      console.log(`ETA: ${Math.round(remaining)}s`);

      lastUpdate = now;
    }
  },
});
```

## Common Use Cases

### Music Library Organization

```typescript
// Organize music by artist/album structure
const result = await scanFolder("/unsorted-music");

for (const file of result.items) {
  const artist = file.tags.artist || "Unknown Artist";
  const album = file.tags.album || "Unknown Album";
  const title = file.tags.title || path.basename(file.path);

  // Create organized structure
  const newPath = path.join("/organized-music", artist, album, `${title}.mp3`);
  // Move file to new location (using your preferred file operation method)
}
```

### Metadata Cleanup

```typescript
// Find and fix missing metadata
const result = await scanFolder("/music");

const needsFixing = result.items.filter((file) =>
  !file.tags.artist ||
  !file.tags.title ||
  !file.tags.album
);

console.log(`Found ${needsFixing.length} files with missing metadata`);

// Batch update missing fields
const updates = needsFixing.map((file) => ({
  path: file.path,
  tags: {
    artist: file.tags.artist || "Unknown Artist",
    album: file.tags.album || "Unknown Album",
    title: file.tags.title || path.basename(file.path, path.extname(file.path)),
  },
}));

await updateFolderTags(updates);
```

### Duplicate Cleanup

```typescript
// Find and handle duplicates
const duplicates = await findDuplicates("/music");

for (const [key, files] of duplicates) {
  // Sort by quality (highest bitrate first)
  const sorted = files.sort((a, b) =>
    (b.properties?.bitrate || 0) - (a.properties?.bitrate || 0)
  );

  const [keep, ...remove] = sorted;
  console.log(`Keeping: ${keep.path} (${keep.properties?.bitrate}kbps)`);

  for (const file of remove) {
    console.log(
      `Consider removing: ${file.path} (${file.properties?.bitrate}kbps)`,
    );
  }
}
```

## Error Handling

The folder API provides detailed error information:

```typescript
const result = await scanFolder("/music", {
  continueOnError: true, // Don't stop on errors
});

// Check for errors
if (result.errors.length > 0) {
  console.error(`Failed to process ${result.errors.length} files:`);

  for (const { path, error } of result.errors) {
    if (error.message.includes("Invalid audio file format")) {
      console.error(`Corrupted file: ${path}`);
    } else if (error.message.includes("Permission denied")) {
      console.error(`No access: ${path}`);
    } else {
      console.error(`Unknown error in ${path}: ${error.message}`);
    }
  }
}
```

## Best Practices

1. **Start with small directories** when testing to understand performance
   characteristics
2. **Use progress callbacks** for user feedback on long operations
3. **Handle errors gracefully** - some files may be corrupted or inaccessible
4. **Consider memory usage** when processing large collections
5. **Use appropriate concurrency** based on your system resources
6. **Filter by extensions** to avoid processing non-audio files
7. **Export metadata regularly** for backup and analysis

## API Reference

For detailed API documentation, see the
[Folder API Reference](/api/folder-api.html).
