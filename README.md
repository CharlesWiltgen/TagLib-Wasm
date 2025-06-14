# taglib-wasm

This is the Wasm version of [**TagLib**](https://taglib.org/), the most robust,
de-facto standard for reading and editing metadata tags (Title, Album, Artist,
etc.) in all popular audio formats. `taglib-wasm` exists because the
JavaScipt/TypeScipt ecosystem had no battle-tested audio tagging library that
supports reading and writing music metadata to all popular audio formats — until
now!

`taglib-wasm` stands on the shoulders of giants, including
[TagLib](https://taglib.org/) itself, [Emscripten](https://emscripten.org/), and
[Wasm](https://webassembly.org/) ([WebAssembly](https://webassembly.org/)).

`taglib-wasm` aspires to be a universal solution for **JavaScript/TypeScript**
platforms — Deno, Node.js, Bun, web browsers, and Cloudflare Workers. Note: This
project is a baby, and you’re likely to experience some surprises at this stage
of its development. I’m extremely motivated to help address them, since I’ll
also be depending on this project.

## 🤔 Why?

Because there’s nothing like it. [`mp3tag.js`](https://mp3tag.js.org/) is mature
and active, but only supports MP3 files and ID3 tags. TagLib was an ideal choice
from a maturity and capabilities point of view, but wrappers like `node-taglib`
appeared to be dormant, and I wanted to avoid making users install
platform-specific dependencies whenever possible.

## 🎯 Features

- **✅ Universal compatibility** – Works with Deno, Node.js, Bun, web browsers,
  and Cloudflare Workers
- **✅ TypeScript first** – Complete type definitions and modern API
- **✅ Full audio format support** – Supports all audio formats supported by
  TagLib
- **✅ Format abstraction** – `taglib-wasm` deals with how tags are read
  from/written to in different file formats
- **✅ Zero dependencies** – Self-contained WASM bundle
- **✅ Memory efficient** – In-memory processing without filesystem access
- **✅ Production ready** – Growing test suite helps ensure safety and
  reliability
- **🆕 Two API styles** – Choose between Simple (3 functions) or Core (full
  control) APIs

## 📦 Installation

### Deno

```typescript
import { TagLib } from "npm:taglib-wasm";
```

### Node.js

```bash
npm install taglib-wasm
```

**Requires Node.js v22.6.0 or later** (LTS recommended)

The package ships TypeScript source files. You have two options:

**Option 1: Native TypeScript (experimental)**
```bash
# Node.js 22.6.0+ with experimental flag
node --experimental-strip-types your-script.ts

# Node.js 23.6.0+ (no flag needed)
node your-script.ts
```

**Option 2: TypeScript loader** (recommended for production)
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

Inspired by [go-taglib](https://github.com/sentriz/go-taglib)’s excellent
developer experience:

```typescript
import { readProperties, readTags, writeTags } from "taglib-wasm/simple";

// Read tags - just one function call!
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Write tags - simple as can be
await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Read audio properties
const props = await readProperties("song.mp3");
console.log(`Duration: ${props.length}s, Bitrate: ${props.bitrate} kbps`);
```

### Core API

Full control when you need it:

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file from buffer
const audioData = await readFile("song.mp3"); // Node.js/Bun: fs.readFile, Deno: Deno.readFile
const file = taglib.openFile(audioData);

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

## Platform examples

### Deno

```typescript
import { TagLib } from "npm:taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file from filesystem
const audioData = await Deno.readFile("song.mp3");
const file = taglib.openFile(audioData);

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

// Load audio file from filesystem
const audioData = await readFile("song.mp3");
const file = taglib.openFile(audioData);

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

// Load from file system (Bun's native file API)
const audioData = await Bun.file("song.mp3").arrayBuffer();
const file = taglib.openFile(new Uint8Array(audioData));

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
const file = taglib.openFile(audioData);

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
        // Initialize taglib-wasm
        const taglib = await TagLib.initialize({
          memory: { initial: 8 * 1024 * 1024 }, // 8MB for Workers
        });

        // Get audio data from request
        const audioData = new Uint8Array(await request.arrayBuffer());
        const file = taglib.openFile(audioData);

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
// Using PropertyMap API to set extended metadata
file.setProperty("ACOUSTID_FINGERPRINT", "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setProperty("ACOUSTID_ID", "e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Note: Property keys may vary by format
// Use file.properties() to see all available properties
file.save(); // Don't forget to save!
```

### MusicBrainz example

```typescript
// MusicBrainz metadata using PropertyMap
file.setProperty("MUSICBRAINZ_TRACKID", "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
file.setProperty("MUSICBRAINZ_ALBUMID", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
file.setProperty(
  "MUSICBRAINZ_ARTISTID",
  "12345678-90ab-cdef-1234-567890abcdef",
);
```

### Volume example

```typescript
// ReplayGain volume normalization
file.setProperty("REPLAYGAIN_TRACK_GAIN", "-6.54 dB");
file.setProperty("REPLAYGAIN_TRACK_PEAK", "0.987654");
file.setProperty("REPLAYGAIN_ALBUM_GAIN", "-8.12 dB");
file.setProperty("REPLAYGAIN_ALBUM_PEAK", "0.995432");
```

### Extended fields

```typescript
// Using PropertyMap to set multiple properties at once
const properties = file.properties(); // Get current properties

// Set extended metadata
file.setProperties({
  ALBUMARTIST: ["Various Artists"],
  COMPOSER: ["Composer Name"],
  BPM: ["120"],
  COMPILATION: ["1"],
  DISCNUMBER: ["1"],
  TRACKTOTAL: ["12"],
  // Note: Property keys vary by format
});

// Or set individual properties
file.setProperty("ALBUMARTIST", "Various Artists");
file.setProperty("COMPOSER", "Composer Name");
```

## 🏗️ Development

### Build from Source

```bash
# Prerequisites: Emscripten SDK
# Install via: https://emscripten.org/docs/getting_started/downloads.html

# Clone and build
git clone <repository>
cd taglib-wasm

# Build WASM module
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
└── wasm.ts         # WASM module interface and utilities

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
# ✅ M4A  - iTunes-compatible metadata atoms
```

## 🔧 Technical Implementation

### Key architecture decisions

1. **Memory Management**: Uses Emscripten's `allocate()` for reliable JS↔WASM
   data transfer
2. **Buffer-Based Processing**: `TagLib::ByteVectorStream` enables in-memory
   file processing
3. **C++ Wrapper**: Custom C functions bridge TagLib's C++ API to WASM exports
4. **Type Safety**: Complete TypeScript definitions for all audio formats and
   metadata

### Critical implementation details

- **ByteVectorStream**: Enables processing audio files from memory buffers
  without filesystem
- **ID-based Object Management**: C++ objects managed via integer IDs for memory
  safety
- **Emscripten allocate()**: Ensures proper memory synchronization between JS
  and WASM
- **UTF-8 String Handling**: Proper encoding for international metadata

## 📚 API Reference

### TagLib class

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib>;
  openFile(buffer: Uint8Array): AudioFile;
  getModule(): TagLibModule;
}
```

### AudioFile class

```typescript
class AudioFile {
  // Validation
  isValid(): boolean;
  getFormat(): string;

  // Properties
  audioProperties(): AudioProperties;

  // Tag Access (returns Tag object with getters and setters)
  tag(): Tag;

  // PropertyMap API for extended metadata
  properties(): PropertyMap;
  setProperties(properties: PropertyMap): void;
  getProperty(key: string): string | undefined;
  setProperty(key: string, value: string): void;

  // MP4-specific methods
  isMP4(): boolean;
  getMP4Item(key: string): string | undefined;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;

  // File Operations
  save(): boolean;
  getFileBuffer(): Uint8Array;
  dispose(): void;
}
```

### Tag interface

```typescript
interface Tag {
  // Basic metadata (getters)
  title: string;
  artist: string;
  album: string;
  comment: string;
  genre: string;
  year: number;
  track: number;

  // Setters
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setComment(value: string): void;
  setGenre(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
}
```

### PropertyMap type

```typescript
type PropertyMap = { [key: string]: string[] };
```

## 🎛️ Configuration

```typescript
interface TagLibConfig {
  memory?: {
    initial?: number; // Initial memory size (default: 16MB)
    maximum?: number; // Maximum memory size (default: 256MB)
  };
  debug?: boolean; // Enable debug output
}
```

## 🌐 Runtime Compatibility

`taglib-wasm` works seamlessly across all major JavaScript runtimes:

| Runtime     | Status  | Installation              | Performance | TypeScript |
| ----------- | ------- | ------------------------- | ----------- | ---------- |
| **Deno**    | ✅ Full | `npm:taglib-wasm`         | Excellent   | Native     |
| **Bun**     | ✅ Full | `bun add taglib-wasm`     | Excellent   | Native     |
| **Node.js** | ✅ Full | `npm install taglib-wasm` | Good        | Native/tsx |
| **Browser** | ✅ Full | CDN/bundler               | Good        | Via build  |

**📖 See [docs/Runtime-Compatibility.md](docs/Runtime-Compatibility.md) for
detailed runtime information**

## 🚧 Known Limitations

- **File Writing**: Saves only affect in-memory representation (no filesystem
  persistence)
- **Large Files**: Memory usage scales with file size (entire file loaded into
  memory)
- **Concurrent Access**: Not thread-safe (JavaScript single-threaded nature)

## 🤝 Contributing

Contributions welcome! Areas of interest:

- Additional format support (DSF, DSDIFF, etc.)
- Advanced metadata implementation (PropertyMap integration)
- Performance optimizations
- Runtime-specific optimizations
- Documentation improvements

## 📄 License

- **This project**: MIT License (see [LICENSE](LICENSE))
- **TagLib library**: LGPL/MPL dual license (see
  [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL))

## 🙏 Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
