# TagLib-Wasm — AI Agent Reference

WebAssembly build of TagLib for reading/writing audio metadata in JS/TS.
Works in Deno, Node.js, Bun, browsers, and Cloudflare Workers.

## Install

```typescript
npm install taglib-wasm           // Node.js / Bun
import ... from "jsr:@charlesw/taglib-wasm"  // Deno (preferred)
```

## Quick Start

```typescript
// Simplest: read tags
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
console.log(tags.artist?.[0], tags.title?.[0]);

// Simplest: write tags
import { applyTagsToFile } from "taglib-wasm/simple";
await applyTagsToFile("song.mp3", { title: "New Title", artist: "New Artist" });
```

## Three APIs

| API        | Import                      | Memory                       | Best for                                          |
| ---------- | --------------------------- | ---------------------------- | ------------------------------------------------- |
| **Simple** | `taglib-wasm/simple`        | Automatic                    | One-off reads/writes, batch processing, cover art |
| **Full**   | `taglib-wasm`               | Manual (`using`/`dispose()`) | Complex operations, PropertyMap, ratings          |
| **Folder** | `taglib-wasm` (main export) | Automatic                    | Library scanning, duplicates, bulk updates        |

### Choosing an API

- **One file?** → Simple API: `readTags()`, `applyTagsToFile()`
- **Many files?** → Simple API: `readTagsBatch(files, { concurrency: 8 })` (10-20x faster)
- **Scan directory?** → Folder API: `scanFolder("/music", { recursive: true })`
- **PropertyMap / MusicBrainz / ReplayGain?** → Full API
- **Cover art?** → Simple API: `readCoverArt()`, `applyCoverArt()`
- **Ratings?** → Full API: `audioFile.getRating()`, `audioFile.setRating(0.8)`

## Simple API Reference

```typescript
import {
  applyCoverArt,
  applyTags,
  applyTagsToFile,
  readCoverArt,
  readMetadataBatch,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
} from "taglib-wasm/simple";

// Read
const tags = await readTags("song.mp3"); // { title?: string[], artist?: string[], ... }
const props = await readProperties("song.mp3"); // { duration, bitrate, sampleRate, channels, codec, isLossless }
const cover = await readCoverArt("song.mp3"); // Uint8Array | null

// Write
await applyTagsToFile("song.mp3", { title: "New" }); // Writes to disk
const buf = await applyTags("song.mp3", { title: "New" }); // Returns modified buffer
const buf2 = await applyCoverArt("song.mp3", imgData, "image/jpeg");

// Batch (10-20x faster than sequential)
const results = await readTagsBatch(files, { concurrency: 8 });
const metadata = await readMetadataBatch(files, { concurrency: 8 });
// Results: { items: [{ status: "ok", path, data } | { status: "error", path, error }] }
```

### Simple API Tag Shape

`readTags()` returns `ExtendedTag` — a superset of `Tag` with additional fields.

```typescript
// Base Tag
interface Tag {
  title?: string[];
  artist?: string[];
  album?: string[];
  comment?: string[];
  genre?: string[];
  year?: number;
  track?: number; // Note: numbers, not arrays
}

// ExtendedTag adds (all optional):
//   albumArtist, composer, conductor, copyright, isrc, lyricist: string[]
//   label, subtitle, producer: string[]
//   originalArtist, originalAlbum, originalDate: string[]
//   titleSort, artistSort, albumSort, albumArtistSort, composerSort: string[]
//   musicbrainzTrackId, musicbrainzReleaseId, musicbrainzArtistId, musicbrainzReleaseGroupId: string[]
//   acoustidFingerprint, acoustidId: string[]
//   replayGainTrackGain, replayGainTrackPeak: string[]
//   replayGainAlbumGain, replayGainAlbumPeak, appleSoundCheck: string[]
//   discNumber, totalTracks, totalDiscs, bpm: number
//   compilation: boolean
//   pictures: Picture[]; ratings, lyrics, chapters: array types
```

## Full API Reference

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize(); // Call once, reuse

// CRITICAL: Always use `using` for automatic cleanup (C++ objects aren't GC'd)
using audioFile = await taglib.open("song.mp3"); // Also accepts buffer, File, ArrayBuffer

// Read tags (properties, not methods)
const tag = audioFile.tag();
tag.title;
tag.artist;
tag.album;
tag.year;
tag.track;
tag.genre;

// Write tags (setter methods, not property assignment)
tag.setTitle("New");
tag.setArtist("New");
tag.setAlbum("New");
tag.setYear(2024);
tag.setTrack(5);

// Audio properties
const props = audioFile.audioProperties();
props.duration;
props.bitrate;
props.sampleRate;
props.channels;
props.codec;
props.containerFormat;
props.isLossless;
props.bitsPerSample;

// Save
audioFile.save(); // Returns boolean
const buffer = audioFile.getFileBuffer(); // Get modified data

// Convenience methods (open + edit + save + dispose in one call)
await taglib.edit("song.mp3", (file) => {
  file.tag().setTitle("New");
}); // Auto-saves to disk for paths, returns Uint8Array for buffers
await taglib.updateFile("song.mp3", { title: "New", artist: "New" }); // Shorthand

// PropertyMap (advanced metadata)
import { PROPERTIES } from "taglib-wasm"; // Type-safe property keys
const allProps = audioFile.properties(); // { albumArtist: ["..."], bpm: ["120"], ... }
audioFile.getProperty(PROPERTIES.MUSICBRAINZ_TRACKID.key);
audioFile.setProperty(PROPERTIES.REPLAYGAIN_TRACK_GAIN.key, "-3.5 dB");
audioFile.setProperties({ albumArtist: ["VA"], composer: ["Bach"] });

// Ratings (normalized 0.0-1.0)
audioFile.getRating(); // number | undefined
audioFile.setRating(0.8); // 4/5 stars
audioFile.setRating(0.8, "user@example.com");
```

### RatingUtils

```typescript
import { RatingUtils } from "taglib-wasm";
const { normalized, popm } = RatingUtils;

RatingUtils.toPopm(normalized(0.8)); // PopmRating(196)
RatingUtils.fromPopm(popm(196)); // NormalizedRating(0.8)
RatingUtils.toStars(normalized(0.8)); // 4
RatingUtils.fromStars(4); // NormalizedRating(0.8)
RatingUtils.toPercent(normalized(0.8)); // 80
```

## Folder API Reference

```typescript
import { scanFolder, updateFolderTags, findDuplicates, exportFolderMetadata } from "taglib-wasm";

// Scan (Deno/Node.js/Bun only)
const result = await scanFolder("/music", {
  recursive: true,
  extensions: [".mp3", ".flac"],
  onProgress: (processed, total, file) => { ... },
});
// result.items[]: { status, path, tags, properties?, hasCoverArt?, dynamics? }
// dynamics: { replayGainTrackGain?, replayGainAlbumGain?, appleSoundCheck? }

// Batch update
await updateFolderTags([
  { path: "/music/song.mp3", tags: { artist: "New" } },
]);

// Find duplicates
const dupes = await findDuplicates("/music", { criteria: ["artist", "title"] });

// Export
await exportFolderMetadata("/music", "./catalog.json");
```

## Import Patterns

```typescript
// Deno (JSR — preferred)
import { TagLib } from "jsr:@charlesw/taglib-wasm";
import { readTags } from "jsr:@charlesw/taglib-wasm/simple";

// Deno (NPM)
import { TagLib } from "npm:taglib-wasm";

// Node.js / Bun
import { TagLib } from "taglib-wasm";
import { readTags } from "taglib-wasm/simple";

// Type imports
import type { AudioProperties, FolderScanResult, Tag } from "taglib-wasm";

// Error utilities
import {
  isFileOperationError,
  isTagLibError,
  isUnsupportedFormatError,
  TagLibError,
} from "taglib-wasm";
```

## Key Behaviors

**Runtime auto-detection**: WASI backend for Deno/Node.js (seek-based filesystem I/O).
Emscripten for browsers (loads full buffer). No configuration needed.

**Deno compile**: `TagLib.initialize()` auto-detects compiled mode. For custom Wasm
paths: `import { initializeForDenoCompile } from "taglib-wasm"`. For offline,
embed with `deno compile --allow-read --include taglib-web.wasm myapp.ts`.

**Memory**: Simple API auto-manages. Full API requires `using` (preferred) or `dispose()`.
WASI path mode (Deno/Node.js with file paths) uses ~1-2MB regardless of file size.
Buffer mode (browsers, or when passing Uint8Array) uses ~2x file size.

**Supported formats**: MP3 (ID3v1/v2), MP4/M4A, FLAC, OGG Vorbis, WAV, Opus, APE,
MPC, WavPack, TrueAudio, Matroska/WebM. Auto-detected from content.

**Tag mapping**: All format-specific tag names normalized to camelCase via `properties()`.
Example: ID3v2 `TPE2` / Vorbis `ALBUMARTIST` / iTunes `aART` → `albumArtist`.

## Error Handling

```typescript
try {
  using audioFile = await taglib.open(buffer);
} catch (error) {
  if (isUnsupportedFormatError(error)) { /* error.format */ }
  if (isFileOperationError(error)) { /* error.operation, error.path */ }
  if (isTagLibError(error)) { /* base error type */ }
}
```

Error types: `TagLibInitializationError`, `FileOperationError`, `UnsupportedFormatError`,
`InvalidFormatError`, `MemoryError`, `MetadataError`, `EnvironmentError`.

## Common Mistakes

| Mistake                       | Fix                                                                   |
| ----------------------------- | --------------------------------------------------------------------- |
| `TagLib.open(buffer)`         | `const taglib = await TagLib.initialize(); await taglib.open(buffer)` |
| `tag.getTitle()`              | `tag.title` (properties, not getter methods)                          |
| `tag.title = "New"`           | `tag.setTitle("New")` (setter methods, not assignment)                |
| Forgetting disposal           | Use `using audioFile = ...` for automatic cleanup                     |
| Processing files sequentially | Use batch APIs with `concurrency: 8`                                  |

## Initialization Options

```typescript
await TagLib.initialize(); // Default (auto)
await TagLib.initialize({ wasmUrl: "https://cdn.example/t.wasm" }); // CDN streaming
await TagLib.initialize({ wasmBinary: arrayBuffer }); // Embedded
await TagLib.initialize({ forceWasmType: "emscripten" }); // Force backend
```

## Recipes

### Read + Write Roundtrip (Full API)

```typescript
const taglib = await TagLib.initialize();

// Simplest: edit + auto-save in one call
await taglib.edit("song.mp3", (file) => file.tag().setTitle("Updated Title"));

// Or manual control:
using audioFile = await taglib.open("song.mp3");
audioFile.tag().setTitle("Updated Title");
await audioFile.saveToFile("song.mp3");
```

### Cover Art

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";
const cover = await readCoverArt("song.mp3");
const modified = await applyCoverArt("song.mp3", imageData, "image/jpeg");
```

### Batch Album Processing

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
const result = await readMetadataBatch(albumFiles, { concurrency: 8 });
for (const item of result.items) {
  if (item.status === "ok") {
    console.log(item.data.tags.title?.[0], item.data.properties?.duration);
  }
}
```

### Copy Tags Between Formats

```typescript
import { applyTagsToFile, readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
await applyTagsToFile("song.flac", tags); // Format mapping is automatic
```

### Cloudflare Worker

```typescript
import { TagLib } from "taglib-wasm";
let taglib: Awaited<ReturnType<typeof TagLib.initialize>> | null = null;

export default {
  async fetch(request: Request): Promise<Response> {
    taglib ??= await TagLib.initialize();
    using file = await taglib.open(new Uint8Array(await request.arrayBuffer()));
    return Response.json({
      title: file.tag().title,
      artist: file.tag().artist,
    });
  },
};
```

### Browser File Input

```typescript
const taglib = await TagLib.initialize();
input.addEventListener("change", async (e) => {
  using audioFile = await taglib.open(e.target.files[0]);
  console.log(audioFile.tag().title);
});
```

## Troubleshooting

| Error                            | Cause                | Fix                                          |
| -------------------------------- | -------------------- | -------------------------------------------- |
| "Module not initialized"         | Wasm not loaded      | Ensure `await TagLib.initialize()` completed |
| "Invalid audio file format"      | Bad/unsupported file | Check file content and size (>1KB)           |
| "Cannot read property of null"   | Used after dispose   | Check disposal order                         |
| "Failed to allocate memory"      | Leak or huge file    | Use `using` or check for missing `dispose()` |
| "WebAssembly.instantiate failed" | CORS or network      | Check Wasm URL and CORS headers              |

## Contributing

### Setup

```bash
git clone --recurse-submodules https://github.com/CharlesWiltgen/TagLib-Wasm.git
cd TagLib-Wasm
```

### Build & Test

```bash
deno task test              # ALL checks (format, lint, typecheck, tests)
deno task build             # Build TypeScript + Emscripten Wasm
bash build/build-wasi.sh    # Rebuild WASI Wasm (requires WASI SDK 31)
```

### Architecture

Two Wasm backends: **Emscripten** (browsers) and **WASI** (Deno/Node.js).
Auto-selected at runtime. Both wrap TagLib 2.2 C++ via a C boundary layer.

Key files: `build/taglib_embind.cpp` (Emscripten), `src/capi/taglib_shim.cpp` (WASI),
`src/capi/core/taglib_boundary.c` (C boundary), `src/taglib.ts` (core TS API).

Dependencies are git submodules: `lib/taglib`, `lib/mpack`, `lib/msgpack`.

See `CONTRIBUTING.md` for full contributor guide.
