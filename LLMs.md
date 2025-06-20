# taglib-wasm Usage Guide for AI Assistants

This guide helps AI assistants understand how to use the taglib-wasm library
effectively when writing code that consumes this package.

## Getting Started in 60 Seconds

```typescript
// Install
npm install taglib-wasm           // Node.js/Bun
import ... from "npm:taglib-wasm" // Deno

// Read tags (simplest approach)
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
console.log(tags.artist, tags.title, tags.album);

// That's it! For more control, keep reading...
```

## API Overview

taglib-wasm provides three APIs for different use cases:

### 1. **Simple API** (`taglib-wasm/simple`)

- **Best for**: Quick reads, one-off operations
- **Memory**: Automatically managed
- **Functions**: `readTags()`, `applyTags()`, `updateTags()`, `readProperties()`

### 2. **Full API** (`taglib-wasm`)

- **Best for**: Complex operations, performance-critical code, advanced metadata
- **Memory**: Manual disposal required
- **Classes**: `TagLib`, `AudioFile`, `Tag`, `PropertyMap`

### 3. **Folder API** (`taglib-wasm/folder`)

- **Best for**: Library scanning, bulk updates, finding duplicates
- **Memory**: Efficient batch processing
- **Functions**: `scanFolder()`, `updateFolderTags()`, `findDuplicates()`,
  `exportFolderMetadata()`
- **Runtime**: Node.js, Deno, and Bun only (requires filesystem access)

## Which API Should I Use?

- **Reading tags from one file?** → Simple API: `readTags()`
- **Writing tags to one file?** → Simple API: `updateTags()` or `applyTags()`
- **Processing many files?** → Folder API: `scanFolder()`
- **Need PropertyMap or pictures?** → Full API
- **Need MusicBrainz/ReplayGain?** → Full API with PropertyMap
- **Memory constrained environment?** → Simple API (automatic cleanup)
- **Building a music player?** → Simple API for metadata, Full API for advanced
  features
- **Building a tag editor?** → Full API for complete control

## Quick Reference

### Essential Operations

| Task                | Simple API                                  | Full API                                      |
| ------------------- | ------------------------------------------- | --------------------------------------------- |
| Read tags           | `await readTags("file.mp3")`                | `audioFile.tag().title`                       |
| Write tags          | `await updateTags("file.mp3", tags)`        | `tag.setTitle("New")`                         |
| Get duration        | `(await readProperties("file.mp3")).length` | `audioFile.audioProperties().length`          |
| Get modified buffer | `await applyTags("file.mp3", tags)`         | `audioFile.save(); audioFile.getFileBuffer()` |
| Scan folder         | `await scanFolder("/music")`                | Use Folder API                                |
| Find duplicates     | `await findDuplicates("/music")`            | Use Folder API                                |

### Import Statements

```typescript
// Deno
import { TagLib } from "npm:taglib-wasm";
import { applyTags, readTags, updateTags } from "npm:taglib-wasm/simple";
import { findDuplicates, scanFolder } from "npm:taglib-wasm/folder";

// Node.js/Bun
import { TagLib } from "taglib-wasm";
import { applyTags, readTags, updateTags } from "taglib-wasm/simple";
import { findDuplicates, scanFolder } from "taglib-wasm/folder";

// TypeScript type imports
import type { AudioProperties, FolderScanResult, Tag } from "taglib-wasm";
```

### Memory Management Checklist

- ✅ Call `TagLib.initialize()` once and reuse
- ✅ Always use try/finally with `dispose()`
- ✅ Don't access AudioFile after `dispose()`
- ✅ Simple API handles memory automatically
- ✅ Folder API manages memory for batch operations

## Quick Start (Full Example)

```typescript
// Deno
import { TagLib } from "npm:taglib-wasm";

// Node.js/Bun
import { TagLib } from "taglib-wasm";

// Initialize the library
const taglib = await TagLib.initialize();

// Read tags from an audio file buffer
const audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

console.log({
  title: tag.title,
  artist: tag.artist,
  album: tag.album,
  year: tag.year,
});

// IMPORTANT: Always clean up
audioFile.dispose();
```

## Key Concepts

### 1. Initialization

- **Always call `TagLib.initialize()` once** before using any functionality
- This returns a TagLib instance that you use for all operations
- Store this instance and reuse it throughout your application

### 2. Memory Management

- **CRITICAL**: Always call `dispose()` on AudioFile instances when done
- Forgetting to dispose causes memory leaks as C++ objects aren't garbage
  collected
- Use try/finally blocks to ensure cleanup:

```typescript
const taglib = await TagLib.initialize();
let audioFile;
try {
  audioFile = await taglib.open(buffer);
  // ... work with file
} finally {
  audioFile?.dispose();
}
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
const audioFile1 = await taglib.open("path/to/song.mp3");

// From buffer (all environments)
// Node.js example:
import { readFile } from "fs/promises";
const buffer = await readFile("song.mp3");
const audioFile2 = await taglib.open(buffer);

// From browser File object
const audioFile3 = await taglib.open(fileFromInput);
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
await updateTags("file.mp3", { title: "New" }); // Writes to disk

// Pattern 3: Using Simple API (get buffer)
const buffer = await applyTags("file.mp3", { title: "New" }); // Returns buffer
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
const wasmData = await fetch("taglib.wasm").then((r) => r.arrayBuffer());
const taglib = await TagLib.initialize({
  wasmBinary: wasmData,
});
```

### Module Systems

```typescript
// ESM (recommended for all modern environments)
import { TagLib } from "taglib-wasm";

// CommonJS (older Node.js projects)
const { TagLib } = require("taglib-wasm");

// Dynamic import (when needed conditionally)
const { TagLib } = await import("taglib-wasm");

// Deno always uses npm: specifier
import { TagLib } from "npm:taglib-wasm";
```

## Common Patterns

### Reading Basic Tags

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
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

audioFile.dispose();
```

### Writing Tags

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
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

audioFile.dispose();
```

### Audio Properties

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const props = audioFile.audioProperties();

// Properties are accessed directly, not via methods
const audioInfo = {
  duration: props.length, // Duration in seconds
  bitrate: props.bitrate, // Bitrate in kb/s
  sampleRate: props.sampleRate, // Sample rate in Hz
  channels: props.channels, // Number of channels
};

audioFile.dispose();
```

### Using the Simple API

For basic operations without manual memory management:

```typescript
// Deno
import { applyTags, readTags, updateTags } from "npm:taglib-wasm/simple";

// Node.js/Bun
import { applyTags, readTags, updateTags } from "taglib-wasm/simple";

// Read tags - no need to manage AudioFile instances
const tags = await readTags("song.mp3");
console.log(tags); // { title, artist, album, year, ... }

// Apply tags to get modified buffer
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});

// Update tags in-place (file path only)
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### Using the Folder API

For batch operations on multiple audio files (Node.js/Deno/Bun only):

```typescript
// Deno
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "npm:taglib-wasm/folder";

// Node.js/Bun
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "taglib-wasm/folder";

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
for (const file of result.files) {
  console.log(`${file.path}: ${file.tags.artist} - ${file.tags.title}`);
  console.log(`Duration: ${file.properties?.duration}s`);
}

// Batch update tags
const updates = [
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  { path: "/music/song2.mp3", tags: { album: "New Album" } },
];

const updateResult = await updateFolderTags(updates);
console.log(`Updated ${updateResult.successful} files`);

// Find duplicates
const duplicates = await findDuplicates("/music", ["artist", "title"]);
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
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const propMap = audioFile.properties();

// Read all properties
const allProps = propMap.properties();

// Read specific advanced properties
const musicBrainzId = propMap.get("MUSICBRAINZ_TRACKID");
const replayGain = propMap.get("REPLAYGAIN_TRACK_GAIN");
const acoustId = propMap.get("ACOUSTID_ID");

// Write advanced properties
propMap.set("MUSICBRAINZ_ALBUMID", "some-uuid");
propMap.set("REPLAYGAIN_TRACK_GAIN", "-3.5 dB");

// Multiple values for a property
propMap.set("ARTIST", ["Main Artist", "Featured Artist"]);

// Save and get modified buffer
const success = audioFile.save();
if (success) {
  const modifiedBuffer = audioFile.getFileBuffer();
}
audioFile.dispose();
```

## Supported Formats

All formats are automatically detected from file content:

- **MP3** - ID3v1, ID3v2.3, ID3v2.4
- **MP4/M4A** - iTunes-style tags
- **FLAC** - Vorbis comments
- **OGG Vorbis** - Vorbis comments
- **WAV** - RIFF INFO chunks

## Error Handling

The library throws descriptive errors for common issues:

```typescript
const taglib = await TagLib.initialize();
try {
  const audioFile = await taglib.open(buffer);
  // ... use audioFile
  audioFile.dispose();
} catch (error) {
  if (error.message.includes("Module not initialized")) {
    // TagLib.initialize() failed
  } else if (error.message.includes("Invalid audio file format")) {
    // Unsupported or corrupted file
  } else if (error.message.includes("at least 1KB")) {
    // File too small
  }
}
```

## Common Recipes

### Recipe: Add Album Art / Cover Image

```typescript
import { getCoverArt, setCoverArt } from "taglib-wasm/simple";

// Read existing cover art
const coverData = await getCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set new cover art
const imageData = await Deno.readFile("album-art.jpg");
const modifiedBuffer = await setCoverArt("song.mp3", imageData, "image/jpeg");
await Deno.writeFile("song-with-art.mp3", modifiedBuffer);
```

### Recipe: Batch Rename Files Based on Metadata

```typescript
import { scanFolder } from "taglib-wasm/folder";
import { rename } from "fs/promises"; // Node.js

const result = await scanFolder("/music");

for (const file of result.files) {
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
import { readTags, updateTags } from "taglib-wasm/simple";

// Read tags from MP3 (ID3v2)
const mp3Tags = await readTags("song.mp3");

// Apply same tags to FLAC (Vorbis Comments)
await updateTags("song.flac", mp3Tags);

// Apply to M4A (iTunes atoms)
await updateTags("song.m4a", mp3Tags);

// Note: Format-specific fields are automatically mapped
```

### Recipe: Find and Handle Duplicates

```typescript
import { findDuplicates, readProperties } from "taglib-wasm/folder";

const duplicates = await findDuplicates("/music", ["artist", "title"]);

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

### Recipe: Add ReplayGain for Volume Normalization

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
const audioFile = await taglib.open("song.mp3");
const propMap = audioFile.properties();

// Set ReplayGain values (you'd calculate these with an audio analysis tool)
propMap.set("REPLAYGAIN_TRACK_GAIN", "-3.21 dB");
propMap.set("REPLAYGAIN_TRACK_PEAK", "0.988235");
propMap.set("REPLAYGAIN_ALBUM_GAIN", "-4.19 dB");
propMap.set("REPLAYGAIN_ALBUM_PEAK", "0.998871");

audioFile.save();
const buffer = audioFile.getFileBuffer();
audioFile.dispose();

// For batch processing entire albums
import { scanFolder, updateFolderTags } from "taglib-wasm/folder";

const files = await scanFolder("/album");
const updates = files.files.map((f) => ({
  path: f.path,
  tags: {
    REPLAYGAIN_ALBUM_GAIN: "-4.19 dB",
    REPLAYGAIN_REFERENCE_LOUDNESS: "89.0 dB",
  },
}));

await updateFolderTags(updates);
```

### Recipe: Clean Up Messy Tags

```typescript
import { scanFolder, updateFolderTags } from "taglib-wasm/folder";

const result = await scanFolder("/messy-music");

const updates = result.files.map((file) => {
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

| Error Message                  | Cause                        | Solution                                     |
| ------------------------------ | ---------------------------- | -------------------------------------------- |
| "Module not initialized"       | Wasm not loaded              | Ensure `await TagLib.initialize()` completed |
| "Invalid audio file format"    | Unsupported/corrupted file   | Check file extension and size (>1KB)         |
| "Cannot read property of null" | Accessing disposed AudioFile | Check disposal order in code                 |
| "File too small (under 1KB)"   | Empty or truncated file      | Validate file size before processing         |
| "Failed to allocate memory"    | Large file or memory leak    | Check for missing `dispose()` calls          |
| "File not found"               | Wrong path or permissions    | Verify file exists and is readable           |
| "Save failed"                  | Write permissions            | Check file/directory write permissions       |

### Debug Patterns

```typescript
// Pattern 1: Validate input before processing
if (buffer.byteLength < 1024) {
  throw new Error(`File too small: ${buffer.byteLength} bytes`);
}

// Pattern 2: Track memory usage
let activeFiles = 0;
try {
  const audioFile = await taglib.open(buffer);
  activeFiles++;
  console.log(`Active AudioFiles: ${activeFiles}`);
  // ... work with file
} finally {
  audioFile?.dispose();
  activeFiles--;
}

// Pattern 3: Detailed error logging
try {
  const audioFile = await taglib.open(buffer);
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

// ✅ GOOD: Proper cleanup
const files = await scanFolder("/music");
for (const file of files.files) {
  const audioFile = await taglib.open(file.path);
  try {
    const tag = audioFile.tag();
    // ... work with tag
  } finally {
    audioFile.dispose();
  }
}

// ✅ BETTER: Use Simple API for automatic cleanup
for (const file of files.files) {
  const tags = await readTags(file.path);
  // No disposal needed!
}
```

## Platform-Specific Notes

### Node.js / Bun

- Use `fs.readFile()` or `fs.promises.readFile()` to load files
- Full filesystem access available

### Browsers

- Use `fetch()` or FileReader API to load files
- No filesystem access; work with buffers in memory

### Deno

- Import using `npm:` specifier: `import { TagLib } from 'npm:taglib-wasm'`
- Use `Deno.readFile()` to load files
- Remember to grant file permissions with `--allow-read`
- Full example:

```typescript
import { applyTags, readTags } from "npm:taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.artist);

// Modify tags (returns buffer)
const modified = await applyTags("song.mp3", {
  artist: "New Artist",
  album: "New Album",
});

// Write back to file
await Deno.writeFile("song-modified.mp3", modified);
```

### Deno Compiled Utilities

When building Deno applications that will be distributed as compiled binaries
using `deno compile`, you have three options for including the Wasm module:

#### Option 1: Embed Wasm in the Binary (Recommended)

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Read the Wasm file at compile time
const wasmBytes = await Deno.readFile(
  new URL(import.meta.resolve("npm:taglib-wasm/dist/taglib.wasm")),
);

// Initialize with embedded Wasm
const taglib = await TagLib.initialize({ wasmBinary: wasmBytes });

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Compile with:

```bash
deno compile --allow-read music-tagger.ts
```

#### Option 2: Bundle Wasm File Separately

If you prefer to keep the Wasm file external (e.g., for smaller binary size):

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Load Wasm from a file path relative to the executable
const taglib = await TagLib.initialize({
  wasmUrl: new URL("./taglib.wasm", import.meta.url).href,
});

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Then distribute both the compiled binary and the Wasm file:

```bash
# Compile the binary
deno compile --allow-read music-tagger.ts

# Copy the Wasm file
cp node_modules/taglib-wasm/dist/taglib.wasm ./

# Both files must be distributed together
# - music-tagger (or music-tagger.exe)
# - taglib.wasm
```

#### Option 3: CDN Loading with Streaming (Simplest)

For applications that have internet access, you can use CDN loading which
provides optimal performance through WebAssembly streaming compilation:

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Initialize with CDN URL for streaming compilation
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Compile with:

```bash
deno compile --allow-read --allow-net music-tagger.ts
```

#### Performance Considerations

- **CDN Loading**: Smallest binary, uses streaming compilation, requires network
  on first run
- **Embedded Wasm**: Larger binary size (~800KB) but self-contained and works
  offline
- **External Wasm**: Medium binary size but requires distributing two files
- CDN loading provides fastest initial compilation through WebAssembly streaming
- All approaches have identical memory usage and performance after
  initialization

#### Choosing the Right Approach

- **CDN Loading**: Best for utilities that typically have internet access
- **Embedded Wasm**: Best for offline-first CLI tools and air-gapped
  environments
- **External Wasm**: Best when you need small binaries but can manage multiple
  files

### Cloudflare Workers

- Import from 'taglib-wasm/workers' for compatibility
- Use `fetch()` to load files from URLs or R2 storage
- Memory limits apply; be mindful of file sizes

## Performance Tips

1. **Reuse the TagLib instance**: Call `TagLib.initialize()` once and reuse the
   instance
2. **Dispose promptly**: Free memory as soon as you're done with a file
3. **Batch operations**: If modifying multiple tags, do them all before calling
   `save()`
4. **Use Simple API for reading**: When only reading tags, `readTags()` is more
   efficient
5. **Handle large files carefully**: The entire file is loaded into memory

## Common Mistakes to Avoid

### ❌ DON'T vs ✅ DO

| ❌ DON'T                     | ✅ DO                                                                      |
| ---------------------------- | -------------------------------------------------------------------------- |
| `TagLib.open(buffer)`        | `const taglib = await TagLib.initialize();`<br>`await taglib.open(buffer)` |
| `audioFile.tag().getTitle()` | `audioFile.tag().title`                                                    |
| `tag.title = "New"`          | `tag.setTitle("New")`                                                      |
| Forget to dispose            | Always use try/finally with `dispose()`                                    |
| Use AudioFile after dispose  | Dispose should be the last operation                                       |
| Load Wasm multiple times     | Initialize once, reuse the instance                                        |
| Process files sequentially   | Use Folder API for batch operations                                        |

### Critical Memory Management

```typescript
// ❌ DON'T: This leaks memory
async function getTitles(files) {
  const titles = [];
  for (const file of files) {
    const audioFile = await taglib.open(file);
    titles.push(audioFile.tag().title);
    // MISSING: audioFile.dispose()
  }
  return titles;
}

// ✅ DO: Proper cleanup
async function getTitles(files) {
  const titles = [];
  for (const file of files) {
    const audioFile = await taglib.open(file);
    try {
      titles.push(audioFile.tag().title);
    } finally {
      audioFile.dispose();
    }
  }
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
const file = await taglib.open(buffer);

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
  get(key: string): string | string[] | undefined;
  set(key: string, value: string | string[]): boolean;
  properties(): Record<string, string[]>;
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
  error?: Error; // Error if processing failed
}
```

## Example: Complete Music Library Scanner

### Using the Folder API (Recommended)

```typescript
// Node.js/Bun
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
} from "taglib-wasm/folder";

// Deno
import {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
} from "npm:taglib-wasm/folder";

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

  // Find duplicates
  const duplicates = await findDuplicates(directory, ["artist", "title"]);
  console.log(`\nFound ${duplicates.size} duplicate groups`);

  // Export full catalog
  await exportFolderMetadata(directory, "./music-catalog.json");
  console.log("\nExported catalog to music-catalog.json");

  // Return organized data
  return {
    library: result.files,
    duplicates: Array.from(duplicates.entries()),
    errors: result.errors,
    stats: {
      totalTracks: result.totalProcessed,
      totalDuration: result.files.reduce(
        (sum, f) => sum + (f.properties?.duration || 0),
        0,
      ),
      totalSize: result.files.reduce(
        (sum, f) =>
          sum +
          ((f.properties?.duration || 0) * (f.properties?.bitrate || 0) * 125),
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
      const audioFile = await taglib.open(buffer);

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

      audioFile.dispose();
    } catch (error) {
      console.error(`Failed to read ${file}:`, error.message);
    }
  }

  return library;
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
- **dispose()**: Release C++ memory (critical for Full API)
- **Wasm**: WebAssembly - allows C++ TagLib to run in JavaScript
