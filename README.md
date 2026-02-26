# TagLib-Wasm

[![Tests](https://github.com/CharlesWiltgen/TagLib-Wasm/actions/workflows/test.yml/badge.svg)](https://github.com/CharlesWiltgen/TagLib-Wasm/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![npm downloads](https://img.shields.io/npm/dm/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/LICENSE)
<br>[![Built with](https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=f5f5f5)](https://www.typescriptlang.org/)
[![Built with Emscripten](https://img.shields.io/badge/Built%20with-Emscripten-4B9BFF.svg)](https://emscripten.org/)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0.svg?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Built with TagLib](https://img.shields.io/badge/Built%20with-TagLib-brightgreen.svg)](https://taglib.org/)
<br>[![Deno](https://img.shields.io/badge/Deno-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Electron (Node.js)](https://img.shields.io/badge/Electron%20%28Node.js%29-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Browsers](https://img.shields.io/badge/Browsers-E34C26?logo=html5&logoColor=white)](https://html.spec.whatwg.org/multipage/)

TagLib-Wasm is the **universal tagging library for TypeScript/JavaScript**
(TS|JS) platforms: **Deno**, **Node.js**, **Bun**, **Cloudflare Workers**,
**Electron** (via Node.js), and **browsers**.

## Features

- **Local filesystem support** – On Deno and Node.js, WASI enables seek-based
  I/O that reads only headers and tags from disk — not entire files
- **Automatic runtime optimization** – Auto-selects WASI (server) or Emscripten
  (browser) for optimal performance with no configuration
- **Full audio format support** – Supports all audio formats supported by TagLib
- **TypeScript first** – Complete type definitions and modern API
- **Wide TS/JS runtime support** – Deno, Node.js, Bun, Electron (Node.js),
  Cloudflare Workers, and browsers
- **Format abstraction** – Handles container format details automatically when
  possible
- **Zero dependencies** – Self-contained Wasm bundle
- **Tested** – 135+ tests across all formats
- **Two API styles** – Use the "Simple" API (3 functions), or the full "Core"
  API for more advanced applications
- **Batch folder operations** – Scan directories, process multiple files, find
  duplicates, and export metadata catalogs

## Installation

### Deno

```typescript
import { TagLib } from "@charlesw/taglib-wasm";
```

### Node.js

```bash
npm install taglib-wasm
```

> **Note:** Requires Node.js v22.6.0 or higher. If you want to use the
> TypeScript version with Node.js, see the
> [installation guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/installation.html).

### Bun

```bash
bun add taglib-wasm
```

### Electron (Node.js)

```bash
npm install taglib-wasm
```

taglib-wasm works in Electron's main process (which is Node.js). For the
renderer process, expose metadata through IPC:

```typescript
// Main process
import { TagLib } from "taglib-wasm";
```

See [Platform Examples](docs/guide/platform-examples.md#electron) for full IPC
setup.

### Deno Compiled Binaries (Offline Support)

For Deno compiled binaries that need to work offline, you can embed the WASM
file:

```typescript
// 1. Prepare your build by copying the WASM file
import { prepareWasmForEmbedding } from "@charlesw/taglib-wasm";
await prepareWasmForEmbedding("./taglib.wasm");

// 2. In your application, use the helper for automatic handling
import { initializeForDenoCompile } from "@charlesw/taglib-wasm";
const taglib = await initializeForDenoCompile();

// 3. Compile with the embedded WASM
// deno compile --allow-read --include taglib.wasm myapp.ts
```

See the
[complete Deno compile guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/deno-compile.html)
for more options including CDN loading.

For manual control:

```typescript
// Load embedded WASM in compiled binaries
const wasmBinary = await Deno.readFile(
  new URL("./taglib.wasm", import.meta.url),
);
const taglib = await TagLib.initialize({ wasmBinary });
```

## Quick Start

> **Import paths:** Deno uses `@charlesw/taglib-wasm`, npm uses `taglib-wasm`.
> Examples below use npm paths — substitute accordingly.

### Simple API

```typescript
import {
  applyTagsToBuffer,
  readTags,
  writeTagsToFile,
} from "taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Apply tags and get modified buffer (in-memory)
const modifiedBuffer = await applyTagsToBuffer("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Or update tags on disk (requires file path)
await writeTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### High-Performance Batch Processing

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Process multiple files in parallel
const files = ["track01.mp3", "track02.mp3", /* ... */ "track20.mp3"];

// Read just tags (18x faster than sequential)
const tags = await readTagsBatch(files, { concurrency: 8 });

// Read complete metadata including cover art detection (15x faster)
const metadata = await readMetadataBatch(files, { concurrency: 8 });

// Real-world performance:
// Sequential: ~100 seconds for 20 files
// Batch: ~5 seconds for 20 files (20x speedup!)
```

### Full API

The Full API might be a better choice for apps and utilities focused on advanced
metadata management.

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (automatically cleaned up when scope exits)
using file = await taglib.open("song.mp3");

// Read and update metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");

// Save changes
file.save();
```

### Batch Folder Operations

Process entire music collections efficiently:

```typescript
import { findDuplicates, scanFolder } from "taglib-wasm";

// Scan a music library
const result = await scanFolder("/path/to/music", {
  recursive: true,
  concurrency: 4,
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});

console.log(`Found ${result.totalFound} audio files`);
console.log(`Successfully processed ${result.totalProcessed} files`);

// Process results
for (const file of result.files) {
  console.log(`${file.path}: ${file.tags.artist} - ${file.tags.title}`);
  console.log(`Duration: ${file.properties?.duration}s`);
}

// Find duplicates
const duplicates = await findDuplicates("/path/to/music", {
  criteria: ["artist", "title"],
});
console.log(`Found ${duplicates.size} groups of duplicates`);
```

### Working with Cover Art

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";

// Extract cover art
const coverData = await readCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set new cover art
const imageData = await Deno.readFile("new-cover.jpg");
const modifiedBuffer = await applyCoverArt("song.mp3", imageData, "image/jpeg");
// Save modifiedBuffer to file if needed
```

### Working with Ratings

```typescript
import { RatingUtils, TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("song.mp3");

// Read rating (normalized 0.0-1.0)
const rating = file.getRating();
if (rating !== undefined) {
  console.log(`Rating: ${RatingUtils.toStars(rating)} stars`);
}

// Set rating (4 out of 5 stars)
file.setRating(0.8);
file.save();
```

See the [Track Ratings Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/ratings.html)
for RatingUtils API and cross-format conversion details.

### Container Format and Codec Detection

```typescript
import { readProperties } from "taglib-wasm/simple";

// Get detailed audio properties including container and codec info
const props = await readProperties("song.m4a");

console.log(props.containerFormat); // "MP4" (container format)
console.log(props.codec); // "AAC" or "ALAC" (compressed media format)
console.log(props.isLossless); // false for AAC, true for ALAC
console.log(props.bitsPerSample); // 16 for most formats
console.log(props.bitrate); // 256 (kbps)
console.log(props.sampleRate); // 44100 (Hz)
console.log(props.length); // 180 (duration in seconds)
```

Container format vs Codec:

- **Container format** – How audio data and metadata are packaged (e.g., MP4, OGG)
- **Codec** – How audio is compressed/encoded (e.g., AAC, Vorbis)

Supported formats:

- **MP4 container** (.mp4, .m4a) – Can contain AAC (lossy) or ALAC (lossless)
- **OGG container** (.ogg) – Can contain Vorbis, Opus, FLAC, or Speex
- **MP3** – Both container and codec (lossy)
- **FLAC** – Both container and codec (lossless)
- **WAV** – Container for PCM (uncompressed) audio
- **AIFF** – Container for PCM (uncompressed) audio

## Documentation

**[View Full Documentation](https://charleswiltgen.github.io/TagLib-Wasm/)**

### Getting Started

- [Installation Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/installation.html)
- [Quick Start Tutorial](https://charleswiltgen.github.io/TagLib-Wasm/guide/quick-start.html)
- [All Examples](https://charleswiltgen.github.io/TagLib-Wasm/guide/examples.html)

### Guides

- [API Reference](https://charleswiltgen.github.io/TagLib-Wasm/api/)
- [Performance Guide](https://charleswiltgen.github.io/TagLib-Wasm/concepts/performance.html)
- [Album Processing Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/album-processing.html)
- [Platform Examples](https://charleswiltgen.github.io/TagLib-Wasm/guide/platform-examples.html)
- [Working with Cover Art](https://charleswiltgen.github.io/TagLib-Wasm/guide/cover-art.html)
- [Track Ratings](https://charleswiltgen.github.io/TagLib-Wasm/guide/ratings.html)
- [Cloudflare Workers](https://charleswiltgen.github.io/TagLib-Wasm/advanced/cloudflare-workers.html)
- [Error Handling](https://charleswiltgen.github.io/TagLib-Wasm/concepts/error-handling.html)
- [Contributing](CONTRIBUTING.md)

## Supported Formats

`taglib-wasm` is designed to support all formats supported by TagLib:

- **.mp3** – ID3v2 and ID3v1 tags
- **.m4a/.mp4** – MPEG-4/AAC metadata for AAC and Apple Lossless audio
- **.flac** – Vorbis comments and audio properties
- **.ogg** – Ogg Vorbis format with full metadata support
- **.wav** – INFO chunk metadata
- **Additional formats** – Opus, APE, MPC, WavPack, TrueAudio, AIFF, WMA, and
  more

## Performance and Best Practices

### Batch Processing for Multiple Files

When processing multiple audio files, use the optimized batch APIs for better performance:

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Processing files one by one (can take 90+ seconds for 19 files)
for (const file of files) {
  const tags = await readTags(file); // Re-initializes for each file
}

// Batch processing (10-20x faster)
const result = await readTagsBatch(files, {
  concurrency: 8, // Process 8 files in parallel
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} files processed`);
  },
});

// Read complete metadata in one batch
const metadata = await readMetadataBatch(files, { concurrency: 8 });
```

**Performance comparison for 19 audio files:**

- Sequential: ~90 seconds (4.7s per file)
- Batch (concurrency=4): ~8 seconds (11x faster)
- Batch (concurrency=8): ~5 seconds (18x faster)

### Smart Partial Loading

For large audio files (>50MB), enable partial loading to reduce memory usage:

```typescript
// Enable partial loading for large files
using file = await taglib.open("large-concert.flac", {
  partial: true,
  maxHeaderSize: 2 * 1024 * 1024, // 2MB header
  maxFooterSize: 256 * 1024, // 256KB footer
});

// Read operations work normally
const tags = file.tag();
console.log(tags.title, tags.artist);

// Smart save - automatically loads full file when needed
await file.saveToFile(); // Full file loaded only here
```

**Performance gains:**

- **500MB file**: ~450x less memory usage (1.1MB vs 500MB)
- **Initial load**: 50x faster (50ms vs 2500ms)
- **Memory peak**: 3.3MB instead of 1.5GB

### Runtime Optimization Tiers

taglib-wasm auto-selects the fastest available backend — no configuration needed:

| Environment              | Backend           | How it works                                           | Performance |
| ------------------------ | ----------------- | ------------------------------------------------------ | ----------- |
| **Deno / Node.js / Bun** | WASI (auto)       | Seek-based filesystem I/O; reads only headers and tags | Fastest     |
| **Browsers / Workers**   | Emscripten (auto) | Entire file loaded into memory as buffer               | Baseline    |

On Deno, Node.js, and Bun you get WASI automatically — nothing to configure.

## Runtime Compatibility

`taglib-wasm` works across all major JavaScript runtimes:

| Runtime                | Status  | Installation              | Notes                                                                      |
| ---------------------- | ------- | ------------------------- | -------------------------------------------------------------------------- |
| **Deno**               | Full    | `npm:taglib-wasm`         | Native TypeScript                                                          |
| **Node.js**            | Full    | `npm install taglib-wasm` | TypeScript via tsx                                                         |
| **Bun**                | Partial | `bun add taglib-wasm`     | Import + init verified; full test suite is Deno-only                       |
| **Browser**            | Full    | Via bundler               | Full API support                                                           |
| **Cloudflare Workers** | Full    | `npm install taglib-wasm` | Same unified API; see [Workers guide](docs/advanced/cloudflare-workers.md) |
| **Electron**           | Node.js | `npm install taglib-wasm` | Main process; renderer via IPC                                             |

## Known Limitations

- **Memory Usage (browsers)** – In browser environments, entire files are loaded
  into memory. On Deno/Node.js, WASI reads only headers and tags from disk.
- **Concurrent Access** – Not thread-safe (JavaScript single-threaded nature
  mitigates this)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md)
for details on our code of conduct and the process for submitting pull requests.

## License

This project uses dual licensing:

- **TypeScript/JavaScript code** – MIT License (see [LICENSE](LICENSE))
- **WebAssembly binary (taglib.wasm)** – LGPL-2.1-or-later (inherited from
  TagLib)

The TagLib library is dual-licensed under LGPL/MPL. When compiled to
WebAssembly, the resulting binary must comply with LGPL requirements. This
means:

- You can use taglib-wasm in commercial projects
- If you modify the TagLib C++ code, you must share those changes
- You must provide a way for users to relink with a modified TagLib

For details, see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL)

## Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
- [WASI](https://wasi.dev/) – WebAssembly System Interface for server-side runtimes
