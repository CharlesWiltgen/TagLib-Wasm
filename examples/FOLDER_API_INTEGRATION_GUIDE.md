# Folder API Integration Guide for Deno Compile Apps

This guide explains how to properly integrate the TagLib-Wasm Folder API into your Deno compile applications.

## Common Integration Issues and Fixes

### 1. Import Path Issues

**❌ Wrong:**

```typescript
import type { AudioFileMetadata } from "taglib-wasm";
```

**✅ Correct:**

```typescript
import {
  type AudioFileMetadata,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
} from "taglib-wasm";
```

The Folder API is exported from the main module, not a separate submodule.

### 2. Missing Helper Functions

The following functions don't exist in TagLib-Wasm and need to be implemented:

- `scanMusicDirectory` → Use `scanFolder` instead
- `formatMetadataForDisplay` → Implement as a helper
- `groupFilesByAlbum` → Implement as a helper

**Example helper implementations:**

```typescript
function formatMetadataForDisplay(
  file: AudioFileMetadata,
): Record<string, any> {
  return {
    ...file.tags,
    duration: file.properties?.length,
    bitrate: file.properties?.bitrate,
    sampleRate: file.properties?.sampleRate,
  };
}

function groupFilesByAlbum(
  files: AudioFileMetadata[],
): Map<string, AudioFileMetadata[]> {
  const albums = new Map<string, AudioFileMetadata[]>();

  for (const file of files) {
    const albumName = file.tags.album || "Unknown Album";
    const albumFiles = albums.get(albumName) || [];
    albumFiles.push(file);
    albums.set(albumName, albumFiles);
  }

  return albums;
}
```

### 3. Scanning Specific Files

The `scanFolder` API scans entire directories. To scan specific files:

```typescript
async function scanSpecificFiles(
  filesToProcess: string[],
  options?: Partial<FolderScanOptions>,
): Promise<FolderScanResult> {
  // Extract unique directories
  const directories = new Set<string>();
  const fileSet = new Set(filesToProcess);

  for (const file of filesToProcess) {
    directories.add(dirname(file));
  }

  // Aggregate results
  const allFiles: AudioFileMetadata[] = [];

  // Scan each directory
  for (const dir of directories) {
    const result = await scanFolder(dir, {
      recursive: false,
      ...options,
    });

    // Filter to only include files we want
    const relevantFiles = result.items.filter((f) => fileSet.has(f.path));
    allFiles.push(...relevantFiles);
  }

  return { files: allFiles /* ... */ };
}
```

### 4. Extended Metadata Access

The Simple API (used by `scanFolder`) doesn't include extended metadata like ReplayGain or AcoustID. Use the Full API for these:

```typescript
// Initialize TagLib
const taglib = await TagLib.initialize();

// Open file to access extended metadata
const audioFile = await taglib.open(filePath);
try {
  const propertyMap = audioFile.propertyMap();
  const properties = propertyMap.properties();

  // Access ReplayGain
  const trackGain = properties["REPLAYGAIN_TRACK_GAIN"]?.[0];
  const trackPeak = properties["REPLAYGAIN_TRACK_PEAK"]?.[0];

  // Access AcoustID
  const acoustId = properties["ACOUSTID_ID"]?.[0];

  // Access MusicBrainz
  const mbTrackId = properties["MUSICBRAINZ_TRACKID"]?.[0];
} finally {
  audioFile.dispose();
}
```

### 5. Type Definitions

The correct types from TagLib-Wasm:

```typescript
interface AudioFileMetadata {
  path: string;
  tags: Tag; // Basic tags: title, artist, album, etc.
  properties?: AudioProperties; // Duration, bitrate, sampleRate, etc.
  error?: Error;
}

interface Tag {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
  comment?: string;
}

interface AudioProperties {
  length: number; // Duration in seconds
  bitrate: number; // Bitrate in kbps
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels
}
```

## Best Practices for Deno Compile

### 1. Bundle the WASM File

When using `deno compile`, you need to handle the WASM file:

```typescript
// Option 1: Embed the WASM file in your binary
const wasmData = await Deno.readFile("./taglib.wasm");
const taglib = await TagLib.initialize({ wasmData });

// Option 2: Load from a URL
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});
```

### 2. Error Handling

Always wrap operations in try-catch blocks:

```typescript
try {
  const result = await scanFolder(directory, {
    continueOnError: true, // Don't stop on errors
    onProgress: (processed, total) => {
      console.log(`Progress: ${processed}/${total}`);
    },
  });

  // Handle errors
  if (result.errors.length > 0) {
    console.error("Some files failed:", result.errors);
  }
} catch (error) {
  console.error("Fatal error:", error);
}
```

### 3. Memory Management

When using the Full API, always dispose of resources:

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(filePath);
try {
  // Use the audioFile
} finally {
  audioFile.dispose(); // Critical!
}
```

### 4. Performance Optimization

```typescript
// Use concurrency for better performance
const result = await scanFolder(directory, {
  concurrency: 8, // Process 8 files in parallel
  includeProperties: true, // Include audio properties
});

// For large folders, use progress callbacks
const result = await scanFolder(directory, {
  onProgress: (processed, total, currentFile) => {
    updateProgressBar(processed, total);
  },
});
```

## Complete Working Example

See `fixed_show_tags_folder.ts` for a complete working implementation that:

- Properly imports from TagLib-Wasm
- Implements all helper functions
- Handles extended metadata correctly
- Manages resources properly
- Includes error handling
- Works with Deno compile

## Migration Checklist

- [ ] Fix import paths to use `"taglib-wasm"` instead of `"taglib-wasm/folder"`
- [ ] Replace `scanMusicDirectory` with `scanFolder` or custom implementation
- [ ] Implement helper functions for formatting and grouping
- [ ] Add TagLib initialization
- [ ] Use Full API for extended metadata (ReplayGain, AcoustID, MusicBrainz)
- [ ] Add proper error handling
- [ ] Dispose of AudioFile resources when using Full API
- [ ] Handle WASM loading for Deno compile (embed or URL)
- [ ] Test with actual audio files
