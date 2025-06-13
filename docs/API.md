# taglib-wasm API Reference

Complete API documentation for taglib-wasm, a WebAssembly port of TagLib for JavaScript/TypeScript.

## Table of Contents

- [Simple API](#simple-api)
  - [readTags()](#readtags)
  - [writeTags()](#writetags)
  - [readProperties()](#readproperties)
- [Core API](#core-api)
  - [TagLib Class](#taglib-class)
  - [AudioFile Class](#audiofile-class)
  - [Types and Interfaces](#types-and-interfaces)
- [Workers API](#workers-api)
- [Error Handling](#error-handling)
- [Memory Management](#memory-management)

## Simple API

The Simple API provides the easiest way to read and write audio metadata. All functions accept either a file path (string) or a buffer (Uint8Array).

### readTags()

Read metadata tags from an audio file.

```typescript
function readTags(input: string | Uint8Array): Promise<Tags>
```

#### Parameters

- `input`: File path (string) or audio data (Uint8Array)

#### Returns

Promise resolving to a `Tags` object:

```typescript
interface Tags {
  title?: string;
  artist?: string;
  album?: string;
  comment?: string;
  genre?: string;
  year?: number;
  track?: number;
}
```

#### Example

```typescript
// From file path
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist);

// From buffer
const buffer = await Deno.readFile("song.mp3");
const tags = await readTags(buffer);
```

### writeTags()

Write metadata tags to an audio file.

```typescript
function writeTags(
  input: string | Uint8Array,
  tags: Partial<Tags>
): Promise<Uint8Array>
```

#### Parameters

- `input`: File path (string) or audio data (Uint8Array)
- `tags`: Object containing tags to write (partial update supported)

#### Returns

Promise resolving to the modified audio file as Uint8Array.

#### Example

```typescript
// Update specific tags
const modifiedFile = await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});

// Write the modified file
await Deno.writeFile("song-updated.mp3", modifiedFile);
```

### readProperties()

Read audio properties from a file.

```typescript
function readProperties(input: string | Uint8Array): Promise<Properties>
```

#### Parameters

- `input`: File path (string) or audio data (Uint8Array)

#### Returns

Promise resolving to a `Properties` object:

```typescript
interface Properties {
  length: number;      // Duration in seconds
  bitrate: number;     // Bitrate in kbps
  sampleRate: number;  // Sample rate in Hz
  channels: number;    // Number of channels (1=mono, 2=stereo)
}
```

#### Example

```typescript
const props = await readProperties("song.mp3");
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Sample rate: ${props.sampleRate} Hz`);
console.log(`Channels: ${props.channels}`);
```

## Core API

The Core API provides full control over audio metadata with advanced features.

### TagLib Class

Main entry point for the Core API.

#### TagLib.initialize()

Initialize the TagLib WebAssembly module.

```typescript
static async initialize(config?: TagLibConfig): Promise<TagLib>
```

##### Parameters

- `config` (optional): Configuration options

```typescript
interface TagLibConfig {
  memory?: {
    initial?: number;  // Initial memory size in bytes (default: 16MB)
    maximum?: number;  // Maximum memory size in bytes (default: 256MB)
  };
  debug?: boolean;     // Enable debug output (default: false)
}
```

##### Example

```typescript
// Default initialization
const taglib = await TagLib.initialize();

// Custom memory configuration
const taglib = await TagLib.initialize({
  memory: {
    initial: 8 * 1024 * 1024,   // 8MB
    maximum: 128 * 1024 * 1024, // 128MB
  },
  debug: true,
});
```

#### taglib.openFile()

Open an audio file from a buffer.

```typescript
openFile(buffer: Uint8Array): AudioFile
```

##### Parameters

- `buffer`: Audio file data as Uint8Array

##### Returns

An `AudioFile` instance.

##### Throws

- Error if the file format is not supported or the file is corrupted

##### Example

```typescript
const audioData = await Deno.readFile("song.mp3");
const file = taglib.openFile(audioData);
```

#### taglib.getModule()

Get the underlying Emscripten module (advanced usage).

```typescript
getModule(): TagLibModule
```

### AudioFile Class

Represents an open audio file with methods to read and write metadata.

#### Validation Methods

##### isValid()

Check if the file was loaded successfully.

```typescript
isValid(): boolean
```

##### format()

Get the audio format of the file.

```typescript
format(): string
```

Returns one of: `"MP3"`, `"MP4"`, `"FLAC"`, `"OGG"`, `"WAV"`, `"UNKNOWN"`

#### Property Methods

##### audioProperties()

Get audio properties.

```typescript
audioProperties(): AudioProperties
```

Returns:

```typescript
interface AudioProperties {
  length: number;      // Duration in seconds
  bitrate: number;     // Bitrate in kbps
  sampleRate: number;  // Sample rate in Hz
  channels: number;    // Number of channels
}
```

##### tag()

Get all basic tags.

```typescript
tag(): TagData
```

Returns:

```typescript
interface TagData {
  title: string;
  artist: string;
  album: string;
  comment: string;
  genre: string;
  year: number;
  track: number;
}
```

#### Basic Tag Writing Methods

```typescript
setTitle(title: string): void
setArtist(artist: string): void
setAlbum(album: string): void
setComment(comment: string): void
setGenre(genre: string): void
setYear(year: number): void
setTrack(track: number): void
```

#### Extended Tag Methods

##### extendedTag()

Get extended metadata fields.

```typescript
extendedTag(): ExtendedTag
```

Returns:

```typescript
interface ExtendedTag {
  albumArtist?: string;
  composer?: string;
  copyright?: string;
  encodedBy?: string;
  originalArtist?: string;
  bpm?: number;
  compilation?: boolean;
  discNumber?: number;
  totalDiscs?: number;
  totalTracks?: number;
  replayGainTrackGain?: string;
  replayGainTrackPeak?: string;
  replayGainAlbumGain?: string;
  replayGainAlbumPeak?: string;
  appleSoundCheck?: string;
}
```

##### setExtendedTag()

Set extended metadata fields.

```typescript
setExtendedTag(tag: Partial<ExtendedTag>): void
```

#### AcoustID Integration

```typescript
// Fingerprint methods
setAcoustidFingerprint(fingerprint: string): void
getAcoustidFingerprint(): string | undefined

// ID methods
setAcoustidId(id: string): void
getAcoustidId(): string | undefined
```

#### MusicBrainz Integration

```typescript
// Track ID
setMusicBrainzTrackId(id: string): void
getMusicBrainzTrackId(): string | undefined

// Release ID
setMusicBrainzReleaseId(id: string): void
getMusicBrainzReleaseId(): string | undefined

// Artist ID
setMusicBrainzArtistId(id: string): void
getMusicBrainzArtistId(): string | undefined

// Album ID
setMusicBrainzAlbumId(id: string): void
getMusicBrainzAlbumId(): string | undefined

// Album Artist ID
setMusicBrainzAlbumArtistId(id: string): void
getMusicBrainzAlbumArtistId(): string | undefined

// Release Group ID
setMusicBrainzReleaseGroupId(id: string): void
getMusicBrainzReleaseGroupId(): string | undefined

// Work ID
setMusicBrainzWorkId(id: string): void
getMusicBrainzWorkId(): string | undefined
```

#### Volume Normalization

##### ReplayGain

```typescript
// Track gain/peak
setReplayGainTrackGain(gain: string): void
getReplayGainTrackGain(): string | undefined
setReplayGainTrackPeak(peak: string): void
getReplayGainTrackPeak(): string | undefined

// Album gain/peak
setReplayGainAlbumGain(gain: string): void
getReplayGainAlbumGain(): string | undefined
setReplayGainAlbumPeak(peak: string): void
getReplayGainAlbumPeak(): string | undefined
```

##### Apple Sound Check

```typescript
setAppleSoundCheck(iTunNORM: string): void
getAppleSoundCheck(): string | undefined
```

#### File Operations

##### save()

Save changes back to the in-memory buffer.

```typescript
save(): boolean
```

Returns `true` if successful, `false` otherwise.

**Note**: This modifies the in-memory representation only. To persist changes, you need to write the buffer to disk.

##### toBuffer()

Get the current file data as a buffer.

```typescript
toBuffer(): Uint8Array
```

Returns the complete audio file with any modifications.

##### dispose()

Clean up resources and free memory.

```typescript
dispose(): void
```

**Important**: Always call `dispose()` when done with a file to prevent memory leaks.

### Types and Interfaces

#### AudioFormat

```typescript
type AudioFormat = "MP3" | "MP4" | "FLAC" | "OGG" | "WAV" | "UNKNOWN";
```

#### TagLibModule

The Emscripten module interface (advanced usage):

```typescript
interface TagLibModule {
  HEAPU8: Uint8Array;
  allocate(buffer: ArrayBufferView, allocator: number): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number): string;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  lengthBytesUTF8(str: string): number;
  // ... additional internal methods
}
```

## Workers API

Special API for Cloudflare Workers compatibility.

```typescript
import { TagLib } from "taglib-wasm/workers";

// Initialize with Workers-specific config
const taglib = await TagLib.initialize({
  memory: {
    initial: 8 * 1024 * 1024,  // 8MB (Workers limit)
  },
});
```

The Workers API is identical to the Core API but with optimizations for the Workers runtime environment.

## Error Handling

### Common Errors

#### UnsupportedFormatError

Thrown when attempting to open an unsupported file format.

```typescript
try {
  const file = taglib.openFile(buffer);
} catch (error) {
  if (error.message.includes("Unsupported format")) {
    console.error("File format not supported");
  }
}
```

#### InvalidFileError

Thrown when the file is corrupted or invalid.

```typescript
const file = taglib.openFile(buffer);
if (!file.isValid()) {
  throw new Error("Invalid or corrupted file");
}
```

#### MemoryError

Thrown when memory allocation fails.

```typescript
try {
  const taglib = await TagLib.initialize({
    memory: { initial: 1024 }, // Too small
  });
} catch (error) {
  console.error("Failed to allocate memory:", error);
}
```

### Best Practices

1. **Always check file validity**:
   ```typescript
   const file = taglib.openFile(buffer);
   if (!file.isValid()) {
     throw new Error("Invalid file");
   }
   ```

2. **Handle save failures**:
   ```typescript
   if (!file.save()) {
     console.error("Failed to save changes");
   }
   ```

3. **Use try-catch for file operations**:
   ```typescript
   try {
     const file = taglib.openFile(buffer);
     // ... operations
     file.dispose();
   } catch (error) {
     console.error("Error processing file:", error);
   }
   ```

## Memory Management

### Automatic Cleanup

The Simple API automatically manages memory:

```typescript
// Memory is automatically cleaned up
const tags = await readTags("song.mp3");
```

### Manual Cleanup (Core API)

With the Core API, you must manually dispose of files:

```typescript
const file = taglib.openFile(buffer);
try {
  // ... do work
} finally {
  file.dispose(); // Always dispose!
}
```

### Memory Configuration

Configure memory limits based on your use case:

```typescript
// Small files (< 10MB)
const taglib = await TagLib.initialize({
  memory: { initial: 16 * 1024 * 1024 }, // 16MB
});

// Large files (> 50MB)
const taglib = await TagLib.initialize({
  memory: {
    initial: 32 * 1024 * 1024,   // 32MB
    maximum: 256 * 1024 * 1024,  // 256MB
  },
});

// Cloudflare Workers (strict limits)
const taglib = await TagLib.initialize({
  memory: { initial: 8 * 1024 * 1024 }, // 8MB
});
```

### Memory Usage Guidelines

- Base overhead: ~2-4MB for WASM module
- Per-file overhead: ~2x file size (for processing)
- Recommended initial memory: 16MB for most use cases
- Maximum memory: Set based on largest expected file size × 2

### Preventing Memory Leaks

1. **Always dispose of AudioFile instances**
2. **Process files sequentially in memory-constrained environments**
3. **Monitor memory usage in long-running applications**
4. **Use the Simple API when possible (automatic cleanup)**

## Complete Example

```typescript
import { TagLib } from "taglib-wasm";

async function processAudioFile(filePath: string) {
  // Initialize TagLib
  const taglib = await TagLib.initialize();
  
  try {
    // Read file
    const buffer = await Deno.readFile(filePath);
    const file = taglib.openFile(buffer);
    
    // Validate
    if (!file.isValid()) {
      throw new Error("Invalid audio file");
    }
    
    // Read current metadata
    console.log("Current tags:", file.tag());
    console.log("Format:", file.format());
    console.log("Properties:", file.audioProperties());
    
    // Update metadata
    file.setTitle("New Title");
    file.setArtist("New Artist");
    file.setAlbum("New Album");
    file.setYear(2024);
    
    // Add extended metadata
    file.setExtendedTag({
      albumArtist: "Various Artists",
      composer: "Composer Name",
      bpm: 120,
      replayGainTrackGain: "-6.5 dB",
    });
    
    // Add identifiers
    file.setAcoustidFingerprint("AQADtMmybfGO8NCN...");
    file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
    
    // Save changes
    if (file.save()) {
      // Write modified file
      const outputPath = filePath.replace(/\.(\w+)$/, "-modified.$1");
      await Deno.writeFile(outputPath, file.toBuffer());
      console.log("Saved to:", outputPath);
    } else {
      console.error("Failed to save changes");
    }
    
    // Clean up
    file.dispose();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Usage
await processAudioFile("song.mp3");
```