# taglib-wasm-ts

TagLib v2.1 compiled to WebAssembly with TypeScript bindings for universal audio metadata handling.

## 🎯 Features

- **✅ Universal compatibility** - Works in browsers, Node.js, Deno, and Bun
- **✅ Full TagLib support** - All major audio formats supported by TagLib v2.1
- **✅ Advanced metadata** - Format-agnostic API for AcoustID, MusicBrainz, ReplayGain, and Apple Sound Check
- **✅ Professional audio tools** - Volume normalization, music database integration, and fingerprinting
- **✅ TypeScript first** - Complete type definitions and modern API
- **✅ Zero dependencies** - Self-contained WASM bundle
- **✅ Memory efficient** - In-memory processing without filesystem access
- **✅ Production ready** - Comprehensive test suite with 5/5 formats passing across all runtimes

## 📦 Installation

```bash
# For NPM/Node.js projects
npm install taglib-wasm-ts

# For Bun projects
bun add taglib-wasm-ts

# For Deno projects 
import { TagLib } from "jsr:@taglib/wasm-ts";
```

## 🚀 Quick Start

### Deno (Recommended)

```typescript
import { TagLib } from "./src/mod.ts";

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
import { TagLib } from 'taglib-wasm-ts';

const taglib = await TagLib.initialize();

// Load from file system (Bun's native file API)
const audioData = await Bun.file("song.mp3").arrayBuffer();
const file = taglib.openFile(new Uint8Array(audioData));

// Read/write metadata (same API as above)
const tags = file.tag();
file.setTitle("New Title");
```

### Node.js/Browser

```typescript
import { TagLib } from 'taglib-wasm-ts';

const taglib = await TagLib.initialize();
const file = taglib.openFile(audioBuffer);

// Read/write metadata (same API as above)
const tags = file.tag();
file.setTitle("New Title");
```

## 📋 Supported Formats

All formats are **fully tested and working**:

- ✅ **MP3** - ID3v1, ID3v2 tags
- ✅ **MP4/M4A** - iTunes-style metadata atoms  
- ✅ **FLAC** - Vorbis comments and audio properties
- ✅ **OGG Vorbis** - Vorbis comments
- ✅ **WAV** - INFO chunk metadata
- 🔄 **Additional formats**: Opus, APE, MPC, WavPack, TrueAudio, and more

## 🎯 Advanced Metadata Support

TagLib WASM includes a **format-agnostic metadata system** for professional audio applications:

### AcoustID Integration
```typescript
// Single API works for ALL formats (MP3, FLAC, OGG, MP4)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Automatically stores in format-specific locations:
// • MP3: TXXX frames with proper descriptions
// • FLAC/OGG: ACOUSTID_FINGERPRINT and ACOUSTID_ID Vorbis comments  
// • MP4: ----:com.apple.iTunes:Acoustid... freeform atoms
```

### MusicBrainz Integration
```typescript
// Professional music database integration
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
file.setMusicBrainzReleaseId("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
file.setMusicBrainzArtistId("12345678-90ab-cdef-1234-567890abcdef");
```

### Volume Normalization
```typescript
// ReplayGain support (automatic format mapping)
file.setReplayGainTrackGain("-6.54 dB");
file.setReplayGainTrackPeak("0.987654");
file.setReplayGainAlbumGain("-8.12 dB");
file.setReplayGainAlbumPeak("0.995432");

// Apple Sound Check support
file.setAppleSoundCheck("00000150 00000150 00000150 00000150...");
```

### Extended Fields
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
cd taglib-wasm-ts

# Build WASM module
deno task build:wasm

# Run tests
deno task test
```

### Project Structure

```
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

### Key Architecture Decisions

1. **Memory Management**: Uses Emscripten's `allocate()` for reliable JS↔WASM data transfer
2. **Buffer-Based Processing**: `TagLib::ByteVectorStream` enables in-memory file processing
3. **C++ Wrapper**: Custom C functions bridge TagLib's C++ API to WASM exports
4. **Type Safety**: Complete TypeScript definitions for all audio formats and metadata

### Critical Implementation Details

- **ByteVectorStream**: Enables processing audio files from memory buffers without filesystem
- **ID-based Object Management**: C++ objects managed via integer IDs for memory safety
- **Emscripten allocate()**: Ensures proper memory synchronization between JS and WASM
- **UTF-8 String Handling**: Proper encoding for international metadata

## 📚 API Reference

### TagLib Class

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib>
  openFile(buffer: Uint8Array): AudioFile
  getModule(): TagLibModule
}
```

### AudioFile Class

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
| **Bun** | ✅ Full | `bun add taglib-wasm-ts` | Excellent | Native |
| **Deno** | ✅ Full | `jsr:@taglib/wasm-ts` | Excellent | Native |  
| **Node.js** | ✅ Full | `npm install taglib-wasm-ts` | Good | Via loader |
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

- **This project**: MIT License - see [LICENSE](LICENSE)
- **TagLib library**: LGPL/MPL dual license - see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL)

## 🙏 Acknowledgments

- [TagLib](https://taglib.org/) - Excellent audio metadata library
- [Emscripten](https://emscripten.org/) - WebAssembly compilation toolchain
- [Deno](https://deno.com/) - Modern JavaScript/TypeScript runtime
- [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager

---

**Status**: Production Ready - Universal audio metadata handling across all JavaScript runtimes.