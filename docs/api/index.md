# TagLib-Wasm API Reference

Complete API documentation for TagLib-Wasm, a WebAssembly port of TagLib for
JavaScript/TypeScript.

## Table of Contents

- [Simple API](#simple-api)
  - [readTags()](#readtags)
  - [applyTagsToBuffer()](#applytags)
  - [writeTagsToFile()](#updatetags)
  - [readProperties()](#readproperties)
  - [Batch Processing](#batch-processing)
    - [readTagsBatch()](#readtagsbatch)
    - [readPropertiesBatch()](#readpropertiesbatch)
    - [readMetadataBatch()](#readmetadatabatch)
- [Folder API](#folder-api)
  - [scanFolder()](#scanfolder)
  - [updateFolderTags()](#updatefoldertags)
  - [findDuplicates()](#findduplicates)
  - [exportFolderMetadata()](#exportfoldermetadata)
- [Full API](#full-api)
  - [TagLib Class](#taglib-class)
    - [taglib.edit()](#taglib-edit)
    - [taglib.copyWithTags()](#taglib-copywithtags)
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

### applyTagsToBuffer()

Apply metadata tags to an audio file and return the modified buffer.

```typescript
function applyTagsToBuffer(
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
const modifiedBuffer = await applyTagsToBuffer("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});

// Write the modified file
await Deno.writeFile("song-updated.mp3", modifiedBuffer);

// From File object (browsers)
const file = document.getElementById("file-input").files[0];
const modifiedBuffer = await applyTagsToBuffer(file, {
  title: "New Title",
  artist: "New Artist",
});
```

### writeTagsToFile()

Update metadata tags in an audio file and save changes to disk.

```typescript
function writeTagsToFile(
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
await writeTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});
// File on disk now has updated tags

// Update only specific tags
await writeTagsToFile("song.mp3", {
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
  duration: number; // Duration in seconds
  bitrate: number; // Bitrate in kbps
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels (1=mono, 2=stereo)
  bitsPerSample?: number; // Bit depth (e.g., 16, 24)
  codec?: string; // Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM", "Vorbis")
  containerFormat?: string; // Container format (e.g., "MP4", "OGG", "MP3", "FLAC")
  isLossless?: boolean; // True for lossless/uncompressed formats
}
```

#### Example

```typescript
const props = await readProperties("song.mp3");
console.log(`Duration: ${props.duration}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Sample rate: ${props.sampleRate} Hz`);
console.log(`Channels: ${props.channels}`);
console.log(`Container: ${props.containerFormat}`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);

// Container vs Codec:
// - Container format: How audio data and metadata are packaged
// - Codec: How audio is compressed/encoded
//
// Examples:
// MP4 container (.m4a) can contain AAC or ALAC
// OGG container can contain Vorbis, Opus, FLAC, or Speex
// MP3 and FLAC are both container and codec
```

### Batch Processing

The Simple API includes high-performance batch processing functions for efficiently handling multiple files. These functions reuse a single TagLib instance and support configurable concurrency, providing 10-20x performance improvements over sequential processing.

#### BatchOptions

Configuration options for batch operations:

```typescript
interface BatchOptions {
  /** Number of files to process concurrently (default: 4) */
  concurrency?: number;
  /** Continue processing on errors (default: true) */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (processed: number, total: number, currentFile: string) => void;
}
```

#### BatchResult

Result structure for batch operations:

```typescript
type BatchItem<T> =
  | { status: "ok"; path: string; data: T }
  | { status: "error"; path: string; error: Error };

interface BatchResult<T> {
  /** Results for each file (check status to discriminate) */
  items: BatchItem<T>[];
  /** Total processing time in milliseconds */
  duration: number;
}
```

### readTagsBatch()

Read tags from multiple files efficiently.

```typescript
function readTagsBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options?: BatchOptions,
): Promise<BatchResult<Tag>>;
```

#### Example

```typescript
const files = ["song1.mp3", "song2.mp3", "song3.mp3"];
const result = await readTagsBatch(files, {
  concurrency: 8,
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} files processed`);
  },
});

// Process results
for (const item of result.items) {
  if (item.status === "ok") {
    console.log(`${item.path}: ${item.data.artist} - ${item.data.title}`);
  } else {
    console.error(`Failed to process ${item.path}: ${item.error.message}`);
  }
}

console.log(`Completed in ${result.duration}ms`);
```

### readPropertiesBatch()

Read audio properties from multiple files efficiently.

```typescript
function readPropertiesBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options?: BatchOptions,
): Promise<BatchResult<AudioProperties | null>>;
```

#### Example

```typescript
const result = await readPropertiesBatch(files, { concurrency: 4 });

for (const item of result.items) {
  if (item.status === "ok" && item.data) {
    console.log(
      `${item.path}: ${item.data.duration}s, ${item.data.bitrate}kbps`,
    );
  }
}
```

### readMetadataBatch()

Read tags, audio properties, cover art presence, and audio dynamics data from multiple files in a single operation. This is the most efficient method for getting complete metadata.

```typescript
function readMetadataBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options?: BatchOptions,
): Promise<
  BatchResult<{
    tags: Tag;
    properties: AudioProperties | null;
    hasCoverArt: boolean;
    dynamics?: {
      replayGainTrackGain?: string;
      replayGainTrackPeak?: string;
      replayGainAlbumGain?: string;
      replayGainAlbumPeak?: string;
      appleSoundCheck?: string;
    };
  }>
>;
```

#### Example

```typescript
const result = await readMetadataBatch(files, {
  concurrency: 8,
  onProgress: (processed, total, file) => {
    console.log(`Processing ${file}: ${processed}/${total}`);
  },
});

for (const item of result.items) {
  if (item.status === "ok") {
    console.log(`${item.path}:`);
    console.log(`  Artist: ${item.data.tags.artist}`);
    console.log(`  Title: ${item.data.tags.title}`);
    console.log(`  Duration: ${item.data.properties?.duration}s`);
    console.log(`  Bitrate: ${item.data.properties?.bitrate}kbps`);
    console.log(`  Has cover art: ${item.data.hasCoverArt}`);

    if (item.data.dynamics?.replayGainTrackGain) {
      console.log(`  ReplayGain: ${item.data.dynamics.replayGainTrackGain}`);
    }
    if (item.data.dynamics?.appleSoundCheck) {
      console.log(`  Sound Check: detected`);
    }
  }
}
```

#### Performance Comparison

For 19 audio files:

- Sequential processing: ~90 seconds (4.7s per file)
- Batch with concurrency=4: ~8 seconds (11x faster)
- Batch with concurrency=8: ~5 seconds (18x faster)

## Folder API

The Folder API provides batch operations for processing multiple audio files in
directories. This API is ideal for building music library managers, duplicate
finders, and batch metadata editors.

::: tip
The folder API requires filesystem access and is only available in Deno, Node.js, and Bun environments.
:::

### Import

```typescript
import { findDuplicates, scanFolder, updateFolderTags } from "taglib-wasm";
```

### scanFolder()

Scan a directory for audio files and read their metadata.

```typescript
function scanFolder(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<FolderScanResult>;
```

#### Example

```typescript
const result = await scanFolder("/music", {
  recursive: true,
  concurrency: 4,
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});

console.log(`Found ${result.totalFound} files`);
console.log(`Processed ${result.totalProcessed} successfully`);
```

### updateFolderTags()

Update metadata for multiple files in batch.

```typescript
function updateFolderTags(
  updates: Array<{ path: string; tags: Partial<Tag> }>,
  options?: { continueOnError?: boolean; concurrency?: number },
): Promise<{
  successful: number;
  failed: Array<{ path: string; error: Error }>;
  duration: number;
}>;
```

#### Example

```typescript
const result = await updateFolderTags([
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  { path: "/music/song2.mp3", tags: { album: "New Album" } },
]);

console.log(`Updated ${result.successful} files`);
```

### findDuplicates()

Find duplicate audio files based on metadata criteria.

```typescript
function findDuplicates(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<Map<string, AudioFileMetadata[]>>;
```

#### Example

```typescript
const duplicates = await findDuplicates("/music");
for (const [key, files] of duplicates) {
  console.log(`Found ${files.length} copies of: ${key}`);
}

// Custom criteria
const albumDuplicates = await findDuplicates("/music", {
  criteria: ["album", "artist"],
});
```

### exportFolderMetadata()

Export folder metadata to a JSON file.

```typescript
function exportFolderMetadata(
  folderPath: string,
  outputPath: string,
  options?: FolderScanOptions,
): Promise<void>;
```

For complete documentation, see the
[Folder API Reference](/api/folder-api.html).

## Full API

The Full API provides full control over audio metadata with advanced features.

### TagLib Class

Main entry point for the Full API.

#### TagLib.initialize()

Initialize the TagLib WebAssembly module.

```typescript
static async initialize(options?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  wasmUrl?: string;
  forceBufferMode?: boolean;
  forceWasmType?: "wasi" | "emscripten";
  disableOptimizations?: boolean;
}): Promise<TagLib>
```

##### Parameters

- `options` (optional): Configuration for loading the WASM module
  - `wasmBinary`: Pre-loaded WASM binary (for offline usage)
  - `wasmUrl`: Custom WASM URL
  - `forceBufferMode`: Force Emscripten backend (disable WASI auto-detection)
  - `forceWasmType`: Explicitly select `"wasi"` or `"emscripten"` backend
  - `disableOptimizations`: Disable runtime optimizations

##### Example

```typescript
// Default initialization (auto-detects best backend)
const taglib = await TagLib.initialize();

// With pre-loaded WASM binary (for offline usage)
const wasmBinary = await fetch("taglib.wasm").then((r) => r.arrayBuffer());
const taglib = await TagLib.initialize({ wasmBinary });

// With custom WASM URL
const taglib = await TagLib.initialize({ wasmUrl: "/assets/taglib.wasm" });

// Force Emscripten backend
const taglib = await TagLib.initialize({ forceBufferMode: true });
```

#### taglib.open()

Open an audio file from various input sources.

```typescript
open(input: string | ArrayBuffer | Uint8Array | File, options?: OpenOptions): Promise<AudioFile>
```

##### Parameters

- `input`: File path (string), audio data (ArrayBuffer/Uint8Array), or File
  object
- `options` (optional): Configuration for opening the file

```typescript
interface OpenOptions {
  partial?: boolean; // Enable partial loading (default: false)
  maxHeaderSize?: number; // Max header size in bytes (default: 1MB)
  maxFooterSize?: number; // Max footer size in bytes (default: 128KB)
}
```

##### Returns

Promise resolving to an `AudioFile` instance.

##### Throws

- Error if the file format is not supported or the file is corrupted

##### Example

```typescript
// From file path (Node.js/Deno/Bun only)
using file = await taglib.open("song.mp3");

// From buffer
const audioData = await Deno.readFile("song.mp3");
using file = await taglib.open(audioData);

// From ArrayBuffer
const arrayBuffer = await fetch("song.mp3").then((r) => r.arrayBuffer());
using file = await taglib.open(arrayBuffer);

// From File object (browsers)
const fileInput = document.getElementById("file-input").files[0];
using file = await taglib.open(fileInput);

// With partial loading for large files
using largeFile = await taglib.open("large-concert.flac", {
  partial: true,
  maxHeaderSize: 2 * 1024 * 1024, // 2MB
  maxFooterSize: 256 * 1024, // 256KB
});
```

#### taglib.updateFile()

Update tags in a file and save changes to disk in one operation.
This is a convenience method that opens, modifies, saves, and closes the file.

```typescript
updateFile(path: string, tags: Partial<Tag>): Promise<void>
```

##### Parameters

- `path`: File path to update
- `tags`: Object containing tags to update

##### Throws

- Error if file operations fail

##### Example

```typescript
await taglib.updateFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

#### taglib.edit()

Open, modify, and save an audio file in a single operation. The callback
receives an `AudioFile` for full access to tags, properties, and cover art.

Has two overloads depending on the input type:

**File path overload** -- edits the file in place on disk:

```typescript
edit(path: string, fn: (file: AudioFile) => void | Promise<void>): Promise<void>
```

**Buffer overload** -- returns the modified audio data:

```typescript
edit(
  input: Uint8Array | ArrayBuffer | File,
  fn: (file: AudioFile) => void | Promise<void>,
): Promise<Uint8Array>
```

##### Parameters

- `input`: File path (string) for in-place editing, or audio data
  (Uint8Array/ArrayBuffer/File) for buffer-based editing
- `fn`: Callback that receives an `AudioFile` instance. Make your modifications
  inside this callback. The file is automatically saved and disposed after the
  callback returns.

##### Returns

- **File path input**: `Promise<void>` -- changes are saved to disk
- **Buffer input**: `Promise<Uint8Array>` -- returns the modified audio data

##### Example

```typescript
// Edit a file on disk (in place)
await taglib.edit("song.mp3", (file) => {
  const tag = file.tag();
  tag.setTitle("New Title");
  tag.setArtist("New Artist");
  tag.setYear(2025);
});

// Edit a buffer and get modified data back
const audioData = await fetch("song.mp3").then((r) => r.arrayBuffer());
const modified = await taglib.edit(new Uint8Array(audioData), (file) => {
  file.tag().setTitle("Updated Title");
  file.setProperties({ ALBUMARTIST: "Various Artists" });
});
await Deno.writeFile("song-modified.mp3", modified);

// Async callbacks are supported
await taglib.edit("song.flac", async (file) => {
  const coverArt = await fetch("cover.jpg").then((r) => r.arrayBuffer());
  file.addPicture({
    mimeType: "image/jpeg",
    data: new Uint8Array(coverArt),
    type: "Cover (front)",
  });
});
```

#### taglib.copyWithTags()

Create a copy of a file with updated tags. Reads the source file, applies the
specified tags, and saves to a new destination path.

```typescript
copyWithTags(sourcePath: string, destPath: string, tags: Partial<Tag>): Promise<void>
```

##### Parameters

- `sourcePath`: Path to the source audio file
- `destPath`: Path where the copy will be saved
- `tags`: Tags to set on the copy (type `Partial<Tag>`)

##### Example

```typescript
// Create a tagged copy
await taglib.copyWithTags("original.mp3", "copy.mp3", {
  title: "Copy of Original",
  artist: "Same Artist",
  comment: "This is a copy",
});

// Transcode workflow: copy tags to a re-encoded file
await taglib.copyWithTags("master.flac", "output.mp3", {
  comment: "Converted from FLAC",
});
```

#### taglib.version()

Get the TagLib version.

```typescript
version(): string
```

Returns version string (e.g., "2.1.0")

### AudioFile Class

Represents an open audio file with methods to read and write metadata.
AudioFile implements `Symbol.dispose`, enabling automatic cleanup with the
`using` keyword:

```typescript
using file = await taglib.open("song.mp3");
// file is automatically disposed when it goes out of scope
```

#### Validation Methods

##### isValid()

Check if the file was loaded successfully.

```typescript
isValid(): boolean
```

##### getFormat()

Get the audio file format.

```typescript
getFormat(): FileType
```

Returns the detected file type:

```typescript
type FileType =
  | "MP3"
  | "MP4"
  | "FLAC"
  | "OGG"
  | "WAV"
  | "AIFF"
  | "ASF"
  | "UNKNOWN";
```

#### Property Methods

##### audioProperties()

Get audio properties (duration, bitrate, sample rate, etc.).

```typescript
audioProperties(): AudioProperties | null
```

Returns `AudioProperties` object or `null` if unavailable:

```typescript
interface AudioProperties {
  duration: number; // Duration in seconds
  bitrate: number; // Bitrate in kbps
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels
  bitsPerSample?: number; // Bits per sample (optional)
  codec?: string; // Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM")
  containerFormat?: string; // Container format (e.g., "MP4", "OGG", "MP3", "FLAC")
  isLossless?: boolean; // True for lossless/uncompressed formats
}
```

##### tag()

Get the tag object for reading/writing basic metadata.

```typescript
tag(): Tag
```

Returns a `Tag` object with getters and setters for metadata fields:

```typescript
interface Tag {
  // Read properties
  title: string;
  artist: string;
  album: string;
  comment: string;
  genre: string;
  year: number;
  track: number;

  // Write methods
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setComment(value: string): void;
  setGenre(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
}
```

##### Example

```typescript
const tag = file.tag();
console.log(tag.title); // Read
tag.setTitle("New Title"); // Write
```

#### Property Map Methods

##### properties()

Get all metadata properties as a key-value map.
Includes both standard and format-specific properties.

```typescript
properties(): PropertyMap
```

Returns:

```typescript
interface PropertyMap {
  [key: string]: string[];
}
```

##### setProperties()

Set multiple properties at once from a PropertyMap.

```typescript
setProperties(properties: PropertyMap): void
```

##### getProperty()

Get a single property value by key.

```typescript
getProperty(key: string): string | undefined
```

##### setProperty()

Set a single property value.

```typescript
setProperty(key: string, value: string): void
```

##### Example

```typescript
// Get all properties
const props = file.properties();
console.log(props.ALBUMARTIST);

// Set properties
file.setProperties({
  ALBUMARTIST: "Various Artists",
  COMPOSER: "Composer Name",
  BPM: "120",
});

// Single property access
const albumArtist = file.getProperty("ALBUMARTIST");
file.setProperty("ALBUMARTIST", "New Album Artist");
```

#### Picture/Cover Art Methods

##### getPictures()

Get all pictures/cover art from the audio file.

```typescript
getPictures(): Picture[]
```

Returns an array of `Picture` objects:

```typescript
interface Picture {
  mimeType: string;
  data: Uint8Array;
  type: string;
  description?: string;
}
```

##### setPictures()

Set pictures/cover art in the audio file (replaces all existing).

```typescript
setPictures(pictures: Picture[]): void
```

##### addPicture()

Add a single picture to the audio file.

```typescript
addPicture(picture: Picture): void
```

##### removePictures()

Remove all pictures from the audio file.

```typescript
removePictures(): void
```

##### Example

```typescript
// Get cover art
const pictures = file.getPictures();
if (pictures.length > 0) {
  console.log(`Found ${pictures.length} pictures`);
  const cover = pictures[0];
  console.log(`MIME type: ${cover.mimeType}`);
}

// Add new cover art
const imageData = await fetch("cover.jpg").then((r) => r.arrayBuffer());
file.addPicture({
  mimeType: "image/jpeg",
  data: new Uint8Array(imageData),
  type: "Cover (front)",
  description: "Album cover",
});
```

#### MP4-Specific Methods

##### isMP4()

Check if this is an MP4/M4A file.

```typescript
isMP4(): boolean
```

##### getMP4Item()

Get an MP4-specific metadata item.

```typescript
getMP4Item(key: string): string | undefined
```

##### Parameters

- `key`: MP4 atom name (e.g., "----:com.apple.iTunes:iTunNORM")

##### Throws

- Error if not an MP4 file

##### setMP4Item()

Set an MP4-specific metadata item.

```typescript
setMP4Item(key: string, value: string): void
```

##### Parameters

- `key`: MP4 atom name
- `value`: Item value

##### Throws

- Error if not an MP4 file

##### removeMP4Item()

Remove an MP4-specific metadata item.

```typescript
removeMP4Item(key: string): void
```

##### Parameters

- `key`: MP4 atom name to remove

##### Throws

- Error if not an MP4 file

##### Example

```typescript
if (file.isMP4()) {
  // Get Apple Sound Check data
  const soundCheck = file.getMP4Item("iTunNORM");

  // Set custom metadata
  file.setMP4Item("----:com.apple.iTunes:MyCustomField", "Custom Value");

  // Remove metadata
  file.removeMP4Item("----:com.apple.iTunes:UnwantedField");
}
```

#### AcoustID Integration

```typescript
// Fingerprint methods
setAcoustIdFingerprint(fingerprint: string): void
getAcoustIdFingerprint(): string | undefined

// ID methods
setAcoustIdId(id: string): void
getAcoustIdId(): string | undefined
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
saveToFile(path?: string): Promise<void>
```

##### Parameters

- `path` (optional): File path where the audio file will be saved. If not
  provided, saves to the original file path (if available).

**Smart Save for Partial Loading**: When the file was opened with partial
loading enabled, `saveToFile()` automatically loads the complete file before
saving, ensuring all audio data is preserved while applying your metadata
changes.

##### Example

```typescript
using file = await taglib.open("song.mp3");
file.setTitle("New Title");
file.setArtist("New Artist");
await file.saveToFile("song-updated.mp3");
```

##### getFileBuffer()

Get the current file data as a buffer, including any modifications.
Call this after save() to get the updated file data.

```typescript
getFileBuffer(): Uint8Array
```

Returns the complete audio file with any modifications.

##### dispose()

Clean up resources and free memory.

```typescript
dispose(): void
```

**Tip**: Prefer `using file = await taglib.open(...)` for automatic cleanup.
Call `dispose()` manually only when `using` is not available.

### Types and Interfaces

#### FileType

```typescript
type FileType =
  | "MP3"
  | "MP4"
  | "FLAC"
  | "OGG"
  | "WAV"
  | "AIFF"
  | "ASF"
  | "UNKNOWN";
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

The Full API works in Cloudflare Workers with no special configuration needed.

```typescript
import { TagLib } from "taglib-wasm";

// Initialize normally - memory is automatically configured for Workers
const taglib = await TagLib.initialize();

// Use the same API as in other environments
using file = await taglib.open(audioBuffer);
const tag = file.tag();
console.log(tag.title);
```

The WebAssembly module automatically detects the Workers environment and optimizes memory usage accordingly.

## Error Handling

### Error Types

TagLib-Wasm provides specific error types for better error handling:

#### TagLibInitializationError

Thrown when the Wasm module fails to initialize.

```typescript
import { TagLibInitializationError } from "taglib-wasm";

try {
  const taglib = await TagLib.initialize();
} catch (error) {
  if (error instanceof TagLibInitializationError) {
    console.error("Failed to initialize TagLib:", error.message);
  }
}
```

#### UnsupportedFormatError

Thrown when attempting to open an unsupported file format.

```typescript
import { SUPPORTED_FORMATS, UnsupportedFormatError } from "taglib-wasm";

try {
  using file = await taglib.open("file.xyz");
} catch (error) {
  if (error instanceof UnsupportedFormatError) {
    console.error(
      `Format not supported. Supported formats: ${
        SUPPORTED_FORMATS.join(", ")
      }`,
    );
  }
}
```

#### InvalidFormatError

Thrown when the file is corrupted or has an invalid format.

```typescript
import { InvalidFormatError } from "taglib-wasm";

try {
  using file = await taglib.open(corruptedBuffer);
} catch (error) {
  if (error instanceof InvalidFormatError) {
    console.error("File is corrupted or invalid:", error.message);
    console.error("File size:", error.details?.fileSize);
  }
}
```

#### MetadataError

Thrown when metadata operations fail.

```typescript
import { MetadataError } from "taglib-wasm";

try {
  const tag = file.tag();
} catch (error) {
  if (error instanceof MetadataError) {
    console.error("Failed to read metadata:", error.message);
  }
}
```

#### FileOperationError

Thrown when file system operations fail.

```typescript
import { FileOperationError } from "taglib-wasm";

try {
  await file.saveToFile("/readonly/path.mp3");
} catch (error) {
  if (error instanceof FileOperationError) {
    console.error("File operation failed:", error.message);
  }
}
```

### Error Checking Utilities

```typescript
import {
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
} from "taglib-wasm";

try {
  // ... taglib operations
} catch (error) {
  if (isTagLibError(error)) {
    console.error(`TagLib error [${error.code}]: ${error.message}`);
    console.error("Details:", error.details);
  }
}
```

### Best Practices

1. **Always check file validity**:
   ```typescript
   using file = await taglib.open(buffer);
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

3. **Use `using` for automatic cleanup**:
   ```typescript
   using file = await taglib.open("song.mp3");
   // ... operations
   // file is automatically disposed when it goes out of scope
   ```

4. **Wrap with try-catch for error reporting**:
   ```typescript
   try {
     using file = await taglib.open("song.mp3");
     // ... operations
   } catch (error) {
     console.error("Error processing file:", error);
   }
   ```

## Tag Constants

TagLib-Wasm provides type-safe tag constants for better IDE support and code
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

See [Tag Name Constants](/api/tag-constants) for the complete reference.

## Memory Management

### Automatic Cleanup

The Simple API automatically manages memory:

```typescript
// Memory is automatically cleaned up
const tags = await readTags("song.mp3");
```

### Automatic Cleanup (Full API)

With the Full API, use `using` for automatic cleanup:

```typescript
using file = await taglib.open("song.mp3");
// ... do work
// file is automatically disposed when it goes out of scope
```

### Memory Configuration

The WebAssembly module automatically configures memory based on your environment. For most use cases, the default configuration works well.

```typescript
// Default initialization (recommended)
const taglib = await TagLib.initialize();

// With custom WASM URL
const taglib = await TagLib.initialize({
  wasmUrl: "/custom/path/taglib.wasm",
});
```

### Memory Usage Guidelines

- Base overhead: ~2-4MB for Wasm module
- Per-file overhead: ~2x file size (for processing)
- Recommended initial memory: 16MB for most use cases
- Maximum memory: Set based on largest expected file size × 2

### Preventing Memory Leaks

1. **Use `using` for AudioFile instances (automatic disposal)**
2. **Process files sequentially in memory-constrained environments**
3. **Monitor memory usage in long-running applications**
4. **Use the Simple API when possible (automatic cleanup)**

## Complete Example

```typescript
import { TagLib } from "taglib-wasm";

async function processAudioFile(filePath: string) {
  // Initialize TagLib
  const taglib = await TagLib.initialize();

  // Open file directly from path
  using file = await taglib.open(filePath);

  // Validate
  if (!file.isValid()) {
    throw new Error("Invalid audio file");
  }

  // Read current metadata
  console.log("Current tags:", file.tag());
  console.log("Format:", file.getFormat());
  console.log("Properties:", file.audioProperties());

  // Update metadata
  const tag = file.tag();
  tag.setTitle("New Title");
  tag.setArtist("New Artist");
  tag.setAlbum("New Album");
  tag.setYear(2024);

  // Add extended metadata using properties
  file.setProperties({
    ALBUMARTIST: "Various Artists",
    COMPOSER: "Composer Name",
    BPM: "120",
    REPLAYGAIN_TRACK_GAIN: "-6.5 dB",
  });

  // Add identifiers
  file.setAcoustIdFingerprint("AQADtMmybfGO8NCN...");
  file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");

  // Save changes to a new file
  const outputPath = filePath.replace(/\.(\w+)$/, "-modified.$1");
  await file.saveToFile(outputPath);
  console.log("Saved to:", outputPath);

  // file is automatically disposed when it goes out of scope
}

// Usage
await processAudioFile("song.mp3");

// Alternative: Using the simple API
import { writeTagsToFile } from "taglib-wasm";

await writeTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
  year: 2024,
});
// File on disk now has updated tags
```
