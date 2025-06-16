# TagLib-Wasm

[![npm version](https://img.shields.io/npm/v/taglib-wasm.svg?logo=nodedotjs&logoColor=f5f5f5)](https://www.npmjs.com/package/taglib-wasm)
[![npm downloads](https://img.shields.io/npm/dm/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![License](https://img.shields.io/npm/l/taglib-wasm.svg)](https://github.com/CharlesWiltgen/taglib-wasm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg?logo=typescript&logoColor=f5f5f5)](https://www.typescriptlang.org/)
[![Built with Emscripten](https://img.shields.io/badge/Built%20with-Emscripten-4B9BFF.svg)](https://emscripten.org/)
[![Platform Support](https://img.shields.io/badge/Platforms-Universal-orange.svg?logo=javascript&logoColor=f5f5f5)]()

**TagLib-Wasm** is the universal tagging library for TypeScript platforms: Deno,
Node.js, Bun, Cloudflare Workers and browsers.

> “What if [**TagLib**](https://taglib.org/), but TypeScript?”

This project exists because the TypeScipt/JavaScript ecosystem had no
battle-tested audio tagging library that supports reading and writing music
metadata to all popular audio formats. It aspires to be a universal solution for
all **TypeScript**-capable platforms — Deno, Node.js, Bun, Cloudflare Workers,
and browsers.

TagLib-Wasm stands on the shoulders of giants, including
[TagLib](https://taglib.org/) itself, [Emscripten](https://emscripten.org/), and
[Wasm](https://webassembly.org/) ([WebAssembly](https://webassembly.org/)).
TagLib itself is legendary and a core dependency of many music apps.

## 🎯 Features

- **✅ Full audio format support** – Supports all audio formats supported by
  TagLib
- **✅ TypeScript first** – Complete type definitions and modern API
- **✅ Wide TS/JS runtime support** – Deno, Node.js, Bun, Cloudflare Workers,
  and browsers
- **✅ Format abstraction** – Handles container format details automagically
  when possible
- **✅ Zero dependencies** – Self-contained Wasm bundle
- **✅ Production ready** – Growing test suite helps ensure safety and
  reliability
- **✅ Two API styles** – Use the “Simple” API (3 functions), or the full “Core”
  API for more advanced applications

## 📦 Installation

### Deno

```typescript
import { TagLib } from "npm:taglib-wasm";
```

### Node.js

```bash
npm install taglib-wasm
```

The package uses TypeScript. You have two options:

#### Option 1: Use Node’s native TypeScript support

```bash
# Node.js 22.6.0+ with experimental flag
node --experimental-strip-types your-script.ts

# Node.js 23.6.0+ (no flag needed)
node your-script.ts
```

#### Option 2: TypeScript loader (recommended for production)

```bash
npm install --save-dev tsx
npx tsx your-script.ts
```

### Bun

```bash
bun add taglib-wasm
```

## 🚀 Quick Start

### Simple API

This was inspired by [go-taglib](https://github.com/sentriz/go-taglib), a
similar project for Go created at about the same time.

```typescript
import {
  readProperties,
  readTags,
  updateTags,
  writeTags,
} from "taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Write tags (returns modified buffer)
const buffer = await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});

// Or update file in-place (simpler)
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Read audio properties
const props = await readProperties("song.mp3");
console.log(`Duration: ${props.length}s, Bitrate: ${props.bitrate} kbps`);
```

### Core API

The Core API provides full control for more advanced applications.

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
const file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: const file = await taglib.open(buffer);

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes back to file
await file.saveToFile(); // Saves to original path
// Or save to a new file: await file.saveToFile("new-song.mp3");

// Clean up
file.dispose();

// Convenience methods for common operations
await taglib.updateFile("song.mp3", {
  title: "Updated Title",
  artist: "Updated Artist",
});

// Copy file with new tags
await taglib.copyWithTags("original.mp3", "copy.mp3", {
  title: "Copy of Song",
  comment: "This is a copy",
});
```

### Tag Constants

taglib-wasm provides type-safe tag constants with IDE autocomplete:

```typescript
import { Tags } from "taglib-wasm";

// Use constants for better type safety and autocomplete
const properties = file.properties();

// Read properties
const title = properties[Tags.Title]?.[0];
const albumArtist = properties[Tags.AlbumArtist]?.[0];
const musicBrainzId = properties[Tags.MusicBrainzArtistId]?.[0];

// Write properties
file.setProperties({
  [Tags.Title]: ["My Song"],
  [Tags.AlbumArtist]: ["Various Artists"],
  [Tags.Bpm]: ["128"],
});

// All constants provide IDE autocomplete
Tags.Title; // → "TITLE"
Tags.Artist; // → "ARTIST"
Tags.AlbumArtist; // → "ALBUMARTIST"
Tags.TrackGain; // → "REPLAYGAIN_TRACK_GAIN"
// ... and many more
```

See [Tag Name Constants](docs/Tag-Name-Constants.md) for the complete list of
available tags and format-specific mappings.

### Working with Cover Art

taglib-wasm provides comprehensive support for reading, writing, and managing embedded pictures in audio files with both basic and advanced APIs.

#### Quick Cover Art Operations

```typescript
import { getCoverArt, setCoverArt } from "taglib-wasm/simple";

// Extract primary cover art (super simple!)
const coverData = await getCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set cover art from image file
const imageData = await Deno.readFile("new-cover.jpg");
const modifiedBuffer = await setCoverArt("song.mp3", imageData, "image/jpeg");
```

#### File I/O Helpers

```typescript
import { exportCoverArt, importCoverArt, copyCoverArt } from "taglib-wasm/file-utils";

// Export cover art to file (one-liner!)
await exportCoverArt("song.mp3", "cover.jpg");

// Import cover art from file (modifies audio file in place)
await importCoverArt("song.mp3", "new-cover.jpg");

// Copy cover art between files
await copyCoverArt("source.mp3", "target.mp3");
```

#### Browser/Canvas Integration

```typescript
import { setCoverArtFromCanvas, pictureToDataURL } from "taglib-wasm/web-utils";

// Display cover art in browser
const pictures = await readPictures("song.mp3");
const img = document.getElementById('coverArt');
img.src = pictureToDataURL(pictures[0]);

// Set cover art from HTML canvas
const canvas = document.getElementById('myCanvas');
const modifiedBuffer = await setCoverArtFromCanvas("song.mp3", canvas, {
  format: 'image/jpeg',
  quality: 0.9
});
```

#### Complete Picture Management

```typescript
import { PictureType } from "taglib-wasm";
import { readPictures, applyPictures, replacePictureByType } from "taglib-wasm/simple";

// Read all pictures with metadata
const pictures = await readPictures("song.mp3");
for (const pic of pictures) {
  console.log(`Type: ${PictureType[pic.type]}`);
  console.log(`MIME: ${pic.mimeType}`);
  console.log(`Size: ${pic.data.length} bytes`);
  console.log(`Description: ${pic.description || 'none'}`);
}

// Replace specific picture type
await replacePictureByType("song.mp3", {
  mimeType: "image/png",
  data: backCoverData,
  type: PictureType.BackCover,
  description: "Album back cover"
});

// Manage multiple artwork types
await applyPictures("deluxe-album.mp3", [
  { type: PictureType.FrontCover, mimeType: "image/jpeg", data: frontData },
  { type: PictureType.BackCover, mimeType: "image/jpeg", data: backData },
  { type: PictureType.Media, mimeType: "image/jpeg", data: cdData },
  { type: PictureType.BandLogo, mimeType: "image/png", data: logoData }
]);
```

## Platform examples

### Deno

```typescript
import { TagLib } from "npm:taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
const file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: const file = await taglib.open(await Deno.readFile("song.mp3"));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());

// Clean up
file.dispose();
```

### Node.js

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
const file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: const file = await taglib.open(await readFile("song.mp3"));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());

// Clean up
file.dispose();
```

### Bun

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
const file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: const file = await taglib.open(new Uint8Array(await Bun.file("song.mp3").arrayBuffer()));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());

// Clean up
file.dispose();
```

### Browser

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load from file input or fetch
const fileInput = document.querySelector('input[type="file"]');
const audioFile = fileInput.files[0];
const audioData = new Uint8Array(await audioFile.arrayBuffer());
const file = await taglib.open(audioData); // Browser requires buffer

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());

// Clean up
file.dispose();
```

### Cloudflare Workers

```typescript
import { TagLib } from "taglib-wasm/workers";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      try {
        // Initialize taglib-wasm with Workers-specific configuration
        // See docs/Cloudflare-Workers.md for memory configuration details
        const taglib = await TagLib.initialize({
          memory: { initial: 8 * 1024 * 1024 }, // 8MB for Workers
        });

        // Get audio data from request
        const audioData = new Uint8Array(await request.arrayBuffer());
        const file = await taglib.open(audioData); // Workers require buffer

        // Read metadata
        const tags = file.tag();
        const props = file.audioProperties();

        // Extract metadata
        const metadata = {
          title: tags.title,
          artist: tags.artist,
          album: tags.album,
          year: tags.year,
          genre: tags.genre,
          duration: props.length,
          bitrate: props.bitrate,
          format: file.format(),
        };

        // Clean up
        file.dispose();

        return Response.json({
          success: true,
          metadata,
          fileSize: audioData.length,
        });
      } catch (error) {
        return Response.json({
          error: "Failed to process audio file",
          message: (error as Error).message,
        }, { status: 500 });
      }
    }

    return new Response("Send POST request with audio file", { status: 400 });
  },
};
```

## 🛡️ Error Handling

taglib-wasm provides detailed error messages with context to help you debug
issues quickly. All errors extend from `TagLibError` and include specific error
codes for programmatic handling.

```typescript
import { InvalidFormatError, isTagLibError } from "taglib-wasm";

try {
  const file = await taglib.open("song.mp3");
  // Process file...
} catch (error) {
  if (error instanceof InvalidFormatError) {
    console.error("Invalid audio file:", error.message);
  } else if (isTagLibError(error)) {
    console.error("TagLib error:", error.code, error.message);
  }
}
```

**📖 See [docs/Error-Handling.md](docs/Error-Handling.md) for complete error
type reference and handling strategies**

## 📋 Supported Formats

`tag-wasm` is designed to support all formats supported by TagLib:

- ✅ **.m4a (.mp4)** – Standard MPEG-4/AAC metadata for AAC and Apple Lossless
  audio
- ✅ **.mp3** – ID3v2 and ID3v1 tags
- ✅ **.flac** – Vorbis comments and audio properties
- ✅ **.wav** – INFO chunk metadata
- ✅ **Legacy formats** – Opus, APE, MPC, WavPack, TrueAudio, and more

## 🎯 Extended Metadata with PropertyMap

`taglib-wasm` provides a **PropertyMap API** for accessing extended metadata
beyond the basic tags. This allows you to read and write format-specific fields
and custom metadata.

### AcoustID example

```typescript
import { Tags } from "taglib-wasm";

// Using PropertyMap API to set extended metadata with tag constants
file.setProperty(
  Tags.AcoustidFingerprint,
  "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...",
);
file.setProperty(Tags.AcoustidId, "e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Or using string property names
file.setProperty("ACOUSTID_FINGERPRINT", "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");

// Note: Property keys may vary by format
// Use file.properties() to see all available properties
file.save(); // Don't forget to save!
```

### MusicBrainz example

```typescript
// MusicBrainz metadata using PropertyMap with tag constants
file.setProperty(
  Tags.MusicBrainzTrackId,
  "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
);
file.setProperty(
  Tags.MusicBrainzAlbumId,
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
);
file.setProperty(
  Tags.MusicBrainzArtistId,
  "12345678-90ab-cdef-1234-567890abcdef",
);
```

### Volume example

```typescript
// ReplayGain volume normalization with tag constants
file.setProperty(Tags.TrackGain, "-6.54 dB");
file.setProperty(Tags.TrackPeak, "0.987654");
file.setProperty(Tags.AlbumGain, "-8.12 dB");
file.setProperty(Tags.AlbumPeak, "0.995432");
```

### Extended fields

```typescript
// Using PropertyMap to set multiple properties at once
const properties = file.properties(); // Get current properties

// Set extended metadata with tag constants
file.setProperties({
  [Tags.AlbumArtist]: ["Various Artists"],
  [Tags.Composer]: ["Composer Name"],
  [Tags.Bpm]: ["120"],
  [Tags.Compilation]: ["1"],
  [Tags.DiscNumber]: ["1"],
  [Tags.TrackTotal]: ["12"],
  // Note: Property keys vary by format
});

// Or set individual properties
file.setProperty(Tags.AlbumArtist, "Various Artists");
file.setProperty(Tags.Composer, "Composer Name");
```

## 🏗️ Development

### Build from Source

```bash
# Prerequisites: Emscripten SDK
# Install via: https://emscripten.org/docs/getting_started/downloads.html

# Clone and build
git clone <repository>
cd taglib-wasm

# Build Wasm module
deno task build:wasm

# Run tests
deno task test
```

### Project Structure

```text
src/
├── mod.ts          # Main module exports
├── taglib.ts       # Core TagLib and AudioFile classes
├── types.ts        # TypeScript type definitions
└── wasm.ts         # Wasm module interface and utilities

build/
├── build-wasm.sh   # Complete build script with C++ wrapper
├── taglib.js       # Generated Emscripten JavaScript
└── taglib.wasm     # Compiled WebAssembly module

tests/              # Test suite and sample audio files
examples/           # Usage examples for different runtimes
├── deno/           # Deno-specific examples
├── bun/            # Bun-specific examples
├── basic-usage.ts  # General usage example
└── *.ts            # Advanced feature examples
```

## 🧪 Testing

Comprehensive test suite validates all functionality:

```bash
# Run with Deno
deno run --allow-read test-systematic.ts

# Run with Bun
bun run test-systematic.ts

# Run with Node.js
npm test

# Results: All formats working ✅ across all runtimes
# ✅ WAV  - INFO chunk metadata support
# ✅ MP3  - ID3v1/v2 tag support
# ✅ FLAC - Vorbis comments and properties
# ✅ OGG  - Vorbis comments
# ✅ M4A  - MPEG-4 (AAC and Apple Lossless) metadata
```

## 🔧 Technical Implementation

### Key architecture decisions

- **[Emscripten Embind](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html)**
  – Uses Embind for direct C++ class bindings instead of a C/C++ wrapper
- **Memory Management** – Uses Emscripten's `allocate()` for reliable JS↔Wasm
  data transfer
- **Buffer-Based Processing** – `TagLib::ByteVectorStream` enables in-memory
  file processing
- **Type Safety** – Complete TypeScript definitions for all audio formats and
  metadata

### Why Emscripten Embind over C++ wrapper?

#### Traditional C/C++ wrapper approach

- Manual memory management for every string/array transfer
- Explicit conversion functions for each data type
- Flattened API losing object-oriented structure
- More error-prone pointer manipulation

#### Emscripten Embind

- Automatic memory management with smart pointers
- Direct class method exposure maintaining TagLib's design
- Built-in UTF-8 string handling
- Cleaner, more maintainable codebase

### Critical implementation details

- **ByteVectorStream** – Enables processing audio files from memory buffers
  without filesystem
- **Embind Class Bindings** – Direct exposure of TagLib C++ classes to
  JavaScript
- **Emscripten allocate()** – Ensures proper memory synchronization between JS
  and Wasm
- **UTF-8 String Handling** – Automatic encoding via Embind's std::string
  support

## 📚 API Reference

Complete API documentation is available in the
[**API Reference Guide**](docs/API-Reference.md), which covers:

- **TagLib class** – Main entry point and initialization
- **AudioFile class** – File operations and metadata access
- **Tag interface** – Basic metadata getters and setters
- **Simple API** – Convenience functions for common operations
- **PropertyMap** – Extended metadata access
- **Type definitions** – All TypeScript types and interfaces

See the [**API Reference Guide**](docs/API-Reference.md) for detailed method
signatures, parameters, and examples.

## 📖 Additional Documentation

- [**API Reference**](docs/API-Reference.md) – Complete API documentation with
  method signatures and examples
- [**Error Handling Guide**](docs/Error-Handling.md) – Complete error type
  reference and handling strategies
- [**Tag Name Constants**](docs/Tag-Name-Constants.md) – Comprehensive reference
  for standard tag names and cross-format mapping
- [**Automatic Tag Mapping**](docs/Automatic-Tag-Mapping.md) – How taglib-wasm
  handles format-specific tag differences
- [**Implementation Details**](docs/Implementation.md) – Technical details about
  the Wasm implementation
- [**Runtime Compatibility**](docs/Runtime-Compatibility.md) – Platform-specific
  setup and considerations

## 🌐 Runtime Compatibility

`taglib-wasm` works across all major JavaScript runtimes:

| Runtime     | Status  | Installation              | Performance | TypeScript |
| ----------- | ------- | ------------------------- | ----------- | ---------- |
| **Deno**    | ✅ Full | `npm:taglib-wasm`         | Excellent   | Native     |
| **Bun**     | ✅ Full | `bun add taglib-wasm`     | Excellent   | Native     |
| **Node.js** | ✅ Full | `npm install taglib-wasm` | Good        | Native/tsx |
| **Browser** | ✅ Full | CDN/bundler               | Good        | Via build  |

**📖 See [docs/Runtime-Compatibility.md](docs/Runtime-Compatibility.md) for
detailed runtime information**

## 🚧 Known Limitations

- **Memory Usage** – Entire file must be loaded into memory (may be an issue for
  very large files)
- **Concurrent Access** – Not thread-safe (JavaScript single-threaded nature
  mitigates this)
- **Cloudflare Workers** – Limited to 128MB memory per request; files larger
  than ~100MB may fail

## 🤝 Contributing

Contributions welcome.

## 📄 License

This project uses dual licensing:

- **TypeScript/JavaScript code**: MIT License (see [LICENSE](LICENSE))
- **WebAssembly binary (taglib.wasm)**: LGPL-2.1-or-later (inherited from
  TagLib)

The TagLib library is dual-licensed under LGPL/MPL. When compiled to
WebAssembly, the resulting binary must comply with LGPL requirements. This
means:

- You can use taglib-wasm in commercial projects
- If you modify the TagLib C++ code, you must share those changes
- You must provide a way for users to relink with a modified TagLib

For details, see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL)

## 🙏 Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
