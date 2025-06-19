# taglib-wasm API Reference

Complete API documentation for taglib-wasm, a WebAssembly port of TagLib for
JavaScript/TypeScript.

## Table of Contents

- [Simple API](#simple-api)
  - [readTags()](#readtags)
  - [applyTags()](#applytags)
  - [updateTags()](#updatetags)
  - [readProperties()](#readproperties)
- [Full API](#full-api)
  - [TagLib Class](#taglib-class)
  - [AudioFile Class](#audiofile-class)
  - [Types and Interfaces](#types-and-interfaces)
- [Workers API](#workers-api)
- [Error Handling](#error-handling)
- [Memory Management](#memory-management)

## Simple API

The Simple API provides the easiest way to read and write audio metadata. All
functions accept file paths (string), buffers (Uint8Array), ArrayBuffers, or
File objects.

### readTags()

Read metadata tags from an audio file.

```typescript
function readTags(
  input: string | Uint8Array | ArrayBuffer | File,
): Promise<Tag>;
```

#### Parameters

- `input`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to a `Tag` object:

```typescript
interface Tag {
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
// From file path (Node.js/Deno/Bun only)
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist);

// From buffer
const buffer = await Deno.readFile("song.mp3");
const tags = await readTags(buffer);

// From ArrayBuffer
const arrayBuffer = await fetch("song.mp3").then((r) => r.arrayBuffer());
const tags = await readTags(arrayBuffer);

// From File object (browsers)
const file = document.getElementById("file-input").files[0];
const tags = await readTags(file);
```

### applyTags()

Apply metadata tags to an audio file and return the modified buffer.

```typescript
function applyTags(
  input: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<Tags>,
  options?: number,
): Promise<Uint8Array>;
```

#### Parameters

- `input`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object
- `tags`: Object containing tags to apply (partial update supported, type
  `Partial<Tag>`)
- `options`: Write options (optional, for go-taglib compatibility)

#### Returns

Promise resolving to the modified audio file as Uint8Array.

#### Example

```typescript
// Update specific tags from file path
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});

// Write the modified file
await Deno.writeFile("song-updated.mp3", modifiedBuffer);

// From File object (browsers)
const file = document.getElementById("file-input").files[0];
const modifiedBuffer = await applyTags(file, {
  title: "New Title",
  artist: "New Artist",
});
```

### updateTags()

Update metadata tags in an audio file and save changes to disk.

```typescript
function updateTags(
  file: string,
  tags: Partial<Tags>,
  options?: number,
): Promise<void>;
```

#### Parameters

- `file`: File path as a string (required for disk operations)
- `tags`: Object containing tags to update (partial update supported, type
  `Partial<Tag>`)
- `options`: Write options (optional, for go-taglib compatibility)

#### Returns

Promise that resolves when the file has been successfully updated on disk.

#### Example

```typescript
// Update tags in place
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});
// File on disk now has updated tags

// Update only specific tags
await updateTags("song.mp3", {
  genre: "Electronic",
});
```

### readProperties()

Read audio properties from a file.

```typescript
function readProperties(
  input: string | Uint8Array | ArrayBuffer | File,
): Promise<AudioProperties>;
```

#### Parameters

- `input`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to an `AudioProperties` object:

```typescript
interface AudioProperties {
  length: number; // Duration in seconds
  bitrate: number; // Bitrate in kbps
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels (1=mono, 2=stereo)
  codec?: string; // Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM", "Vorbis")
  isLossless?: boolean; // True for lossless/uncompressed formats
  bitsPerSample?: number; // Bit depth (e.g., 16, 24)
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

## Full API

The Full API provides full control over audio metadata with advanced features.

### TagLib Class

Main entry point for the Full API.

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
    initial?: number; // Initial memory size in bytes (default: 16MB)
    maximum?: number; // Maximum memory size in bytes (default: 256MB)
  };
  debug?: boolean; // Enable debug output (default: false)
}
```

##### Example

```typescript
// Default initialization
const taglib = await TagLib.initialize();

// Custom memory configuration
const taglib = await TagLib.initialize({
  memory: {
    initial: 8 * 1024 * 1024, // 8MB
    maximum: 128 * 1024 * 1024, // 128MB
  },
  debug: true,
});
```

#### taglib.open()

Open an audio file from various input sources.

```typescript
open(input: string | ArrayBuffer | Uint8Array | File): Promise<AudioFile>
```

##### Parameters

- `input`: File path (string), audio data (ArrayBuffer/Uint8Array), or File
  object

##### Returns

Promise resolving to an `AudioFile` instance.

##### Throws

- Error if the file format is not supported or the file is corrupted

##### Example

```typescript
// From file path (Node.js/Deno/Bun only)
const file = await taglib.open("song.mp3");

// From buffer
const audioData = await Deno.readFile("song.mp3");
const file = await taglib.open(audioData);

// From ArrayBuffer
const arrayBuffer = await fetch("song.mp3").then((r) => r.arrayBuffer());
const file = await taglib.open(arrayBuffer);

// From File object (browsers)
const fileInput = document.getElementById("file-input").files[0];
const file = await taglib.open(fileInput);
```

#### taglib.openFile()

Open an audio file from a buffer (legacy method, use `open()` instead).

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

#### taglib.updateFile()

Update tags on a file and save it to a new location.

```typescript
updateFile(inputPath: string, outputPath: string, tags: Partial<Tags>): Promise<void>
```

##### Parameters

- `inputPath`: Path to the input audio file
- `outputPath`: Path where the modified file will be saved
- `tags`: Tags to update (partial update supported)

##### Example

```typescript
await taglib.updateFile("song.mp3", "song-updated.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

#### taglib.copyWithTags()

Create a copy of a file with updated tags.

```typescript
copyWithTags(inputPath: string, outputPath: string, tags: Partial<Tags>): Promise<void>
```

##### Parameters

- `inputPath`: Path to the source audio file
- `outputPath`: Path where the copy will be saved
- `tags`: Tags to set on the copy

##### Example

```typescript
await taglib.copyWithTags("original.mp3", "copy.mp3", {
  title: "Copy of Original",
  comment: "This is a copy",
});
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

##### getFormat()

Get the audio format of the file.

```typescript
getFormat(): string
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
  length: number; // Duration in seconds
  bitrate: number; // Bitrate in kbps
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels
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

**Note**: This modifies the in-memory representation only. To persist changes,
you need to write the buffer to disk or use `saveToFile()`.

##### saveToFile()

Save the modified audio file directly to disk.

```typescript
saveToFile(path: string): Promise<void>
```

##### Parameters

- `path`: File path where the audio file will be saved

##### Example

```typescript
const file = await taglib.open("song.mp3");
file.setTitle("New Title");
file.setArtist("New Artist");
await file.saveToFile("song-updated.mp3");
file.dispose();
```

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

**Important**: Always call `dispose()` when done with a file to prevent memory
leaks.

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
    initial: 8 * 1024 * 1024, // 8MB (Workers limit)
  },
});
```

The Workers API is identical to the Full API but with optimizations for the
Workers runtime environment.

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

## Tag Constants

taglib-wasm provides type-safe tag constants for better IDE support and code
readability:

### Using Tag Constants

```typescript
import { Tags } from "taglib-wasm";

// Read properties using constants
const properties = file.properties();
const title = properties[Tags.Title]?.[0];
const albumArtist = properties[Tags.AlbumArtist]?.[0];
const musicBrainzId = properties[Tags.MusicBrainzArtistId]?.[0];

// Write properties using constants
file.setProperties({
  [Tags.Title]: ["My Song"],
  [Tags.AlbumArtist]: ["Various Artists"],
  [Tags.Bpm]: ["128"],
  [Tags.MusicBrainzTrackId]: ["12345678-90ab-cdef-1234-567890abcdef"],
});
```

### Tag Validation

```typescript
import { getAllTagNames, isValidTagName } from "taglib-wasm";

// Check if a tag name is valid
isValidTagName("TITLE"); // true
isValidTagName("INVALID_TAG"); // false

// Get all available tag names
const allTags = getAllTagNames();
console.log(`Available tags: ${allTags.length}`);
```

### Available Constants

The `Tags` object provides constants for all standard tag names:

- **Basic Tags**: `Title`, `Artist`, `Album`, `Date`, `Genre`, `Comment`,
  `TrackNumber`
- **Extended Tags**: `AlbumArtist`, `Composer`, `Bpm`, `Copyright`, `Performer`
- **MusicBrainz**: `MusicBrainzArtistId`, `MusicBrainzAlbumId`,
  `MusicBrainzTrackId`
- **ReplayGain**: `TrackGain`, `TrackPeak`, `AlbumGain`, `AlbumPeak`
- **Sorting**: `TitleSort`, `ArtistSort`, `AlbumSort`, `AlbumArtistSort`
- And many more...

See [Tag Name Constants](Tag-Name-Constants.md) for the complete reference.

## Memory Management

### Automatic Cleanup

The Simple API automatically manages memory:

```typescript
// Memory is automatically cleaned up
const tags = await readTags("song.mp3");
```

### Manual Cleanup (Full API)

With the Full API, you must manually dispose of files:

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
    initial: 32 * 1024 * 1024, // 32MB
    maximum: 256 * 1024 * 1024, // 256MB
  },
});

// Cloudflare Workers (strict limits)
const taglib = await TagLib.initialize({
  memory: { initial: 8 * 1024 * 1024 }, // 8MB
});
```

### Memory Usage Guidelines

- Base overhead: ~2-4MB for Wasm module
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
    // Open file directly from path
    const file = await taglib.open(filePath);

    // Validate
    if (!file.isValid()) {
      throw new Error("Invalid audio file");
    }

    // Read current metadata
    console.log("Current tags:", file.tag());
    console.log("Format:", file.getFormat());
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

    // Save changes to a new file
    const outputPath = filePath.replace(/\.(\w+)$/, "-modified.$1");
    await file.saveToFile(outputPath);
    console.log("Saved to:", outputPath);

    // Clean up
    file.dispose();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Usage
await processAudioFile("song.mp3");

// Alternative: Using the simple API
import { updateTags } from "taglib-wasm/simple";

await updateTags("song.mp3", "song-modified.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
  year: 2024,
});
```
