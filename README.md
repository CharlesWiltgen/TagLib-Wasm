# TagLib-Wasm

[![Tests](https://github.com/CharlesWiltgen/taglib-wasm/actions/workflows/test.yml/badge.svg)](https://github.com/CharlesWiltgen/taglib-wasm/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![npm downloads](https://img.shields.io/npm/dm/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/CharlesWiltgen/taglib-wasm/blob/main/LICENSE)
<br>[![Built with](https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=f5f5f5)](https://www.typescriptlang.org/)
[![Built with Emscripten](https://img.shields.io/badge/Built%20with-Emscripten-4B9BFF.svg)](https://emscripten.org/)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0.svg?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Built with TagLib](https://img.shields.io/badge/Built%20with-TagLib-brightgreen.svg)](https://taglib.org/)
<br>[![Deno](https://img.shields.io/badge/Deno-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Browsers](https://img.shields.io/badge/Browsers-E34C26?logo=html5&logoColor=white)](https://html.spec.whatwg.org/multipage/)

TagLib-Wasm is the **universal tagging library for TypeScript/JavaScript**
(TS|JS) platforms: **Deno**, **Node.js**, **Bun**, **Cloudflare Workers**,
**Electron**, and **browsers**.

This project exists because the TS|JS ecosystem had no battle-tested audio
tagging library that supports reading and writing music metadata to all popular
audio formats. It aspires to be a universal solution for all TS|JS-capable
platforms — Deno, Node.js, Bun, Electron, Cloudflare Workers, and browsers.

TagLib-Wasm stands on the shoulders of giants, including
[TagLib](https://taglib.org/) itself, [Emscripten](https://emscripten.org/), and
[Wasm](https://webassembly.org/) ([WebAssembly](https://webassembly.org/)).
TagLib itself is legendary, and a core dependency of many music apps.

## Features

- **Local filesystem support** – On Deno and Node.js, WASI enables seek-based
  I/O that reads only headers and tags from disk — not entire files
- **Automatic runtime optimization** – Auto-selects WASI (server) or Emscripten
  (browser) for optimal performance with no configuration
- **Full audio format support** – Supports all audio formats supported by TagLib
- **TypeScript first** – Complete type definitions and modern API
- **Wide TS/JS runtime support** – Deno, Node.js, Bun, Electron, Cloudflare
  Workers, and browsers
- **Format abstraction** – Handles container format details automagically when
  possible
- **Zero dependencies** – Self-contained Wasm bundle
- **Production ready** – Growing test suite helps ensure safety and reliability
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
> [installation guide](https://charleswiltgen.github.io/taglib-wasm/guide/installation.html).

### Bun

```bash
bun add taglib-wasm
```

### Electron

```bash
npm install taglib-wasm
```

Works in both main and renderer processes:

```typescript
// Main process
import { TagLib } from "taglib-wasm";

// Renderer process (with nodeIntegration: true)
const { TagLib } = require("taglib-wasm");
```

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
[complete Deno compile guide](https://charleswiltgen.github.io/taglib-wasm/guide/deno-compile.html)
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
import { applyTags, readTags, updateTags } from "taglib-wasm/simple";

// Read tags - just one function call!
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Apply tags and get modified buffer (in-memory)
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Or update tags on disk (requires file path)
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### High-Performance Batch Processing

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Process multiple files in parallel - dramatically faster!
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

See the [Track Ratings Guide](https://charleswiltgen.github.io/taglib-wasm/guide/ratings.html)
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

**[View Full Documentation](https://charleswiltgen.github.io/taglib-wasm/)**

### Getting Started

- [Installation Guide](https://charleswiltgen.github.io/taglib-wasm/guide/installation.html)
- [Quick Start Tutorial](https://charleswiltgen.github.io/taglib-wasm/guide/quick-start.html)
- [All Examples](https://charleswiltgen.github.io/taglib-wasm/guide/examples.html)

### Guides

- [API Reference](https://charleswiltgen.github.io/taglib-wasm/api/)
- [Performance Guide](https://charleswiltgen.github.io/taglib-wasm/concepts/performance.html)
- [Album Processing Guide](https://charleswiltgen.github.io/taglib-wasm/guide/album-processing.html) - Process entire albums in seconds
- [Platform Examples](https://charleswiltgen.github.io/taglib-wasm/guide/platform-examples.html)
- [Working with Cover Art](https://charleswiltgen.github.io/taglib-wasm/guide/cover-art.html)
- [Track Ratings](https://charleswiltgen.github.io/taglib-wasm/guide/ratings.html)
- [Cloudflare Workers Setup](https://charleswiltgen.github.io/taglib-wasm/guide/workers-setup.html)
- [Error Handling](https://charleswiltgen.github.io/taglib-wasm/concepts/error-handling.html)

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

## Key Features

### Extended Metadata Support

Beyond basic tags, taglib-wasm supports extended metadata:

```typescript
import { Tags } from "taglib-wasm";

// AcoustID fingerprints
file.setProperty(
  Tags.AcoustidFingerprint,
  "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...",
);

// MusicBrainz IDs
file.setProperty(
  Tags.MusicBrainzTrackId,
  "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
);

// ReplayGain volume normalization
file.setProperty(Tags.TrackGain, "-6.54 dB");
file.setProperty(Tags.TrackPeak, "0.987654");
```

[View all supported tag constants →](https://charleswiltgen.github.io/taglib-wasm/api/tag-constants.html)

## Performance and Best Practices

### Batch Processing for Multiple Files

When processing multiple audio files, use the optimized batch APIs for dramatic performance improvements:

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// ❌ SLOW: Processing files one by one (can take 90+ seconds for 19 files)
for (const file of files) {
  const tags = await readTags(file); // Re-initializes for each file
}

// ✅ FAST: Batch processing (10-20x faster)
const result = await readTagsBatch(files, {
  concurrency: 8, // Process 8 files in parallel
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} files processed`);
  },
});

// ✅ FASTEST: Read complete metadata in one batch
const metadata = await readMetadataBatch(files, { concurrency: 8 });
```

**Performance comparison for 19 audio files:**

- Sequential: ~90 seconds (4.7s per file)
- Batch (concurrency=4): ~8 seconds (11x faster)
- Batch (concurrency=8): ~5 seconds (18x faster)

### Smart Partial Loading

For large audio files (>50MB), enable partial loading to dramatically reduce memory usage:

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

| Environment            | Backend           | How it works                                           | Performance    |
| ---------------------- | ----------------- | ------------------------------------------------------ | -------------- |
| **Deno / Node.js**     | WASI (auto)       | Seek-based filesystem I/O; reads only headers and tags | Fastest        |
| **Browsers / Workers** | Emscripten (auto) | Entire file loaded into memory as buffer               | Baseline       |
| **Opt-in**             | Wasmtime sidecar  | Out-of-process WASI with direct filesystem access      | Best for batch |

On Deno and Node.js you get WASI automatically — nothing to configure. For
heavy batch workloads, the optional Wasmtime sidecar provides direct filesystem
access via a sandboxed subprocess:

```bash
# Optional: Install Wasmtime for sidecar mode
curl https://wasmtime.dev/install.sh -sSf | bash
```

```typescript
import { readTags, setSidecarConfig } from "taglib-wasm/simple";

// Enable sidecar mode (requires Wasmtime)
await setSidecarConfig({
  preopens: { "/music": "/home/user/Music" },
});

// Now path-based calls use direct WASI filesystem access
const tags = await readTags("/music/song.mp3");
```

See the
[Runtime Compatibility Guide](https://charleswiltgen.github.io/taglib-wasm/concepts/runtime-compatibility.html)
for full sidecar configuration options.

### WebAssembly Streaming

For web applications, use CDN URLs to enable WebAssembly streaming compilation:

```typescript
// ✅ FAST: Streaming compilation (200-400ms)
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// ❌ SLOWER: ArrayBuffer loading (400-800ms)
const wasmBinary = await fetch("taglib.wasm").then((r) => r.arrayBuffer());
const taglib = await TagLib.initialize({ wasmBinary });
```

[View complete performance guide →](https://charleswiltgen.github.io/taglib-wasm/concepts/performance.html)

## Development

### Build from Source

```bash
# Prerequisites: Emscripten SDK
# Install via: https://emscripten.org/docs/getting_started/downloads.html

# Clone and build
git clone https://github.com/CharlesWiltgen/taglib-wasm.git
cd taglib-wasm

# Build Wasm module
npm run build:wasm

# Run tests
npm test
```

[View full development guide →](CONTRIBUTING.md)

## Runtime Compatibility

`taglib-wasm` works across all major JavaScript runtimes:

| Runtime                | Status | Installation              | Notes                     |
| ---------------------- | ------ | ------------------------- | ------------------------- |
| **Deno**               | Full   | `npm:taglib-wasm`         | Native TypeScript         |
| **Node.js**            | Full   | `npm install taglib-wasm` | TypeScript via tsx        |
| **Bun**                | Full   | `bun add taglib-wasm`     | Native TypeScript         |
| **Browser**            | Full   | Via bundler               | Full API support          |
| **Cloudflare Workers** | Full   | `taglib-wasm/workers`     | Memory-optimized build    |
| **Electron**           | Full   | `npm install taglib-wasm` | Main & renderer processes |

## Known Limitations

- **Memory Usage (browsers)** – In browser environments, entire files are loaded
  into memory. On Deno/Node.js, WASI reads only headers and tags from disk.
- **Concurrent Access** – Not thread-safe (JavaScript single-threaded nature
  mitigates this)
- **Cloudflare Workers** – Limited to 128MB memory per request; files larger
  than ~100MB may fail

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
