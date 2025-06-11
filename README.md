# taglib-wasm

[TagLib](https://taglib.org/) is the most robust, de-facto standard for reading and editing metadata tags (Title, Album, Artist, etc.) in all popular audio formats. See [“Goals & Features”](https://taglib.org/) for the reasons TagLib is so great.

`taglib-wasm` is designed to be **TagLib for JavaScript/TypeScript** platforms — specifically Deno, Node.js, Bun, web browsers, and Cloudflare Workers. It does this by leveraging technologies including [TagLib](https://taglib.org/) itself, [Emscripten](https://emscripten.org/), and [Wasm](https://webassembly.org/) ([WebAssembly](https://webassembly.org/)).

> [!IMPORTANT]
> I’m personally using this to solve a problem for another project I’m creating, but this project is still very much a baby. You may experience tantrums at this stage of `taglib-wasm`’s development.

## Why?

In the process of building a utility to improve the metadata of my music collection, I discovered that the JavaScipt/TypeScipt ecosystem had no battle-tested audio tagging library that supports reading and writing music metadata to all popular audio formats.

[`mp3tag.js`](https://mp3tag.js.org/) is mature and active, but only supports MP3 files and ID3 tags. TagLib was an ideal choice from a maturity and capabilities point of view, but wrappers like `node-taglib` appeared to be dormant, and I wanted to avoid making users install platform-specific dependencies whenever possible.

## 🎯 Features

- **✅ Universal compatibility** – Works with Deno, Node.js, Bun, web browsers, and Cloudflare Workers
- **✅ TypeScript first** – Complete type definitions and modern API
- **✅ Full audio format support** – Supports all audio formats supported by TagLib
- **✅ Format abstraction** – `taglib-wasm` deals with how tags are read from/written to in different file formats
- **✅ Zero dependencies** – Self-contained WASM bundle
- **✅ Memory efficient** – In-memory processing without filesystem access
- **✅ Production ready** – Growing test suite helps ensure safety and reliability

## 📦 Installation

### Deno
```typescript
import { TagLib } from "jsr:@charleswiltgen/taglib-wasm";
```

### Node.js
```bash
npm install taglib-wasm
```

### Bun
```bash
bun add taglib-wasm
```

## 🚀 Quick Start

### Deno

```typescript
import { TagLib } from "jsr:@charleswiltgen/taglib-wasm";

// Initialize TagLib WASM
const taglib = await TagLib.initialize();

// Load audio file from buffer
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
file.setTitle("New Title");
file.setArtist("New Artist");
file.setAlbum("New Album");

console.log("Updated tags:", file.tag());

// Advanced metadata (format-agnostic)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");

// Clean up
file.dispose();
```

### Bun

```typescript
import { TagLib } from 'taglib-wasm';

// Initialize TagLib WASM
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
file.setTitle("New Title");
file.setArtist("New Artist");
file.setAlbum("New Album");

console.log("Updated tags:", file.tag());

// Advanced metadata (format-agnostic)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");

// Clean up
file.dispose();
```

### Node.js

```typescript
import { TagLib } from 'taglib-wasm';
import { readFile } from 'fs/promises';

// Initialize TagLib WASM
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
file.setTitle("New Title");
file.setArtist("New Artist");
file.setAlbum("New Album");

console.log("Updated tags:", file.tag());

// Advanced metadata (format-agnostic)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");

// Clean up
file.dispose();
```

### Browser

```typescript
import { TagLib } from 'taglib-wasm';

// Initialize TagLib WASM
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
file.setTitle("New Title");
file.setArtist("New Artist");
file.setAlbum("New Album");

console.log("Updated tags:", file.tag());

// Advanced metadata (format-agnostic)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");

// Clean up
file.dispose();
```

### Cloudflare Workers

```typescript
import { TagLib } from 'taglib-wasm';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST') {
      try {
        // Initialize TagLib WASM
        const taglib = await TagLib.initialize({
          memory: { initial: 8 * 1024 * 1024 } // 8MB for Workers
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
          format: file.format()
        };

        // Clean up
        file.dispose();

        return Response.json({
          success: true,
          metadata,
          fileSize: audioData.length
        });

      } catch (error) {
        return Response.json({
          error: 'Failed to process audio file',
          message: (error as Error).message
        }, { status: 500 });
      }
    }

    return new Response('Send POST request with audio file', { status: 400 });
  }
};
```

## 📋 Supported Formats

All formats are **fully tested and working**:

- ✅ **MP3** – ID3v2 and ID3v1 tags
- ✅ **MP4/M4A** – Standard MPEG (iTunes-compatible) metadata atoms
- ✅ **FLAC** – Vorbis comments and audio properties
- ✅ **OGG Vorbis** – Vorbis comments
- ✅ **WAV** – INFO chunk metadata
- 🔄 **Additional formats**: Opus, APE, MPC, WavPack, TrueAudio, and more

## 🎯 Advanced Metadata Support

TagLib WASM supports **format-agnostic tag naming** so you don’t have to worry about how the same tag is stored differently in different audio container formats.

### AcoustID example

```typescript
// Single API works for ALL formats (MP3, FLAC, OGG, MP4)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Automatically stores in format-specific locations:
// • MP3: TXXX frames with proper descriptions
// • FLAC/OGG: ACOUSTID_FINGERPRINT and ACOUSTID_ID Vorbis comments
// • MP4: ----:com.apple.iTunes:Acoustid... freeform atoms
```

### MusicBrainz example

```typescript
// Professional music database integration
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
file.setMusicBrainzReleaseId("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
file.setMusicBrainzArtistId("12345678-90ab-cdef-1234-567890abcdef");
```

### Volume example

```typescript
// ReplayGain support (automatic format mapping)
file.setReplayGainTrackGain("-6.54 dB");
file.setReplayGainTrackPeak("0.987654");
file.setReplayGainAlbumGain("-8.12 dB");
file.setReplayGainAlbumPeak("0.995432");

// Apple Sound Check support
file.setAppleSoundCheck("00000150 00000150 00000150 00000150...");
```

### Extended fields

```typescript
// Advanced metadata fields
file.setExtendedTag({
  albumArtist: "Various Artists",
  composer: "Composer Name",
  bpm: 120,
  compilation: true,
  discNumber: 1,
  totalTracks: 12,
  // Volume normalization
  replayGainTrackGain: "-6.54 dB",
  appleSoundCheck: "00000150...",
});
```

**📖 See [ADVANCED_METADATA.md](ADVANCED_METADATA.md) for complete documentation**

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

test-files/         # Sample audio files for testing
tests/              # Test suite
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

# Results: 5/5 formats working ✅ across all runtimes
# ✅ WAV  - 44.1kHz, stereo, tag reading/writing
# ✅ MP3  - 44.1kHz, stereo, ID3 tag support
# ✅ FLAC - 44.1kHz, stereo, Vorbis comments
# ✅ OGG  - 44.1kHz, stereo, Vorbis comments
# ✅ M4A  - 44.1kHz, stereo, iTunes metadata
```

## 🔧 Technical Implementation

### Key architecture decisions

1. **Memory Management**: Uses Emscripten's `allocate()` for reliable JS↔WASM data transfer
2. **Buffer-Based Processing**: `TagLib::ByteVectorStream` enables in-memory file processing
3. **C++ Wrapper**: Custom C functions bridge TagLib's C++ API to WASM exports
4. **Type Safety**: Complete TypeScript definitions for all audio formats and metadata

### Critical implementation details

- **ByteVectorStream**: Enables processing audio files from memory buffers without filesystem
- **ID-based Object Management**: C++ objects managed via integer IDs for memory safety
- **Emscripten allocate()**: Ensures proper memory synchronization between JS and WASM
- **UTF-8 String Handling**: Proper encoding for international metadata

## 📚 API Reference

### TagLib class

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib>
  openFile(buffer: Uint8Array): AudioFile
  getModule(): TagLibModule
}
```

### AudioFile class

```typescript
class AudioFile {
  // Validation
  isValid(): boolean
  format(): string

  // Properties
  audioProperties(): AudioProperties
  tag(): TagData

  // Tag Writing
  setTitle(title: string): void
  setArtist(artist: string): void
  setAlbum(album: string): void
  setComment(comment: string): void
  setGenre(genre: string): void
  setYear(year: number): void
  setTrack(track: number): void

  // File Operations
  save(): boolean
  dispose(): void

  // Advanced Metadata (Format-Agnostic)
  extendedTag(): ExtendedTag
  setExtendedTag(tag: Partial<ExtendedTag>): void

  // AcoustID Integration
  setAcoustidFingerprint(fingerprint: string): void
  getAcoustidFingerprint(): string | undefined
  setAcoustidId(id: string): void
  getAcoustidId(): string | undefined

  // MusicBrainz Integration
  setMusicBrainzTrackId(id: string): void
  getMusicBrainzTrackId(): string | undefined

  // Volume Normalization
  setReplayGainTrackGain(gain: string): void
  getReplayGainTrackGain(): string | undefined
  setReplayGainTrackPeak(peak: string): void
  getReplayGainTrackPeak(): string | undefined
  setReplayGainAlbumGain(gain: string): void
  getReplayGainAlbumGain(): string | undefined
  setReplayGainAlbumPeak(peak: string): void
  getReplayGainAlbumPeak(): string | undefined
  setAppleSoundCheck(iTunNORM: string): void
  getAppleSoundCheck(): string | undefined
}
```

## 🎛️ Configuration

```typescript
interface TagLibConfig {
  memory?: {
    initial?: number;  // Initial memory size (default: 16MB)
    maximum?: number;  // Maximum memory size (default: 256MB)
  };
  debug?: boolean;     // Enable debug output
}
```

## 🌐 Runtime Compatibility

TagLib WASM works seamlessly across all major JavaScript runtimes:

| Runtime | Status | Installation | Performance | TypeScript |
|---------|--------|--------------|-------------|------------|
| **Deno** | ✅ Full | `jsr:@charleswiltgen/taglib-wasm` | Excellent | Native |
| **Bun** | ✅ Full | `bun add taglib-wasm` | Excellent | Native |
| **Node.js** | ✅ Full | `npm install taglib-wasm` | Good | Via loader |
| **Browser** | ✅ Full | CDN/bundler | Good | Via build |

**📖 See [RUNTIME_COMPATIBILITY.md](RUNTIME_COMPATIBILITY.md) for detailed runtime information**

## 🚧 Known Limitations

- **File Writing**: Saves only affect in-memory representation (no filesystem persistence)
- **Large Files**: Memory usage scales with file size (entire file loaded into memory)
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
- **TagLib library**: LGPL/MPL dual license (see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL))

## 🙏 Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
