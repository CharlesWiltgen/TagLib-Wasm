# TagLib-Wasm Usage Guide for AI Assistants

This guide helps AI assistants understand how to use the taglib-wasm library
effectively when writing code that consumes this package.

## Getting Started in 60 Seconds

```typescript
// Install - Choose based on runtime
npm install taglib-wasm                      // Node.js/Bun
import ... from "jsr:@charlesw/taglib-wasm"  // Deno (preferred)
import ... from "npm:taglib-wasm"            // Deno (alternative)

// Read tags (simplest approach)
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
console.log(tags.artist, tags.title, tags.album);

// That's it! For more control, keep reading...
```

## Package Distribution

taglib-wasm is distributed through two registries:

### JSR Package (`@charlesw/taglib-wasm`) - Preferred for Deno

- **Best for**: Deno applications and compiled binaries
- **Includes**: All APIs including Folder API and Deno compile utilities
- **Import**: `import { ... } from "jsr:@charlesw/taglib-wasm"`
- **Benefits**: Better Deno integration, TypeScript-first, no npm overhead

### NPM Package (`taglib-wasm`) - For Node.js/Bun/Browsers

- **Best for**: Node.js, Bun, browser applications
- **Import**: `import { ... } from "taglib-wasm"`
- **Benefits**: Standard npm ecosystem compatibility

## API Overview

taglib-wasm provides three APIs for different use cases:

### 1. **Simple API** (`taglib-wasm/simple`)

- **Best for**: Quick reads, one-off operations, cover art handling, batch processing
- **Memory**: Automatically managed
- **Functions**: `readTags()`, `applyTagsToBuffer()`, `writeTagsToFile()`, `readProperties()`,
  `readCoverArt()`, `applyCoverArt()`
- **Batch Functions**: `readTagsBatch()`, `readPropertiesBatch()`, `readMetadataBatch()`
  - 10-20x faster than sequential processing
  - Configurable concurrency and progress tracking

### 2. **Full API** (`taglib-wasm`)

- **Best for**: Complex operations, performance-critical code, advanced metadata
- **Memory**: Manual disposal required
- **Classes**: `TagLib`, `AudioFile`, `Tag`, `PropertyMap`

### 3. **Folder API** (Main export)

- **Best for**: Library scanning, bulk updates, finding duplicates, cover art detection, dynamics analysis
- **Memory**: Efficient batch processing
- **Functions**: `scanFolder()`, `updateFolderTags()`, `findDuplicates()`,
  `exportFolderMetadata()`
- **Features**: Detects cover art presence, extracts ReplayGain/Sound Check data
- **Runtime**: Node.js, Deno, and Bun only (requires filesystem access)
- **Note**: Exported from main module, not a subpath

## Performance at a Glance

### 🚀 Performance Comparison

| Method                  | Files      | Time     | Speed           | Best For     |
| ----------------------- | ---------- | -------- | --------------- | ------------ |
| Sequential `readTags()` | 19 files   | ~90s     | 1x baseline     | Single files |
| **`readTagsBatch()`**   | 19 files   | **~5s**  | **18x faster**  | File lists   |
| **`scanFolder()`**      | 1000 files | **2-4s** | **~10x faster** | Directories  |

### 🎯 Fastest Approach for Common Tasks

```typescript
// FASTEST: Process album folder (10-20x speedup)
const albumTracks = ["track01.mp3", "track02.mp3" /* ... */];
const metadata = await readMetadataBatch(albumTracks, {
  concurrency: 8, // Optimal for most systems
});

// FASTEST: Scan music library
const library = await scanFolder("/music", {
  concurrency: 8, // Match batch API performance
  recursive: true,
});

// FASTEST: Read just tags from multiple files
const tags = await readTagsBatch(files, { concurrency: 8 });
```

## Which API Should I Use?

- **Reading tags from one file?** → Simple API: `readTags()`
- **Writing tags to one file?** → Simple API: `writeTagsToFile()` or `applyTagsToBuffer()`
- **Processing many files?** → **Simple API: `readTagsBatch()` (10-20x faster)** or Folder API: `scanFolder()`
- **Need maximum performance?** → **Simple API batch functions with concurrency: 8**
- **Processing album folder?** → **`readMetadataBatch()` with high concurrency**
- **Need PropertyMap or pictures?** → Full API or Simple API cover art functions
- **Need MusicBrainz/ReplayGain?** → Full API with PropertyMap
- **Memory constrained environment?** → Simple API (automatic cleanup)
- **Building a music player?** → Simple API for metadata, **batch functions for libraries**
- **Building a tag editor?** → Full API for complete control
- **Working with cover art?** → Simple API: `readCoverArt()`, `applyCoverArt()`
- **Working with ratings?** → Full API: `getRating()`, `setRating()`, `RatingUtils`
- **Identifying files missing artwork?** → Folder API: `scanFolder()` or Simple API: `readMetadataBatch()` with `hasCoverArt` field
- **Analyzing volume normalization?** → Folder API: `scanFolder()` or Simple API: `readMetadataBatch()` with `dynamics` field

## Quick Reference

### Essential Operations

| Task                 | Simple API                                            | Full API                                      |
| -------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Read tags            | `await readTags("file.mp3")`                          | `audioFile.tag().title`                       |
| Write tags           | `await writeTagsToFile("file.mp3", tags)`             | `tag.setTitle("New")`                         |
| Get duration         | `(await readProperties("file.mp3")).length`           | `audioFile.audioProperties().length`          |
| Get codec/container  | `(await readProperties("file.mp3")).codec`            | `audioFile.audioProperties().codec`           |
| Get modified buffer  | `await applyTagsToBuffer("file.mp3", tags)`           | `audioFile.save(); audioFile.getFileBuffer()` |
| Get cover art        | `await readCoverArt("file.mp3")`                      | Use PropertyMap API                           |
| Set cover art        | `await applyCoverArt("file.mp3", data, type)`         | Use PropertyMap API                           |
| Get rating           | N/A (use Full API)                                    | `audioFile.getRating()`                       |
| Set rating           | N/A (use Full API)                                    | `audioFile.setRating(0.8)`                    |
| **Batch read tags**  | `await readTagsBatch(files)` **10-20x faster**        | Manual loop with disposal                     |
| **Batch properties** | `await readPropertiesBatch(files)` **10-20x faster**  | Manual loop with disposal                     |
| **Batch metadata**   | `await readMetadataBatch(files)` **10-20x faster**    | Manual loop with disposal                     |
| Scan folder          | `await scanFolder("/music")` **Built-in concurrency** | Use Folder API                                |
| Find duplicates      | `await findDuplicates("/music")`                      | Use Folder API                                |

### Import Statements

```typescript
// Deno (JSR - Preferred)
import { TagLib } from "jsr:@charlesw/taglib-wasm";
import {
  applyCoverArt,
  applyTagsToBuffer,
  readCoverArt,
  readMetadataBatch,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  writeTagsToFile,
} from "jsr:@charlesw/taglib-wasm/simple";
import { findDuplicates, scanFolder } from "jsr:@charlesw/taglib-wasm";

// Deno (NPM - Alternative)
import { TagLib } from "npm:taglib-wasm";
import {
  applyTagsToBuffer,
  readTags,
  readTagsBatch,
  writeTagsToFile,
} from "npm:taglib-wasm/simple";
import { findDuplicates, scanFolder } from "npm:taglib-wasm";

// Node.js/Bun
import { TagLib } from "taglib-wasm";
import {
  applyCoverArt,
  applyTagsToBuffer,
  readCoverArt,
  readMetadataBatch,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  writeTagsToFile,
} from "taglib-wasm/simple";
import { findDuplicates, scanFolder } from "taglib-wasm";

// TypeScript type imports
import type { AudioProperties, FolderScanResult, Tag } from "taglib-wasm";

// Error handling utilities
import {
  isFileOperationError,
  isTagLibError,
  isUnsupportedFormatError,
  TagLibError,
} from "taglib-wasm";
```

### Memory Management Checklist

- ✅ Call `TagLib.initialize()` once and reuse
- ✅ Use `using` for automatic cleanup (`dispose()` is the manual fallback)
- ✅ Don't access AudioFile after disposal
- ✅ Simple API handles memory automatically
- ✅ Folder API manages memory for batch operations

## Deno Compile Support

`TagLib.initialize()` **auto-detects Deno compile mode**. When running inside a
compiled binary, it automatically switches to Emscripten buffer mode and loads
embedded Wasm — no special API needed.

### Auto-Detection (Recommended)

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm";

// Works everywhere: development, Deno compile, browsers
const taglib = await TagLib.initialize();
using file = await taglib.open("audio.mp3");
```

For offline support, embed the Wasm file at compile time:

```bash
deno compile --allow-read --include taglib-web.wasm myapp.ts
```

### Explicit Helper (Custom Wasm Path)

Use `initializeForDenoCompile()` only when you need a custom embedded Wasm path:

```typescript
import { initializeForDenoCompile } from "jsr:@charlesw/taglib-wasm";

const taglib = await initializeForDenoCompile("./assets/taglib-web.wasm");
using file = await taglib.open("audio.mp3");
```

### Preparing for Offline

```typescript
import { prepareWasmForEmbedding } from "jsr:@charlesw/taglib-wasm";
await prepareWasmForEmbedding("./taglib-web.wasm");
```

Then compile with:

```bash
deno compile --allow-read --include taglib-web.wasm myapp.ts
```

### Manual Control

```typescript
import { isDenoCompiled, TagLib } from "jsr:@charlesw/taglib-wasm";

const taglib = await TagLib.initialize({
  wasmUrl: isDenoCompiled()
    ? new URL("./taglib-web.wasm", import.meta.url).href // Embedded
    : "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm", // CDN
});
```

## Quick Start (Full Example)

```typescript
// Deno (JSR)
import { TagLib } from "jsr:@charlesw/taglib-wasm";

// Deno (NPM)
import { TagLib } from "npm:taglib-wasm";

// Node.js/Bun
import { TagLib } from "taglib-wasm";

// Initialize the library
const taglib = await TagLib.initialize();

// Read tags from an audio file (accepts path, buffer, or File)
using audioFile = await taglib.open("song.mp3"); // or buffer/File
const tag = audioFile.tag();

console.log({
  title: tag.title,
  artist: tag.artist,
  album: tag.album,
  year: tag.year,
});
// Automatically cleaned up when audioFile goes out of scope
```

## Key Concepts

### 1. Initialization

- **Always call `TagLib.initialize()` once** before using any functionality
- This returns a TagLib instance that you use for all operations
- Store this instance and reuse it throughout your application
- Deno compile mode is auto-detected; `initializeForDenoCompile()` is only
  needed for custom embedded Wasm paths

### 2. Memory Management

- **CRITICAL**: Always ensure AudioFile instances are cleaned up when done
- Forgetting to clean up causes memory leaks as C++ objects aren't garbage
  collected
- Use `using` for automatic cleanup (preferred), or call `dispose()` manually as
  a fallback:

```typescript
const taglib = await TagLib.initialize();

// ✅ PREFERRED: Automatic cleanup with `using`
using audioFile = await taglib.open("song.mp3"); // or buffer/File
// ... work with file
// Automatically cleaned up when audioFile goes out of scope

// ✅ FALLBACK: Manual cleanup with dispose()
const audioFile2 = await taglib.open("song.mp3");
// ... work with file
audioFile2.dispose();
```

### 3. File Loading

- The `open` method accepts multiple input types:
  `string | ArrayBuffer | Uint8Array | File`
- For file paths (Node.js/Deno/Bun): pass the path as a string
- For buffers: pass ArrayBuffer or Uint8Array directly
- For browser File objects: pass the File directly

```typescript
const taglib = await TagLib.initialize();

// From file path (Node.js/Deno/Bun)
using audioFile1 = await taglib.open("path/to/song.mp3");

// From buffer (all environments)
// Node.js example:
import { readFile } from "fs/promises";
const buffer = await readFile("song.mp3");
using audioFile2 = await taglib.open(buffer);

// From browser File object
using audioFile3 = await taglib.open(fileFromInput);
```

## Important Distinctions

### Reading vs Writing Tags

- **Reading**: Use properties (e.g., `tag.title`)
- **Writing**: Use setter methods (e.g., `tag.setTitle("New")`)
- **Why**: This matches TagLib's C++ API design

```typescript
// ✅ CORRECT
const title = tag.title; // Read: property
tag.setTitle("New Title"); // Write: method

// ❌ WRONG
const title = tag.getTitle(); // No getter methods
tag.title = "New Title"; // Can't assign to property
```

### Save Patterns

```typescript
// Pattern 1: Modify file in memory, get buffer
const success = audioFile.save(); // Returns boolean
const buffer = audioFile.getFileBuffer(); // Get modified data

// Pattern 2: Using Simple API (file path required)
await writeTagsToFile("file.mp3", { title: "New" }); // Writes to disk

// Pattern 3: Using Simple API (get buffer)
const buffer = await applyTagsToBuffer("file.mp3", { title: "New" }); // Returns buffer
```

### Initialization Options

```typescript
// Default (automatic Wasm loading) - Most common
const taglib = await TagLib.initialize();

// Custom Wasm URL (for CDN/streaming) - Best performance
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Embedded Wasm (for offline/compiled apps)
const wasmData = await fetch("taglib-web.wasm").then((r) => r.arrayBuffer());
const taglib = await TagLib.initialize({
  wasmBinary: wasmData,
});

// Deno compiled binaries — auto-detected by TagLib.initialize()
// Use initializeForDenoCompile() only for custom Wasm paths:
const taglib = await initializeForDenoCompile("./assets/taglib-web.wasm");
```

### Runtime Detection (WASI vs Emscripten)

taglib-wasm automatically selects the optimal WebAssembly backend:

| Environment            | Backend           | How it works                                                          |
| ---------------------- | ----------------- | --------------------------------------------------------------------- |
| **Deno / Node.js**     | WASI (auto)       | Seek-based filesystem I/O — reads only headers/tags, not entire files |
| **Browsers / Workers** | Emscripten (auto) | Entire file loaded into memory as buffer                              |

```typescript
const taglib = await TagLib.initialize();

// Check which implementation is active
console.log(taglib.isWasi); // true for Deno/Node.js
console.log(taglib.isEmscripten); // true for browsers/Workers
```

Most users don't need to configure this — it's automatic.

To force a specific backend (e.g., for testing or compatibility):

```typescript
// Force Emscripten buffer mode (in-memory I/O)
const taglib = await TagLib.initialize({ forceBufferMode: true });

// Force a specific Wasm backend
const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

// For Simple API, set buffer mode globally
import { setBufferMode } from "taglib-wasm";
setBufferMode(true); // All subsequent Simple API calls use Emscripten
```

### Module Systems

```typescript
// ESM (recommended for all modern environments)
import { TagLib } from "taglib-wasm";

// CommonJS (older Node.js projects)
const { TagLib } = require("taglib-wasm");

// Dynamic import (when needed conditionally)
const { TagLib } = await import("taglib-wasm");

// Deno with JSR (preferred)
import { TagLib } from "jsr:@charlesw/taglib-wasm";

// Deno with npm specifier
import { TagLib } from "npm:taglib-wasm";
```

## Common Patterns

### Reading Basic Tags

```typescript
const taglib = await TagLib.initialize();
using audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

// Tags are accessed as properties, not methods
const metadata = {
  title: tag.title, // string
  artist: tag.artist, // string
  album: tag.album, // string
  year: tag.year, // number
  track: tag.track, // number
  genre: tag.genre, // string
  comment: tag.comment, // string
};
```

### Writing Tags

```typescript
const taglib = await TagLib.initialize();
using audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

// Set individual tags using setter methods
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");
tag.setYear(2024);
tag.setTrack(5);

// Save changes (returns boolean)
const success = audioFile.save();

if (success) {
  // Get the modified buffer
  const modifiedBuffer = audioFile.getFileBuffer();

  // Write back to storage
  await fs.writeFile("modified.mp3", modifiedBuffer);
}
```

### Audio Properties

```typescript
const taglib = await TagLib.initialize();
using audioFile = await taglib.open(buffer);
const props = audioFile.audioProperties();

// Properties are accessed directly, not via methods
const audioInfo = {
  duration: props.length, // Duration in seconds
  bitrate: props.bitrate, // Bitrate in kb/s
  sampleRate: props.sampleRate, // Sample rate in Hz
  channels: props.channels, // Number of channels
  bitsPerSample: props.bitsPerSample, // Bits per sample (0 if N/A)
  codec: props.codec, // Audio codec (e.g., "AAC", "ALAC", "MP3")
  containerFormat: props.containerFormat, // Container (e.g., "MP4", "OGG")
  isLossless: props.isLossless, // true for lossless formats
};
```

### Working with Ratings

```typescript
const taglib = await TagLib.initialize();
using audioFile = await taglib.open(buffer);

// Read rating (normalized 0.0-1.0)
const rating = audioFile.getRating(); // undefined if no rating

// Read all ratings (multiple raters supported)
const ratings = audioFile.getRatings();
// Returns: [{ rating: 0.8, email: "user@example.com", counter: 42 }, ...]

// Set rating
audioFile.setRating(0.8); // 4 out of 5 stars
audioFile.setRating(0.8, "user@example.com"); // With rater ID

audioFile.save();
```

### RatingUtils for Conversions

```typescript
import { RatingUtils } from "taglib-wasm";

// Normalized <-> POPM (ID3v2 0-255 scale)
RatingUtils.toPopm(0.8); // 196
RatingUtils.fromPopm(196); // 0.8

// Normalized <-> Stars
RatingUtils.toStars(0.8); // 4 (default 5-star scale)
RatingUtils.toStars(0.8, 10); // 8 (10-star scale)
RatingUtils.fromStars(4); // 0.8
RatingUtils.fromStars(8, 10); // 0.8

// Normalized <-> Percent
RatingUtils.toPercent(0.8); // 80
RatingUtils.fromPercent(80); // 0.8

// Validation
RatingUtils.isValid(0.8); // true
RatingUtils.isValid(1.5); // false
RatingUtils.clamp(1.5); // 1.0

// Standard POPM values (WMP convention)
RatingUtils.POPM_STAR_VALUES; // [0, 1, 64, 128, 196, 255]
```

### Using the Simple API

For basic operations without manual memory management:

```typescript
// Deno (JSR)
import {
  applyCoverArt,
  applyTagsToBuffer,
  readCoverArt,
  readTags,
  writeTagsToFile,
} from "jsr:@charlesw/taglib-wasm/simple";

// Deno (NPM)
import {
  applyCoverArt,
  applyTagsToBuffer,
  readCoverArt,
  readTags,
  writeTagsToFile,
} from "npm:taglib-wasm/simple";

// Node.js/Bun
import {
  applyCoverArt,
  applyTagsToBuffer,
  readCoverArt,
  readTags,
  writeTagsToFile,
} from "taglib-wasm/simple";

// Read tags - no need to manage AudioFile instances
const tags = await readTags("song.mp3");
console.log(tags); // { title, artist, album, year, ... }

// Apply tags to get modified buffer
const modifiedBuffer = await applyTagsToBuffer("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});

// Update tags in-place (file path only)
await writeTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});

// Handle cover art
const coverData = await readCoverArt("song.mp3");
if (coverData) {
  await fs.writeFile("cover.jpg", coverData);
}

// Set cover art
const imageData = await fs.readFile("album-art.jpg");
const bufferWithArt = await applyCoverArt("song.mp3", imageData, "image/jpeg");
```

### Batch Processing with Simple API (10-20x Performance Boost)

For high-performance processing of multiple files:

```typescript
import {
  readMetadataBatch,
  readPropertiesBatch,
  readTagsBatch,
} from "taglib-wasm/simple";

// Process multiple files efficiently
const files = ["song1.mp3", "song2.mp3", "song3.mp3"];

// Read tags from all files (10-20x faster than sequential)
const tagsResult = await readTagsBatch(files, {
  concurrency: 8, // Process 8 files in parallel (optimal for most systems)
  onProgress: (processed, total) => {
    console.log(`Progress: ${processed}/${total}`);
  },
});

// Handle results
for (const { file, data } of tagsResult.results) {
  console.log(`${file}: ${data.artist} - ${data.title}`);
}

// Check for errors
if (tagsResult.errors.length > 0) {
  console.error(`Failed to process ${tagsResult.errors.length} files`);
}

// Read complete metadata (tags + properties + cover art + dynamics) in one batch
const metadata = await readMetadataBatch(files, { concurrency: 8 });

for (const { file, data } of metadata.results) {
  console.log(`${file}:`);
  console.log(`  Title: ${data.tags.title}`);
  console.log(`  Duration: ${data.properties?.length}s`);
  console.log(`  Bitrate: ${data.properties?.bitrate}kbps`);
  console.log(`  Has cover art: ${data.hasCoverArt}`);

  if (data.dynamics?.replayGainTrackGain) {
    console.log(`  ReplayGain: ${data.dynamics.replayGainTrackGain}`);
  }
  if (data.dynamics?.appleSoundCheck) {
    console.log(`  Apple Sound Check: detected`);
  }
}

// Real-world performance comparison:
// Sequential: ~90 seconds for 19 files
// Batch (concurrency=8): ~5 seconds (18x faster!)
//
// For album processing (20 tracks):
// Sequential: ~100 seconds
// Batch: ~5-6 seconds (16-20x faster!)
```

#### Concurrency Tuning Guide

```typescript
// Optimal concurrency depends on your system and file locations:

// LOCAL SSD: Higher concurrency (8-16)
const localResult = await readTagsBatch(localFiles, {
  concurrency: 12, // Fast local disk can handle more
});

// NETWORK/HDD: Lower concurrency (4-8)
const networkResult = await readTagsBatch(networkFiles, {
  concurrency: 6, // Slower I/O benefits from less concurrency
});

// MEMORY CONSTRAINED: Lower concurrency (2-4)
const lowMemResult = await readTagsBatch(files, {
  concurrency: 4, // Each file uses ~2x its size in memory
});

// AUTO-TUNE: Start high, reduce on errors
let concurrency = 16;
while (concurrency > 2) {
  const result = await readTagsBatch(files, { concurrency });
  if (result.errors.length === 0) break;
  concurrency = Math.floor(concurrency / 2);
}
```

### Using the Folder API

For batch operations on multiple audio files (Node.js/Deno/Bun only):

```typescript
// Deno (JSR - note: imported from main module)
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "jsr:@charlesw/taglib-wasm";

// Deno (NPM)
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "npm:taglib-wasm";

// Node.js/Bun
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "taglib-wasm";

// Scan a directory for all audio files
const result = await scanFolder("/path/to/music", {
  recursive: true, // Scan subdirectories (default: true)
  extensions: [".mp3", ".flac"], // File types to include
  concurrency: 4, // Parallel processing (default: 4)
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});

console.log(`Found ${result.totalFound} audio files`);
console.log(`Successfully processed ${result.totalProcessed}`);

// Access metadata for each file
for (const file of result.items) {
  console.log(`${file.path}: ${file.tags.artist} - ${file.tags.title}`);
  console.log(`Duration: ${file.properties?.length}s`);

  // Check for cover art
  if (file.hasCoverArt) {
    console.log(`  Has cover art`);
  }

  // Check for volume normalization data
  if (file.dynamics?.replayGainTrackGain) {
    console.log(`  ReplayGain: ${file.dynamics.replayGainTrackGain}`);
  }
  if (file.dynamics?.appleSoundCheck) {
    console.log(`  Has Apple Sound Check data`);
  }
}

// Batch update tags
const updates = [
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  { path: "/music/song2.mp3", tags: { album: "New Album" } },
];

const updateResult = await updateFolderTags(updates);
console.log(`Updated ${updateResult.successful} files`);

// Find duplicates
const duplicates = await findDuplicates("/music", {
  criteria: ["artist", "title"],
});
console.log(`Found ${duplicates.size} groups of duplicates`);

// Export metadata to JSON
await exportFolderMetadata("/music", "./music-catalog.json");
```

Key folder API features:

- **Concurrent processing** for performance
- **Progress callbacks** for long operations
- **Error handling** that continues on failures
- **Memory efficient** batch processing
- **Cross-runtime** support (Deno, Node.js, Bun)

### Advanced Metadata (PropertyMap)

```typescript
import { TagLib } from "taglib-wasm";
import { PROPERTIES, PropertyKey } from "taglib-wasm/constants";

const taglib = await TagLib.initialize();
using audioFile = taglib.openFile(buffer);

// Get complete property map - all metadata as key-value pairs
const properties = audioFile.properties();
console.log(properties); // { ALBUMARTIST: ["Various"], BPM: ["120"], ... }

// Using PROPERTIES constant for type-safe access (recommended)
const title = audioFile.getProperty(PROPERTIES.TITLE.key);
const musicBrainzId = audioFile.getProperty(PROPERTIES.MUSICBRAINZ_TRACKID.key);
const replayGain = audioFile.getProperty(PROPERTIES.REPLAYGAIN_TRACK_GAIN.key);

// Access property metadata
const titleProp = PROPERTIES.TITLE;
console.log(titleProp.description); // "The title of the track"
console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]

// Iterate through all known properties with metadata
Object.values(PROPERTIES).forEach((prop) => {
  const value = audioFile.getProperty(prop.key);
  if (value !== undefined) {
    console.log(`${prop.key}: ${value} (${prop.description})`);
  }
});

// Write advanced properties
audioFile.setProperty(PROPERTIES.MUSICBRAINZ_ALBUMID.key, "some-uuid");
audioFile.setProperty(PROPERTIES.REPLAYGAIN_TRACK_GAIN.key, "-3.5 dB");

// Set multiple properties at once
audioFile.setProperties({
  [PROPERTIES.ALBUMARTIST.key]: ["Album Artist"],
  [PROPERTIES.COMPOSER.key]: ["Composer Name"],
  [PROPERTIES.BPM.key]: ["120"],
});

// Save and get modified buffer
audioFile.save();
const modifiedBuffer = audioFile.getFileBuffer();
```

#### Property Discovery Functions

```typescript
import {
  getAllPropertyKeys,
  getPropertiesByFormat,
  isValidProperty,
} from "taglib-wasm/constants";

// Check if a property is valid
isValidProperty("ACOUSTID_ID"); // true

// Get all available property keys
const allKeys = getAllPropertyKeys(); // ["TITLE", "ARTIST", "ALBUM", ...]

// Get properties supported by a specific format
const mp3Properties = getPropertiesByFormat("MP3");
const flacProperties = getPropertiesByFormat("FLAC");
```

## Supported Formats

All formats are automatically detected from file content:

- **MP3** - ID3v1, ID3v2.3, ID3v2.4
- **MP4/M4A** - iTunes-style tags
- **FLAC** - Vorbis comments
- **OGG Vorbis** - Vorbis comments
- **WAV** - RIFF INFO chunks

Additional formats supported by TagLib but less commonly used:

- **Opus** - Ogg Opus files
- **APE** - Monkey's Audio
- **MPC** - Musepack
- **WavPack** - WavPack files
- **TrueAudio** - TTA files

## Error Handling

The library provides typed errors for better error handling:

```typescript
import {
  FileOperationError,
  isFileOperationError,
  isTagLibError,
  isUnsupportedFormatError,
  TagLibError,
  UnsupportedFormatError,
} from "taglib-wasm";

try {
  using audioFile = await taglib.open(buffer);
  // ... use audioFile
} catch (error) {
  if (isUnsupportedFormatError(error)) {
    console.error("Unsupported format:", error.format);
  } else if (isFileOperationError(error)) {
    console.error("File error:", error.operation, error.path);
  } else if (isTagLibError(error)) {
    console.error("TagLib error:", error.message);
  }
}
```

Common error types:

- `TagLibInitializationError` - Wasm module failed to initialize
- `FileOperationError` - File read/write errors
- `UnsupportedFormatError` - Unknown or unsupported audio format
- `InvalidFormatError` - Corrupted or invalid file
- `MemoryError` - Memory allocation failures
- `MetadataError` - Tag reading/writing errors

## Common Recipes

### Recipe: Container Format and Codec Detection

```typescript
import { readProperties } from "taglib-wasm/simple";

// Detect container format and codec
const props = await readProperties("audio.m4a");

console.log(`Container: ${props.containerFormat}`); // "MP4"
console.log(`Codec: ${props.codec}`); // "AAC" or "ALAC"
console.log(`Lossless: ${props.isLossless}`); // false for AAC, true for ALAC

// Understanding container vs codec:
// - Container format: How audio data and metadata are packaged
// - Codec: How audio is compressed/encoded

// Examples of container/codec combinations:
// MP4 container (.m4a) → AAC (lossy) or ALAC (lossless)
// OGG container → Vorbis, Opus, FLAC, or Speex
// MP3 → Both container and codec
// FLAC → Both container and codec

// Batch analysis
const files = ["song1.mp3", "song2.m4a", "song3.ogg", "song4.flac"];
for (const file of files) {
  const props = await readProperties(file);
  console.log(
    `${file}: ${props.containerFormat} container, ${props.codec} codec`,
  );
}
```

### Recipe: Add Album Art / Cover Image

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";

// Read existing cover art
const coverData = await readCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set new cover art
const imageData = await Deno.readFile("album-art.jpg");
const modifiedBuffer = await applyCoverArt("song.mp3", imageData, "image/jpeg");
await Deno.writeFile("song-with-art.mp3", modifiedBuffer);
```

### Recipe: Process Album Folder (Fastest Approach)

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
import { readdir } from "fs/promises";
import { join } from "path";

// FASTEST: Process complete album with all metadata
async function processAlbum(albumPath: string) {
  // Get all audio files in album folder
  const files = await readdir(albumPath);
  const audioFiles = files
    .filter((f) => /\.(mp3|flac|m4a|ogg)$/i.test(f))
    .map((f) => join(albumPath, f))
    .sort(); // Ensure track order

  // Process all tracks in parallel (10-20x faster than sequential)
  const result = await readMetadataBatch(audioFiles, {
    concurrency: 8, // Optimal for most systems
  });

  // Extract album metadata
  const albumData = {
    path: albumPath,
    trackCount: result.results.length,
    totalDuration: 0,
    averageBitrate: 0,
    hasCompleteCoverArt: true,
    hasVolumeNormalization: true,
    tracks: [],
  };

  // Process results
  for (const { file, data } of result.results) {
    if (data.properties) {
      albumData.totalDuration += data.properties.duration || 0;
      albumData.averageBitrate += data.properties.bitrate || 0;
    }

    if (!data.hasCoverArt) albumData.hasCompleteCoverArt = false;
    if (!data.dynamics?.replayGainTrackGain) {
      albumData.hasVolumeNormalization = false;
    }

    albumData.tracks.push({
      file: path.basename(file),
      ...data.tags,
      duration: data.properties?.length,
      bitrate: data.properties?.bitrate,
      hasCoverArt: data.hasCoverArt,
    });
  }

  albumData.averageBitrate = Math.round(
    albumData.averageBitrate / result.results.length,
  );

  return albumData;
}

// Usage: Process album in ~5 seconds instead of ~90 seconds
const album = await processAlbum("/music/Pink Floyd - The Wall");
console.log(`Album: ${album.tracks[0]?.album}`);
console.log(`Tracks: ${album.trackCount}`);
console.log(`Duration: ${Math.round(album.totalDuration / 60)} minutes`);
console.log(`Average bitrate: ${album.averageBitrate} kbps`);
console.log(`Complete cover art: ${album.hasCompleteCoverArt}`);
```

### Recipe: Batch Rename Files Based on Metadata

```typescript
import { scanFolder } from "taglib-wasm";
import { rename } from "fs/promises"; // Node.js

const result = await scanFolder("/music");

for (const file of result.items) {
  const { artist, album, track, title } = file.tags;

  // Create new filename: "Artist - Album - 01 - Title.mp3"
  const trackNum = track?.toString().padStart(2, "0") || "00";
  const newName = `${artist} - ${album} - ${trackNum} - ${title}.mp3`;

  // Clean filename (remove invalid characters)
  const cleanName = newName.replace(/[<>:"/\\|?*]/g, "_");

  const dir = path.dirname(file.path);
  const newPath = path.join(dir, cleanName);

  await rename(file.path, newPath);
  console.log(`Renamed: ${path.basename(file.path)} → ${cleanName}`);
}
```

### Recipe: Convert Tags Between Formats

```typescript
import { readTags, writeTagsToFile } from "taglib-wasm/simple";

// Read tags from MP3 (ID3v2)
const mp3Tags = await readTags("song.mp3");

// Apply same tags to FLAC (Vorbis Comments)
await writeTagsToFile("song.flac", mp3Tags);

// Apply to M4A (iTunes atoms)
await writeTagsToFile("song.m4a", mp3Tags);

// Note: Format-specific fields are automatically mapped
```

### Recipe: Find and Handle Duplicates

```typescript
import { findDuplicates } from "taglib-wasm";
import { readProperties } from "taglib-wasm/simple";

const duplicates = await findDuplicates("/music", {
  criteria: ["artist", "title"],
});

for (const [key, files] of duplicates) {
  console.log(`\nDuplicate: ${key}`);

  // Sort by quality (highest bitrate first)
  const filesWithProps = await Promise.all(
    files.map(async (f) => ({
      ...f,
      props: await readProperties(f.path),
    })),
  );

  filesWithProps.sort((a, b) => b.props.bitrate - a.props.bitrate);

  // Keep best quality, mark others for removal
  const [keep, ...remove] = filesWithProps;
  console.log(`KEEP: ${keep.path} (${keep.props.bitrate}kbps)`);

  for (const file of remove) {
    console.log(`REMOVE: ${file.path} (${file.props.bitrate}kbps)`);
    // await unlink(file.path); // Uncomment to actually delete
  }
}
```

### Recipe: Identify Files Needing Cover Art or Volume Normalization

```typescript
// Using Folder API (for directory scanning)
import { scanFolder } from "taglib-wasm";

const result = await scanFolder("/music", {
  recursive: true,
  concurrency: 8,
});

// Find files missing cover art
const filesNeedingArt = result.items.filter((f) => !f.hasCoverArt);
console.log(`Files missing cover art: ${filesNeedingArt.length}`);

for (const file of filesNeedingArt) {
  console.log(`- ${file.path}`);
}

// Find files without volume normalization
const filesNeedingNormalization = result.items.filter((f) =>
  !f.dynamics?.replayGainTrackGain && !f.dynamics?.appleSoundCheck
);
console.log(
  `\nFiles needing volume normalization: ${filesNeedingNormalization.length}`,
);

// Analyze existing normalization
const replayGainFiles = result.items.filter((f) =>
  f.dynamics?.replayGainTrackGain
);
const soundCheckFiles = result.items.filter((f) => f.dynamics?.appleSoundCheck);

console.log(`\nNormalization stats:`);
console.log(`- ReplayGain: ${replayGainFiles.length} files`);
console.log(`- Apple Sound Check: ${soundCheckFiles.length} files`);
console.log(`- No normalization: ${filesNeedingNormalization.length} files`);
```

### Recipe: Analyze Files Using Batch API

```typescript
// Using Simple API batch functions (for specific file lists)
import { readMetadataBatch } from "taglib-wasm/simple";

const files = [
  "album/track01.mp3",
  "album/track02.mp3",
  "album/track03.mp3",
];

const result = await readMetadataBatch(files, {
  concurrency: 8,
});

// Analyze cover art
const withCoverArt = result.results.filter((r) => r.data.hasCoverArt);
const withoutCoverArt = result.results.filter((r) => !r.data.hasCoverArt);

console.log(`Cover art analysis:`);
console.log(`- With cover art: ${withCoverArt.length} files`);
console.log(`- Without cover art: ${withoutCoverArt.length} files`);

// Analyze volume normalization
const withReplayGain = result.results.filter((r) =>
  r.data.dynamics?.replayGainTrackGain
);
const withSoundCheck = result.results.filter((r) =>
  r.data.dynamics?.appleSoundCheck
);
const withoutNormalization = result.results.filter((r) =>
  !r.data.dynamics?.replayGainTrackGain && !r.data.dynamics?.appleSoundCheck
);

console.log(`\nNormalization analysis:`);
console.log(`- ReplayGain: ${withReplayGain.length} files`);
console.log(`- Sound Check: ${withSoundCheck.length} files`);
console.log(`- No normalization: ${withoutNormalization.length} files`);

// List files needing attention
if (withoutCoverArt.length > 0) {
  console.log(`\nFiles needing cover art:`);
  for (const { file } of withoutCoverArt) {
    console.log(`- ${file}`);
  }
}
```

### Recipe: Add ReplayGain for Volume Normalization

```typescript
import { TagLib } from "taglib-wasm";
import { PROPERTIES } from "taglib-wasm/constants";

const taglib = await TagLib.initialize();
using audioFile = await taglib.open("song.mp3");

// Set ReplayGain values (you'd calculate these with an audio analysis tool)
audioFile.setProperty(PROPERTIES.REPLAYGAIN_TRACK_GAIN.key, "-3.21 dB");
audioFile.setProperty(PROPERTIES.REPLAYGAIN_TRACK_PEAK.key, "0.988235");
audioFile.setProperty(PROPERTIES.REPLAYGAIN_ALBUM_GAIN.key, "-4.19 dB");
audioFile.setProperty(PROPERTIES.REPLAYGAIN_ALBUM_PEAK.key, "0.998871");

// Or use the convenience methods
audioFile.setReplayGainTrackGain("-3.21 dB");
audioFile.setReplayGainTrackPeak("0.988235");
audioFile.setReplayGainAlbumGain("-4.19 dB");
audioFile.setReplayGainAlbumPeak("0.998871");

audioFile.save();
const buffer = audioFile.getFileBuffer();

// For batch processing entire albums
import { scanFolder, TagLib } from "taglib-wasm";

const result = await scanFolder("/album");
const taglib = await TagLib.initialize();

for (const file of result.items) {
  using audioFile = await taglib.open(file.path);

  audioFile.setReplayGainAlbumGain("-4.19 dB");
  audioFile.setProperty("REPLAYGAIN_REFERENCE_LOUDNESS", "89.0 dB");

  await audioFile.saveToFile(); // Save back to original file
}
```

### Recipe: Clean Up Messy Tags

```typescript
import { scanFolder, updateFolderTags } from "taglib-wasm";

const result = await scanFolder("/messy-music");

const updates = result.items.map((file) => {
  const cleaned = {
    // Capitalize properly
    artist: file.tags.artist?.split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" "),

    // Remove "Unknown" values
    album: file.tags.album === "Unknown Album" ? "" : file.tags.album,

    // Extract year from comment if needed
    year: file.tags.year ||
      parseInt(file.tags.comment?.match(/\b(19|20)\d{2}\b/)?.[0] || ""),

    // Clean up genre
    genre: file.tags.genre?.replace(/\(\d+\)/, "").trim(),
  };

  return { path: file.path, tags: cleaned };
});

await updateFolderTags(updates.filter((u) => Object.keys(u.tags).length > 0));
```

## Troubleshooting Guide

### Common Errors and Solutions

| Error Message                    | Cause                        | Solution                                     |
| -------------------------------- | ---------------------------- | -------------------------------------------- |
| "Module not initialized"         | Wasm not loaded              | Ensure `await TagLib.initialize()` completed |
| "Invalid audio file format"      | Unsupported/corrupted file   | Check file extension and size (>1KB)         |
| "Cannot read property of null"   | Accessing disposed AudioFile | Check disposal order in code                 |
| "File too small"                 | Empty or truncated file      | Validate file size before processing         |
| "Failed to allocate memory"      | Large file or memory leak    | Use `using` or check for missing `dispose()` |
| "File not found"                 | Wrong path or permissions    | Verify file exists and is readable           |
| "Save failed"                    | Write permissions            | Check file/directory write permissions       |
| "WebAssembly.instantiate failed" | CORS or network issue        | Check WASM URL and CORS headers              |

### Debug Patterns

```typescript
// Pattern 1: Validate input before processing
if (buffer.byteLength < 1024) {
  throw new Error(`File too small: ${buffer.byteLength} bytes`);
}

// Pattern 2: Track memory usage
let activeFiles = 0;
{
  using audioFile = await taglib.open(buffer);
  activeFiles++;
  console.log(`Active AudioFiles: ${activeFiles}`);
  // ... work with file
} // audioFile automatically disposed here
activeFiles--;

// Pattern 3: Detailed error logging
try {
  using audioFile = await taglib.open(buffer);
  // ...
} catch (error) {
  console.error({
    message: error.message,
    fileSize: buffer.byteLength,
    firstBytes: Array.from(buffer.slice(0, 4)),
    stack: error.stack,
  });
}
```

### Memory Leak Prevention

```typescript
// ❌ BAD: Memory leak
const files = await scanFolder("/music");
for (const file of files.files) {
  const audioFile = await taglib.open(file.path);
  const tag = audioFile.tag();
  // Forgot to dispose!
}

// ✅ GOOD: Automatic cleanup with `using`
const files = await scanFolder("/music");
for (const file of files.files) {
  using audioFile = await taglib.open(file.path);
  const tag = audioFile.tag();
  // ... work with tag
} // audioFile automatically disposed each iteration

// ✅ ALSO GOOD: Use Simple API for automatic cleanup
for (const file of files.files) {
  const tags = await readTags(file.path);
  // No disposal needed!
}
```

## Platform-Specific Notes

### Node.js / Bun

- Use `fs.readFile()` or `fs.promises.readFile()` to load files
- Full filesystem access available
- Folder API works out of the box

### Browsers

- Use `fetch()` or FileReader API to load files
- No filesystem access; work with buffers in memory
- Folder API not available (no filesystem)

### Deno

- Prefer JSR package: `import { TagLib } from 'jsr:@charlesw/taglib-wasm'`
- Alternative NPM: `import { TagLib } from 'npm:taglib-wasm'`
- Use `Deno.readFile()` to load files
- Remember to grant file permissions with `--allow-read`
- Full example:

```typescript
import { applyTagsToBuffer, readTags } from "jsr:@charlesw/taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.artist);

// Modify tags (returns buffer)
const modified = await applyTagsToBuffer("song.mp3", {
  artist: "New Artist",
  album: "New Album",
});

// Write back to file
await Deno.writeFile("song-modified.mp3", modified);
```

### Deno Compiled Binaries

`TagLib.initialize()` auto-detects Deno compile mode — no special API needed:

#### Option 1: Auto-Detection (Recommended)

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm";

// Works in both development and compiled binaries
const taglib = await TagLib.initialize();

if (import.meta.main) {
  const [filePath] = Deno.args;
  using audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
}
```

For offline support, embed the Wasm file:

```bash
deno compile --allow-read --include taglib-web.wasm myapp.ts
```

#### Option 2: Explicit Helper (Custom Wasm Path)

```typescript
import { initializeForDenoCompile } from "jsr:@charlesw/taglib-wasm";

// Use when you need a custom embedded Wasm path
const taglib = await initializeForDenoCompile("./assets/taglib-web.wasm");
```

#### Option 3: CDN Loading (Online Only)

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm";

const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});
```

Compile with:

```bash
deno compile --allow-read --allow-net music-tagger.ts
```

#### Performance Considerations

- **CDN Loading**: Smallest binary, uses streaming compilation, requires network
  on first run
- **Embedded Wasm**: Larger binary size (~500KB) but self-contained and works
  offline
- **WebAssembly Streaming**: 200-400ms with streaming vs 400-800ms without
- All approaches have identical runtime performance after initialization

### Cloudflare Workers

Cloudflare Workers use the same unified API as every other platform:

```typescript
import { TagLib } from "taglib-wasm";

let taglib: Awaited<ReturnType<typeof TagLib.initialize>> | null = null;

export default {
  async fetch(request: Request): Promise<Response> {
    if (!taglib) {
      taglib = await TagLib.initialize();
    }

    const audioData = new Uint8Array(await request.arrayBuffer());
    using file = await taglib.open(audioData);
    const tag = file.tag();

    return Response.json({
      title: tag.title,
      artist: tag.artist,
      album: tag.album,
    });
  },
};
```

## Performance Tips

### 🚀 Maximum Performance Checklist

1. **Use Batch APIs for Multiple Files** (10-20x speedup)

   ```typescript
   // ❌ SLOW: Sequential processing
   for (const file of files) {
     const tags = await readTags(file); // ~5 seconds per file
   }

   // ✅ FAST: Batch processing
   const results = await readTagsBatch(files, { concurrency: 8 }); // ~5 seconds total!
   ```

2. **Optimize Concurrency for Your System**
   - **SSD/Fast disk**: concurrency: 8-16
   - **HDD/Network**: concurrency: 4-8
   - **Low memory**: concurrency: 2-4
   - **Default optimal**: concurrency: 8

3. **Choose the Right API**
   - **Reading many files**: `readTagsBatch()` or `readMetadataBatch()`
   - **Scanning folders**: `scanFolder()` with high concurrency
   - **Single file**: `readTags()` (Simple API)
   - **Complex operations**: Full API with manual optimization

4. **Memory Management**
   - Simple API: Automatic cleanup (recommended)
   - Full API: Use `using` for automatic cleanup, or `dispose()` as fallback
   - Each file uses ~2x its size in memory during processing

5. **Album/Folder Processing**

   ```typescript
   // FASTEST: Process entire album at once
   const albumFiles = getAlbumFiles();
   const metadata = await readMetadataBatch(albumFiles, {
     concurrency: 8, // Process 8 tracks simultaneously
   });
   ```

6. **WebAssembly Optimization**
   - Use CDN URL for streaming compilation (200-400ms vs 400-800ms)
   - Initialize once and reuse the instance
   - Larger memory allocation for batch operations

## Common Mistakes to Avoid

### ❌ DON'T vs ✅ DO

| ❌ DON'T                         | ✅ DO                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- |
| `TagLib.open(buffer)`            | `const taglib = await TagLib.initialize();`<br>`await taglib.open(buffer)` |
| `audioFile.tag().getTitle()`     | `audioFile.tag().title`                                                    |
| `tag.title = "New"`              | `tag.setTitle("New")`                                                      |
| Forget to dispose                | Use `using` for automatic cleanup (or `dispose()` manually)                |
| Use AudioFile after dispose      | Dispose should be the last operation                                       |
| Load Wasm multiple times         | Initialize once, reuse the instance                                        |
| Process files sequentially       | Use Folder API for batch operations                                        |
| Import from `taglib-wasm/folder` | Import from main module                                                    |
| Mix JSR and NPM in Deno          | Use only JSR package for Deno apps                                         |

### Critical Memory Management

```typescript
// ❌ DON'T: This leaks memory
async function getTitles(files) {
  const titles = [];
  for (const file of files) {
    const audioFile = await taglib.open(file);
    titles.push(audioFile.tag().title);
    // MISSING: cleanup!
  }
  return titles;
}

// ✅ DO: Automatic cleanup with `using`
async function getTitles(files) {
  const titles = [];
  for (const file of files) {
    using audioFile = await taglib.open(file);
    titles.push(audioFile.tag().title);
  } // audioFile automatically disposed each iteration
  return titles;
}

// ✅ BETTER: Use Simple API
async function getTitles(files) {
  return Promise.all(
    files.map(async (file) => (await readTags(file)).title),
  );
}
```

### Common Async Pitfalls

```typescript
// ❌ DON'T: Forget await
const taglib = TagLib.initialize(); // Missing await!
const file = taglib.open(buffer); // This will fail

// ✅ DO: Always await async operations
const taglib = await TagLib.initialize();
using file = await taglib.open(buffer);

// ❌ DON'T: Assume operations are instant
audioFile.save();
const buffer = audioFile.getFileBuffer(); // May not include all changes

// ✅ DO: Check save result
const success = audioFile.save();
if (success) {
  const buffer = audioFile.getFileBuffer();
}
```

## Type Definitions

Key interfaces to reference:

```typescript
interface Tag {
  // Properties (read)
  title: string;
  artist: string;
  album: string;
  year: number;
  track: number;
  genre: string;
  comment: string;

  // Methods (write)
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
  setGenre(value: string): void;
  setComment(value: string): void;
}

interface AudioProperties {
  length: number; // Duration in seconds
  bitrate: number; // Bitrate in kb/s
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels
}

interface PropertyMap {
  properties(): Record<string, string[]>;
  set(key: string, value: string[]): boolean;
  get(key: string): string[] | undefined;
  contains(key: string): boolean;
  isEmpty(): boolean;
  propertyCount(): number;
  removeAll(): void;
}

// Folder API Types
interface FolderScanOptions {
  recursive?: boolean; // Scan subdirectories (default: true)
  extensions?: string[]; // File extensions to include
  maxFiles?: number; // Max files to process
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  includeProperties?: boolean; // Include audio properties (default: true)
  continueOnError?: boolean; // Continue on errors (default: true)
  concurrency?: number; // Parallel processing limit (default: 4)
}

interface FolderScanResult {
  files: AudioFileMetadata[]; // Successfully processed files
  errors: Array<{ path: string; error: Error }>; // Failed files
  totalFound: number; // Total audio files found
  totalProcessed: number; // Successfully processed count
  duration: number; // Time taken in milliseconds
}

interface AudioFileMetadata {
  path: string; // File path
  tags: Tag; // Metadata tags
  properties?: AudioProperties; // Audio properties (optional)
  hasCoverArt?: boolean; // Whether file has embedded cover art
  dynamics?: AudioDynamics; // ReplayGain and Sound Check data
  error?: Error; // Error if processing failed
}

interface AudioDynamics {
  replayGainTrackGain?: string; // Track gain in dB (e.g., "-6.54 dB")
  replayGainTrackPeak?: string; // Track peak value (0.0-1.0)
  replayGainAlbumGain?: string; // Album gain in dB
  replayGainAlbumPeak?: string; // Album peak value (0.0-1.0)
  appleSoundCheck?: string; // Apple Sound Check normalization data
}
```

## Example: Complete Music Library Scanner

### Using the Folder API (Recommended)

```typescript
// Node.js/Bun
import { exportFolderMetadata, findDuplicates, scanFolder } from "taglib-wasm";

// Deno (JSR)
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
} from "jsr:@charlesw/taglib-wasm";

// Deno (NPM)
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
} from "npm:taglib-wasm";

async function analyzeMusicLibrary(directory: string) {
  console.log("Scanning music library...");

  // Scan with progress tracking
  const result = await scanFolder(directory, {
    recursive: true,
    concurrency: 8, // Process 8 files in parallel
    onProgress: (processed, total, file) => {
      if (processed % 100 === 0) { // Log every 100 files
        console.log(
          `Progress: ${processed}/${total} (${
            Math.round(processed / total * 100)
          }%)`,
        );
      }
    },
  });

  console.log(`\nScan complete:`);
  console.log(`- Total files: ${result.totalFound}`);
  console.log(`- Processed: ${result.totalProcessed}`);
  console.log(`- Errors: ${result.errors.length}`);
  console.log(`- Time: ${result.duration}ms`);

  // Analyze cover art and dynamics
  const filesWithCoverArt = result.items.filter((f) => f.hasCoverArt).length;
  const filesWithReplayGain =
    result.items.filter((f) => f.dynamics?.replayGainTrackGain).length;
  const filesWithSoundCheck =
    result.items.filter((f) => f.dynamics?.appleSoundCheck).length;

  console.log(`\nAnalysis:`);
  console.log(
    `- Files with cover art: ${filesWithCoverArt}/${result.totalProcessed}`,
  );
  console.log(`- Files with ReplayGain: ${filesWithReplayGain}`);
  console.log(`- Files with Sound Check: ${filesWithSoundCheck}`);

  // Find duplicates
  const duplicates = await findDuplicates(directory, {
    criteria: ["artist", "title"],
  });
  console.log(`\nFound ${duplicates.size} duplicate groups`);

  // Export full catalog
  await exportFolderMetadata(directory, "./music-catalog.json");
  console.log("\nExported catalog to music-catalog.json");

  // Return organized data
  return {
    library: result.items,
    duplicates: Array.from(duplicates.entries()),
    errors: result.errors,
    stats: {
      totalTracks: result.totalProcessed,
      totalDuration: result.items.reduce(
        (sum, f) => sum + (f.properties?.length || 0),
        0,
      ),
      filesWithCoverArt,
      filesNeedingCoverArt: result.totalProcessed - filesWithCoverArt,
      filesWithReplayGain,
      filesWithSoundCheck,
      totalSize: result.items.reduce(
        (sum, f) =>
          sum +
          ((f.properties?.length || 0) * (f.properties?.bitrate || 0) * 125),
        0,
      ),
    },
  };
}

// Usage
const analysis = await analyzeMusicLibrary("/path/to/music");
console.log(
  `Total duration: ${Math.round(analysis.stats.totalDuration / 3600)} hours`,
);
```

### Manual Approach (for custom requirements)

```typescript
import { TagLib } from "taglib-wasm";
import { readdir, readFile } from "fs/promises";
import { extname, join } from "path";

async function scanMusicLibraryManual(directory: string) {
  const taglib = await TagLib.initialize();
  const files = await readdir(directory, { recursive: true });
  const musicFiles = files.filter((f) =>
    [".mp3", ".flac", ".m4a", ".ogg"].includes(extname(f).toLowerCase())
  );

  const library = [];
  for (const file of musicFiles) {
    try {
      const path = join(directory, file);
      const buffer = await readFile(path);
      using audioFile = await taglib.open(buffer);

      const tag = audioFile.tag();
      const props = audioFile.audioProperties();

      library.push({
        path,
        title: tag.title,
        artist: tag.artist,
        album: tag.album,
        duration: props.length,
        bitrate: props.bitrate,
      });
    } catch (error) {
      console.error(`Failed to read ${file}:`, error.message);
    }
  }

  return library;
}
```

## WebAssembly Streaming Compilation

taglib-wasm automatically uses WebAssembly streaming APIs for optimal performance:

### Benefits of Streaming

- **Parallel Download & Compile**: Compilation begins while downloading
- **Lower Memory Usage**: No need to buffer entire WASM file
- **Faster Startup**: 200-400ms with streaming vs 400-800ms without
- **Better User Experience**: Reduced time to first interaction

### How to Enable

```typescript
// Automatic streaming when using CDN URL
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Works with any URL that supports streaming
const taglib = await TagLib.initialize({
  wasmUrl: "https://your-cdn.com/taglib.wasm",
});
```

### Requirements

- CORS headers must allow access
- Content-Type should be `application/wasm`
- HTTPS required in production

## Cross-Runtime Compatibility

taglib-wasm is designed to work across all JavaScript runtimes:

### Runtime Detection Pattern

```typescript
function detectRuntime(): string {
  // @ts-ignore
  if (typeof Deno !== "undefined") return "deno";
  // @ts-ignore
  if (typeof process !== "undefined") {
    // @ts-ignore
    if (process.versions?.bun) return "bun";
    return "node";
  }
  if (typeof window !== "undefined") return "browser";
  return "unknown";
}

// Runtime-specific initialization
const runtime = detectRuntime();
switch (runtime) {
  case "deno":
    // Use JSR package
    break;
  case "node":
  case "bun":
    // Use NPM package
    break;
  case "browser":
    // Use CDN or bundled
    break;
}
```

### File Loading by Runtime

```typescript
async function loadAudioFile(path: string): Promise<Uint8Array> {
  const runtime = detectRuntime();

  switch (runtime) {
    case "deno":
      return await Deno.readFile(path);

    case "node":
      const { readFile } = await import("fs/promises");
      return new Uint8Array(await readFile(path));

    case "bun":
      const file = Bun.file(path);
      return new Uint8Array(await file.arrayBuffer());

    case "browser":
      const response = await fetch(path);
      return new Uint8Array(await response.arrayBuffer());

    default:
      throw new Error(`Unsupported runtime: ${runtime}`);
  }
}
```

## Format-Specific Metadata Mapping

Different audio formats use different tag names. taglib-wasm handles this automatically:

### Common Mappings

| Standard Field | ID3v2 (MP3) | Vorbis (FLAC/OGG) | MP4/iTunes |
| -------------- | ----------- | ----------------- | ---------- |
| Album Artist   | TPE2        | ALBUMARTIST       | aART       |
| Disc Number    | TPOS        | DISCNUMBER        | disk       |
| Total Discs    | TPOS        | DISCTOTAL         | disk       |
| BPM            | TBPM        | BPM               | tmpo       |
| Compilation    | TCMP        | COMPILATION       | cpil       |
| Copyright      | TCOP        | COPYRIGHT         | cprt       |
| Encoding Time  | TDEN        | DATE              | ©day       |
| Original Date  | TDOR        | ORIGINALDATE      | ----       |

### Accessing Format-Specific Tags

```typescript
const taglib = await TagLib.initialize();
using audioFile = await taglib.open("song.mp3");
const propMap = audioFile.propertyMap();
const props = propMap.properties();

// ID3v2 specific
const id3AlbumArtist = props["TPE2"]?.[0];

// Vorbis specific
const vorbisAlbumArtist = props["ALBUMARTIST"]?.[0];

// Unified access (recommended)
const albumArtist = props["ALBUMARTIST"]?.[0] || props["TPE2"]?.[0] ||
  props["aART"]?.[0];
```

## Format Conversion Workflows

taglib-wasm excels at preserving metadata when converting between audio formats. Here are comprehensive patterns for common conversion scenarios:

### Basic Format Conversion Pattern

```typescript
import { applyTagsToBuffer, readTags } from "taglib-wasm/simple";
import { TagLib } from "taglib-wasm";

async function convertMetadata(sourcePath: string, targetPath: string) {
  // Step 1: Read all metadata from source
  const sourceTags = await readTags(sourcePath);

  // Step 2: Read advanced metadata using Full API
  const taglib = await TagLib.initialize();
  let advancedProps;
  {
    using sourceFile = await taglib.open(sourcePath);
    const propMap = sourceFile.propertyMap();
    advancedProps = propMap.properties();
  }

  // Step 3: Apply to target file
  const modifiedTarget = await applyTagsToBuffer(targetPath, sourceTags);

  // Step 4: Apply advanced metadata
  using targetFile = await taglib.open(modifiedTarget);
  const targetPropMap = targetFile.propertyMap();

  // Copy all properties that make sense for the target format
  for (const [key, values] of Object.entries(advancedProps)) {
    if (shouldCopyProperty(key, targetPath)) {
      targetPropMap.set(key, values);
    }
  }

  targetFile.save();
  const finalBuffer = targetFile.getFileBuffer();

  return finalBuffer;
}

function shouldCopyProperty(key: string, targetPath: string): boolean {
  const ext = targetPath.substring(targetPath.lastIndexOf(".")).toLowerCase();

  // Format-specific property filtering
  const formatExclusions: Record<string, string[]> = {
    ".mp3": ["COVERART", "METADATA_BLOCK_PICTURE"], // Use APIC frames instead
    ".m4a": ["APIC", "PIC"], // Use MP4 cover atoms
    ".flac": ["APIC", "PIC"], // Use METADATA_BLOCK_PICTURE
    ".ogg": ["APIC", "PIC"], // Use METADATA_BLOCK_PICTURE
  };

  const exclusions = formatExclusions[ext] || [];
  return !exclusions.includes(key.toUpperCase());
}
```

### Batch Format Conversion

```typescript
import { scanFolder, TagLib } from "taglib-wasm";
import { readFile, writeFile } from "fs/promises";

async function batchConvertMetadata(
  sourceDir: string,
  targetDir: string,
  sourceExt: string,
  targetExt: string,
) {
  const taglib = await TagLib.initialize();
  const result = await scanFolder(sourceDir, {
    extensions: [sourceExt],
    recursive: true,
  });

  const conversionMap = new Map<string, string>();

  for (const file of result.items) {
    // Calculate target path
    const relativePath = file.path.substring(sourceDir.length);
    const targetPath = targetDir + relativePath.replace(sourceExt, targetExt);

    // Ensure target directory exists
    await ensureDir(dirname(targetPath));

    // Copy file first (assume audio conversion happened elsewhere)
    // This example focuses on metadata transfer

    try {
      // Read all metadata from source
      using sourceFile = await taglib.open(file.path);
      const sourceTag = sourceFile.tag();
      const sourcePropMap = sourceFile.propertyMap();
      const sourceProps = sourcePropMap.properties();

      // Create metadata object
      const metadata = {
        basic: {
          title: sourceTag.title,
          artist: sourceTag.artist,
          album: sourceTag.album,
          year: sourceTag.year,
          track: sourceTag.track,
          genre: sourceTag.genre,
          comment: sourceTag.comment,
        },
        advanced: sourceProps,
      };

      // Apply to target (after audio conversion)
      const targetBuffer = await readFile(targetPath);
      using targetFile = await taglib.open(targetBuffer);
      const targetTag = targetFile.tag();
      const targetPropMap = targetFile.propertyMap();

      // Apply basic tags
      targetTag.setTitle(metadata.basic.title || "");
      targetTag.setArtist(metadata.basic.artist || "");
      targetTag.setAlbum(metadata.basic.album || "");
      targetTag.setYear(metadata.basic.year || 0);
      targetTag.setTrack(metadata.basic.track || 0);
      targetTag.setGenre(metadata.basic.genre || "");
      targetTag.setComment(metadata.basic.comment || "");

      // Apply advanced properties
      for (const [key, values] of Object.entries(metadata.advanced)) {
        if (isCompatibleProperty(key, sourceExt, targetExt)) {
          targetPropMap.set(mapPropertyName(key, sourceExt, targetExt), values);
        }
      }

      targetFile.save();
      await writeFile(targetPath, targetFile.getFileBuffer());

      conversionMap.set(file.path, targetPath);
    } catch (error) {
      console.error(`Failed to convert metadata for ${file.path}:`, error);
    }
  }

  return conversionMap;
}

function isCompatibleProperty(
  key: string,
  sourceExt: string,
  targetExt: string,
): boolean {
  // Define compatible properties between formats
  const compatibility: Record<string, Record<string, string[]>> = {
    ".mp3": {
      ".flac": ["ALBUMARTIST", "DISCNUMBER", "COMPILATION", "BPM"],
      ".m4a": ["ALBUMARTIST", "DISCNUMBER", "COMPILATION", "BPM"],
      ".ogg": ["ALBUMARTIST", "DISCNUMBER", "COMPILATION", "BPM"],
    },
    ".flac": {
      ".mp3": ["ALBUMARTIST", "DISCNUMBER", "COMPILATION", "BPM"],
      ".m4a": ["ALBUMARTIST", "DISCNUMBER", "COMPILATION", "BPM"],
      ".ogg": ["all"], // FLAC and OGG use same Vorbis Comments
    },
  };

  const allowedProps = compatibility[sourceExt]?.[targetExt];
  if (!allowedProps) return false;
  if (allowedProps.includes("all")) return true;
  return allowedProps.includes(key);
}

function mapPropertyName(
  key: string,
  sourceExt: string,
  targetExt: string,
): string {
  // Map property names between formats
  const propertyMap: Record<string, Record<string, Record<string, string>>> = {
    ".mp3": {
      ".m4a": {
        "TPE2": "aART", // Album artist
        "TPOS": "disk", // Disc number
        "TCMP": "cpil", // Compilation
        "TBPM": "tmpo", // BPM
      },
    },
  };

  return propertyMap[sourceExt]?.[targetExt]?.[key] || key;
}
```

### Preserving Format-Specific Features

```typescript
// Preserve iTunes-specific metadata when converting M4A files
async function preserveITunesMetadata(m4aPath: string, targetPath: string) {
  const taglib = await TagLib.initialize();

  // Read iTunes metadata from source
  let itunesProps;
  {
    using m4aFile = await taglib.open(m4aPath);
    const propMap = m4aFile.propertyMap();
    const props = propMap.properties();

    // iTunes-specific properties to preserve
    itunesProps = {
      purchaseDate: props["----:com.apple.iTunes:PURCHASE_DATE"]?.[0],
      gapless: props["----:com.apple.iTunes:GAPLESS"]?.[0],
      soundCheck: props["----:com.apple.iTunes:SOUNDCHECK"]?.[0],
      mediaType: props["stik"]?.[0],
      contentRating: props["rtng"]?.[0],
    };
  }

  // Store as custom tags in target format
  using targetFile = await taglib.open(targetPath);
  const targetPropMap = targetFile.propertyMap();

  if (targetPath.endsWith(".flac") || targetPath.endsWith(".ogg")) {
    // Store as custom Vorbis comments
    if (itunesProps.purchaseDate) {
      targetPropMap.set("ITUNES_PURCHASE_DATE", [itunesProps.purchaseDate]);
    }
    if (itunesProps.gapless) {
      targetPropMap.set("ITUNES_GAPLESS", [itunesProps.gapless]);
    }
  } else if (targetPath.endsWith(".mp3")) {
    // Store as TXXX frames
    if (itunesProps.purchaseDate) {
      targetPropMap.set("TXXX:ITUNES_PURCHASE_DATE", [
        itunesProps.purchaseDate,
      ]);
    }
  }

  targetFile.save();
  return targetFile.getFileBuffer();
}
```

### Handling Cover Art During Conversion

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";

async function convertWithCoverArt(sourcePath: string, targetPath: string) {
  // Extract cover art from source
  const coverData = await readCoverArt(sourcePath);

  if (coverData) {
    // Detect image type
    const imageType = detectImageType(coverData);

    // Apply cover art to target
    const targetWithArt = await applyCoverArt(targetPath, coverData, imageType);
    return targetWithArt;
  }

  // No cover art to transfer
  return await readFile(targetPath);
}

function detectImageType(data: Uint8Array): string {
  // Check magic bytes
  if (data[0] === 0xFF && data[1] === 0xD8) return "image/jpeg";
  if (data[0] === 0x89 && data[1] === 0x50) return "image/png";
  if (data[0] === 0x47 && data[1] === 0x49) return "image/gif";
  if (data[0] === 0x42 && data[1] === 0x4D) return "image/bmp";
  return "image/jpeg"; // Default
}
```

### Format Conversion Best Practices

1. **Preserve All Metadata**: Always attempt to preserve all metadata, even custom fields
2. **Map Format-Specific Fields**: Use property mapping tables for format-specific fields
3. **Handle Character Encoding**: Ensure UTF-8 encoding is maintained
4. **Validate After Conversion**: Read back the converted file to verify metadata
5. **Log Unmapped Fields**: Track fields that couldn't be converted
6. **Batch Processing**: Use concurrent processing for large collections
7. **Error Recovery**: Continue processing even if individual files fail

## Streaming Audio Processing

For processing large audio collections efficiently without running out of memory:

### Basic Streaming Pattern

```typescript
import { scanFolder } from "taglib-wasm";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

async function* processAudioStream(
  directory: string,
  batchSize: number = 100,
): AsyncGenerator<AudioFileMetadata[]> {
  let batch: AudioFileMetadata[] = [];

  const result = await scanFolder(directory, {
    recursive: true,
    concurrency: 4,
    onProgress: (processed, total, file) => {
      // Progress tracking without storing all results
    },
  });

  for (const file of result.items) {
    batch.push(file);

    if (batch.length >= batchSize) {
      yield batch;
      batch = []; // Clear batch to free memory
    }
  }

  // Yield remaining files
  if (batch.length > 0) {
    yield batch;
  }
}

// Usage: Process files in batches
async function processLargeLibrary(directory: string) {
  let totalProcessed = 0;

  for await (const batch of processAudioStream(directory, 50)) {
    // Process batch of 50 files
    await processBatch(batch);
    totalProcessed += batch.length;

    // Force garbage collection hint (V8)
    if (global.gc) global.gc();

    console.log(`Processed ${totalProcessed} files...`);
  }
}
```

### Memory-Efficient Scanning

```typescript
import { TagLib } from "taglib-wasm";
import { readdir } from "fs/promises";
import { join } from "path";

async function* scanDirectoryStream(
  dir: string,
  extensions: string[] = [".mp3", ".flac", ".m4a"],
): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* scanDirectoryStream(fullPath, extensions);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        yield fullPath;
      }
    }
  }
}

async function processLargeLibraryStream(rootDir: string) {
  const taglib = await TagLib.initialize();
  const BATCH_SIZE = 10;
  let batch: string[] = [];
  let processedCount = 0;

  for await (const filePath of scanDirectoryStream(rootDir)) {
    batch.push(filePath);

    if (batch.length >= BATCH_SIZE) {
      // Process batch
      await Promise.all(batch.map(async (path) => {
        try {
          using audioFile = await taglib.open(path);
          const tag = audioFile.tag();

          // Process metadata
          console.log(`${path}: ${tag.artist} - ${tag.title}`);
        } catch (error) {
          console.error(`Error processing ${path}:`, error);
        }
      }));

      processedCount += batch.length;
      console.log(`Processed ${processedCount} files...`);

      batch = []; // Clear batch
    }
  }

  // Process remaining files
  if (batch.length > 0) {
    await Promise.all(batch.map(/* same processing */));
  }
}
```

### Streaming Export to JSON Lines

```typescript
import { createWriteStream } from "fs";
import { scanFolder } from "taglib-wasm";

async function exportLibraryAsJSONLines(
  directory: string,
  outputPath: string,
) {
  const output = createWriteStream(outputPath);
  let errorCount = 0;

  await scanFolder(directory, {
    recursive: true,
    concurrency: 4,
    continueOnError: true,
    onProgress: async (processed, total, currentFile) => {
      // Write progress to stderr so it doesn't interfere with output
      process.stderr.write(`\rProcessing: ${processed}/${total}`);
    },
  });

  // Process results in chunks to avoid memory issues
  const CHUNK_SIZE = 100;

  return new Promise((resolve, reject) => {
    let processedCount = 0;

    const processChunk = async (files: AudioFileMetadata[]) => {
      for (const file of files) {
        if (file.error) {
          errorCount++;
          continue;
        }

        const jsonLine = JSON.stringify({
          path: file.path,
          ...file.tags,
          duration: file.properties?.length,
          bitrate: file.properties?.bitrate,
          sampleRate: file.properties?.sampleRate,
        }) + "\n";

        if (!output.write(jsonLine)) {
          // Wait for drain event if buffer is full
          await new Promise((resolve) => output.once("drain", resolve));
        }

        processedCount++;
      }
    };

    output.on("error", reject);
    output.on("finish", () => {
      console.log(`\nExported ${processedCount} files (${errorCount} errors)`);
      resolve(processedCount);
    });

    // End the stream when done
    output.end();
  });
}
```

### Streaming Updates with Progress

```typescript
async function streamingUpdate(
  directory: string,
  updateFn: (tags: Tag) => Partial<Tag>,
) {
  const taglib = await TagLib.initialize();
  const updateQueue: Array<{ path: string; updates: Partial<Tag> }> = [];
  const QUEUE_SIZE = 20;

  let totalFiles = 0;
  let processedFiles = 0;
  let updatedFiles = 0;

  // First pass: count files
  for await (const _ of scanDirectoryStream(directory)) {
    totalFiles++;
  }

  // Second pass: process files
  for await (const filePath of scanDirectoryStream(directory)) {
    try {
      using audioFile = await taglib.open(filePath);
      const tag = audioFile.tag();

      const currentTags = {
        title: tag.title,
        artist: tag.artist,
        album: tag.album,
        year: tag.year,
        track: tag.track,
        genre: tag.genre,
        comment: tag.comment,
      };

      const updates = updateFn(currentTags);

      if (Object.keys(updates).length > 0) {
        updateQueue.push({ path: filePath, updates });
        updatedFiles++;
      }

      // Process queue when it reaches size limit
      if (updateQueue.length >= QUEUE_SIZE) {
        await processUpdateQueue(updateQueue);
        updateQueue.length = 0; // Clear queue
      }

      processedFiles++;
      const progress = Math.round((processedFiles / totalFiles) * 100);
      process.stderr.write(
        `\rProgress: ${processedFiles}/${totalFiles} (${progress}%) - Updated: ${updatedFiles}`,
      );
    } catch (error) {
      console.error(`\nError processing ${filePath}:`, error);
    }
  }

  // Process remaining updates
  if (updateQueue.length > 0) {
    await processUpdateQueue(updateQueue);
  }

  console.log(
    `\nCompleted: ${updatedFiles} files updated out of ${totalFiles}`,
  );
}

async function processUpdateQueue(
  queue: Array<{ path: string; updates: Partial<Tag> }>,
) {
  await Promise.all(queue.map(async ({ path, updates }) => {
    try {
      await writeTagsToFile(path, updates);
    } catch (error) {
      console.error(`Failed to update ${path}:`, error);
    }
  }));
}
```

### Streaming Duplicate Detection

```typescript
async function* findDuplicatesStream(
  directory: string,
  criteria: Array<keyof Tag> = ["artist", "title"],
): AsyncGenerator<{ key: string; files: string[] }> {
  const seen = new Map<string, string[]>();
  const YIELD_THRESHOLD = 1000; // Yield duplicates every 1000 files
  let processedCount = 0;

  for await (const filePath of scanDirectoryStream(directory)) {
    try {
      const tags = await readTags(filePath);

      // Create composite key
      const key = criteria
        .map((field) => tags[field] || "")
        .filter((v) => v !== "")
        .join("|");

      if (key) {
        const existing = seen.get(key) || [];
        existing.push(filePath);
        seen.set(key, existing);

        // If this creates a new duplicate group, yield it
        if (existing.length === 2) {
          yield { key, files: existing };
        }
      }

      processedCount++;

      // Periodically clean up non-duplicates to save memory
      if (processedCount % YIELD_THRESHOLD === 0) {
        for (const [key, files] of seen.entries()) {
          if (files.length === 1) {
            seen.delete(key); // Remove non-duplicates
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
    }
  }

  // Yield any remaining duplicates
  for (const [key, files] of seen.entries()) {
    if (files.length > 1) {
      yield { key, files };
    }
  }
}

// Usage
async function processDuplicatesStream(directory: string) {
  console.log("Finding duplicates...\n");

  for await (const duplicate of findDuplicatesStream(directory)) {
    console.log(`Duplicate found: ${duplicate.key}`);
    for (const file of duplicate.files) {
      console.log(`  - ${file}`);
    }
    console.log();

    // Process duplicate group immediately
    // This keeps memory usage constant regardless of library size
    await handleDuplicateGroup(duplicate.files);
  }
}
```

### Best Practices for Streaming Processing

1. **Use Generators**: AsyncGenerators provide natural batching and backpressure
2. **Process in Batches**: Balance between memory usage and performance
3. **Clear References**: Explicitly clear arrays and objects after processing
4. **Monitor Memory**: Use `process.memoryUsage()` to track memory consumption
5. **Handle Backpressure**: Respect stream backpressure signals
6. **Progress Reporting**: Use stderr for progress to keep stdout clean
7. **Error Isolation**: Don't let one error stop the entire stream
8. **Concurrent Limits**: Limit concurrent operations to prevent resource exhaustion

## Migration Guides

### Migrating from v0.3.x to v0.4.x

```typescript
// v0.3.x - Old import style
import { TagLib } from "taglib-wasm/full";
import { readTags } from "taglib-wasm/simple";

// v0.4.x - New import style
import { TagLib } from "taglib-wasm";
import { readTags } from "taglib-wasm/simple";

// Folder API moved from subpath to main export
// v0.3.x
import { scanFolder } from "taglib-wasm/folder";

// v0.4.x
import { scanFolder } from "taglib-wasm";
```

### Migrating from Other Libraries

```typescript
// From node-taglib2
const taglib = require("taglib2");
const tags = taglib.readTagsSync("file.mp3");

// To taglib-wasm
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("file.mp3");

// From music-metadata
const mm = require("music-metadata");
const metadata = await mm.parseFile("file.mp3");

// To taglib-wasm
import { readProperties, readTags } from "taglib-wasm/simple";
const tags = await readTags("file.mp3");
const props = await readProperties("file.mp3");
```

## Performance Benchmarks

Real-world performance measurements:

### 🏃 Speed Comparisons

| Operation     | Method              | 19 Files | 100 Files | 1000 Files | Speedup       |
| ------------- | ------------------- | -------- | --------- | ---------- | ------------- |
| Read Tags     | Sequential          | ~90s     | ~475s     | ~4750s     | 1x (baseline) |
| Read Tags     | **Batch (c=8)**     | **~5s**  | **~25s**  | **~250s**  | **18-19x**    |
| Read Tags     | **Batch (c=16)**    | **~3s**  | **~15s**  | **~150s**  | **30x**       |
| Full Metadata | Sequential          | ~120s    | ~630s     | ~6300s     | 1x            |
| Full Metadata | **Batch (c=8)**     | **~6s**  | **~32s**  | **~320s**  | **20x**       |
| Folder Scan   | Default (c=4)       | -        | ~50s      | ~500s      | 10x           |
| Folder Scan   | **Optimized (c=8)** | -        | **~25s**  | **~250s**  | **19x**       |

### 📊 Per-Operation Timings

- **Single file read**: 2-5ms (tags only)
- **Single file full metadata**: 5-10ms (tags + properties + cover art check)
- **Batch overhead**: ~100ms startup + concurrent processing

### 💾 Memory Usage

| Scenario              | Memory Usage       | Notes                            |
| --------------------- | ------------------ | -------------------------------- |
| Base library          | ~2MB               | After initialization             |
| Per file (sequential) | ~2x file size      | Peak during processing           |
| Batch (c=8)           | ~16x avg file size | 8 files in memory simultaneously |
| 20-track album        | ~200MB peak        | For typical 10MB files           |
| 1000 files scan       | ~300MB constant    | With proper disposal             |

### ⚡ Album Processing Example

```typescript
// Real-world example: 20-track album
const albumPath = "/music/Pink Floyd - Dark Side of the Moon";

// SLOW: Sequential approach
console.time("Sequential");
for (const track of tracks) {
  const tags = await readTags(track);
  // Process...
}
console.timeEnd("Sequential"); // ~100 seconds

// FAST: Batch approach
console.time("Batch");
const results = await readMetadataBatch(tracks, { concurrency: 8 });
console.timeEnd("Batch"); // ~5 seconds (20x faster!)
```

## Security Considerations

### Input Validation

```typescript
async function safelyProcessUserFile(
  buffer: ArrayBuffer,
  maxSize: number = 100 * 1024 * 1024, // 100MB
) {
  // Validate size
  if (buffer.byteLength > maxSize) {
    throw new Error("File too large");
  }

  // Validate minimum size
  if (buffer.byteLength < 1024) {
    throw new Error("File too small to be valid audio");
  }

  // Validate magic bytes
  const bytes = new Uint8Array(buffer);
  if (!isValidAudioFile(bytes)) {
    throw new Error("Not a valid audio file");
  }

  // Process with timeout
  const timeout = setTimeout(() => {
    throw new Error("Processing timeout");
  }, 30000); // 30 second timeout

  try {
    const taglib = await TagLib.initialize();
    using audioFile = await taglib.open(buffer);
    // Process...
  } finally {
    clearTimeout(timeout);
  }
}

function isValidAudioFile(bytes: Uint8Array): boolean {
  // Check for common audio file signatures
  const signatures = [
    [0x49, 0x44, 0x33], // ID3
    [0xFF, 0xFB], // MP3
    [0xFF, 0xF3], // MP3
    [0xFF, 0xF2], // MP3
    [0x66, 0x4C, 0x61, 0x43], // fLaC
    [0x4F, 0x67, 0x67, 0x53], // OggS
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp (MP4)
    [0x52, 0x49, 0x46, 0x46], // RIFF (WAV)
  ];

  return signatures.some((sig) =>
    sig.every((byte, index) => bytes[index] === byte)
  );
}
```

## Testing Patterns

### Unit Testing with Mocks

```typescript
import { expect, test, vi } from "vitest";
import { readTags } from "taglib-wasm/simple";

// Mock the module
vi.mock("taglib-wasm/simple", () => ({
  readTags: vi.fn(),
  writeTagsToFile: vi.fn(),
}));

test("should process music file", async () => {
  // Setup mock
  vi.mocked(readTags).mockResolvedValue({
    title: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
  });

  // Test your code
  const result = await processMusic("test.mp3");

  expect(result.title).toBe("Test Song");
  expect(readTags).toHaveBeenCalledWith("test.mp3");
});
```

### Integration Testing

```typescript
import { expect, test } from "@jest/globals";
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

test("should read and write tags", async () => {
  const taglib = await TagLib.initialize();
  const buffer = await readFile("test-files/sample.mp3");

  using audioFile = await taglib.open(buffer);
  const tag = audioFile.tag();

  // Test reading
  expect(tag.title).toBeDefined();

  // Test writing
  tag.setTitle("New Title");
  const success = audioFile.save();
  expect(success).toBe(true);
});
```

## Bundle Size Optimization

### For Web Applications

```typescript
// Use dynamic imports for code splitting
async function loadTagLib() {
  const { TagLib } = await import("taglib-wasm");
  return TagLib.initialize({
    wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
  });
}

// Tree-shake by importing only what you need
import { readTags } from "taglib-wasm/simple";
// Instead of importing everything
```

### Webpack Configuration

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      cacheGroups: {
        taglib: {
          test: /[\\/]node_modules[\\/]taglib-wasm/,
          name: "taglib",
          chunks: "async",
        },
      },
    },
  },
};
```

## Error Recovery Patterns

### Retry Logic

```typescript
async function readTagsWithRetry(
  path: string,
  maxRetries: number = 3,
): Promise<Tag> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await readTags(path);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (isUnrecoverableError(error)) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  }

  throw lastError!;
}

function isUnrecoverableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Invalid audio file format") ||
    message.includes("File too small");
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Process Audio Metadata
on: [push]

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x

      - name: Process audio files
        run: |
          deno run --allow-read --allow-write process-audio.ts
```

### Docker Example

```dockerfile
FROM denoland/deno:2.0.0
WORKDIR /app
COPY . .
RUN deno cache --allow-scripts mod.ts
CMD ["deno", "run", "--allow-read", "--allow-write", "process.ts"]
```

## Accessibility Considerations

### Making Metadata Screen Reader Friendly

```typescript
function formatForScreenReader(tags: Tag): string {
  const parts = [];

  if (tags.title) parts.push(`Title: ${tags.title}`);
  if (tags.artist) parts.push(`Artist: ${tags.artist}`);
  if (tags.album) parts.push(`Album: ${tags.album}`);
  if (tags.year) parts.push(`Year: ${tags.year}`);
  if (tags.track) parts.push(`Track number: ${tags.track}`);

  return parts.join(". ") + ".";
}

// ARIA-friendly HTML output
function renderAccessibleMetadata(tags: Tag): string {
  return `
    <div role="article" aria-label="Audio file metadata">
      <h3>${tags.title || "Untitled"}</h3>
      <dl>
        <dt>Artist</dt>
        <dd>${tags.artist || "Unknown artist"}</dd>
        <dt>Album</dt>
        <dd>${tags.album || "Unknown album"}</dd>
        <dt>Year</dt>
        <dd>${tags.year || "Unknown year"}</dd>
      </dl>
    </div>
  `;
}
```

## Additional Resources

- **API Documentation**: See the project's docs/API.md
- **Folder API Reference**: See docs/api/folder-api.md for batch operations
- **PropertyMap Keys**: See docs/PropertyMap-API.md for all supported metadata
  keys
- **Memory Management**: See docs/Memory-Management.md for detailed guidance
- **Examples**: Check the examples/ directory for runtime-specific code
- **Folder Operations Guide**: See docs/guide/folder-operations.md for detailed
  batch processing examples
- **Deno Compile Guide**: See docs/guide/deno-compile.md for compiled binary support

## Glossary

### Audio Terms

- **Bitrate**: Audio data rate in kilobits per second (kbps). Higher = better
  quality
- **Sample Rate**: Samples per second in Hz (e.g., 44100 Hz = CD quality)
- **Channels**: Number of audio channels (1 = mono, 2 = stereo)
- **Codec**: Compression algorithm (MP3, AAC, FLAC, etc.)
- **Lossless**: No quality loss from original (FLAC, ALAC, WAV)
- **Lossy**: Some quality loss for smaller size (MP3, AAC, OGG)

### Metadata Terms

- **ID3**: Metadata format for MP3 files (ID3v1, ID3v2.3, ID3v2.4)
- **Vorbis Comments**: Metadata format for FLAC/OGG files
- **iTunes atoms**: Metadata format for M4A/MP4 files
- **PropertyMap**: Generic key-value metadata storage
- **ReplayGain**: Volume normalization standard
- **MusicBrainz**: Open music database with unique IDs
- **AcoustID**: Audio fingerprinting for track identification

### TagLib Terms

- **AudioFile**: Object representing an open audio file
- **Tag**: Basic metadata interface (title, artist, etc.)
- **AudioProperties**: Technical properties (duration, bitrate, etc.)
- **dispose()**: Release C++ memory (use `using` for automatic disposal, or call
  manually)
- **Wasm**: WebAssembly - allows C++ TagLib to run in JavaScript
- **JSR**: JavaScript Registry - Deno's package registry
- **npm**: Node Package Manager - Node.js package registry

### Performance Terms

- **WebAssembly Streaming**: Compile WASM while downloading for faster startup
- **Concurrency**: Number of files processed in parallel
- **Memory Leak**: Unreleased C++ objects from missing cleanup — use `using` to
  prevent
- **Buffer**: Binary data in memory (ArrayBuffer/Uint8Array)
