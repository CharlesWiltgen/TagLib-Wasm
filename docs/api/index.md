# TagLib-Wasm API Reference

Complete API documentation for TagLib-Wasm, a WebAssembly port of TagLib for
JavaScript/TypeScript.

## Table of Contents

- [Simple API](#simple-api)
  - [readTags()](#readtags)
  - [applyTags()](#applytags)
  - [applyTagsToFile()](#applytagstofile)
  - [readProperties()](#readproperties)
  - [clearTags()](#cleartags)
  - [readFormat()](#readformat)
  - [isValidAudioFile()](#isvalidaudiofile)
  - [readMetadata()](#readmetadata)
  - [getTagLib()](#gettaglib)
  - [setBufferMode()](#setbuffermode)
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
  - [createTagLib()](#createtaglib)
  - [loadTagLibModule()](#loadtaglibmodule)
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
): Promise<ExtendedTag>;
```

#### Parameters

- `input`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to an `ExtendedTag` object (the basic `Tag` fields shown below
plus extended metadata):

```typescript
interface Tag {
  title?: string[];
  artist?: string[];
  album?: string[];
  comment?: string[];
  genre?: string[];
  year?: number;
  track?: number;
}
```

#### Example

```typescript
// From file path (Node.js/Deno/Bun only)
const tags = await readTags("song.mp3");
console.log(tags.title?.[0], tags.artist?.[0]);

// From buffer
const buffer = await Deno.readFile("song.mp3");
const tags = await readTags(buffer);

// From ArrayBuffer
const arrayBuffer = await fetch("song.mp3").then((r) => r.arrayBuffer());
const tags = await readTags(arrayBuffer);

// From File object (browsers)
const file =
  (document.getElementById("file-input") as HTMLInputElement).files![0];
const tags = await readTags(file);
```

### applyTags()

Apply metadata tags to an audio file and return the modified buffer.

```typescript
function applyTags(
  input: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<TagInput>,
): Promise<Uint8Array>;
```

#### Parameters

- `input`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object
- `tags`: Object containing tags to apply (partial update supported, type
  `Partial<TagInput>`)

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
const file =
  (document.getElementById("file-input") as HTMLInputElement).files![0];
const modifiedBuffer = await applyTags(file, {
  title: "New Title",
  artist: "New Artist",
});
```

### applyTagsToFile()

Update metadata tags in an audio file and save changes to disk.

```typescript
function applyTagsToFile(
  file: string,
  tags: Partial<TagInput>,
): Promise<void>;
```

#### Parameters

- `file`: File path as a string (required for disk operations)
- `tags`: Object containing tags to update (partial update supported, type
  `Partial<TagInput>`)

#### Returns

Promise that resolves when the file has been successfully updated on disk.

#### Example

```typescript
// Update tags in place
await applyTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  year: 2024,
});
// File on disk now has updated tags

// Update only specific tags
await applyTagsToFile("song.mp3", {
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

### clearTags()

Remove all metadata tags and embedded pictures from an audio file and return the
stripped content.

```typescript
function clearTags(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array>;
```

#### Parameters

- `file`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to the modified audio file as `Uint8Array`, with all tags and
pictures removed.

#### Example

```typescript
const stripped = await clearTags("song.mp3");
await Deno.writeFile("song-clean.mp3", stripped);
```

### readFormat()

Detect the audio format of a file.

```typescript
function readFormat(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<FileType | undefined>;
```

#### Parameters

- `file`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to the detected `FileType` (e.g. `"MP3"`, `"FLAC"`, `"MP4"`),
or `undefined` if the format cannot be determined.

#### Example

```typescript
const format = await readFormat("song.mp3");
if (format === "FLAC") {
  // lossless-specific handling
}
```

### isValidAudioFile()

Check whether the input is an audio file TagLib can parse. Never throws —
returns `false` on any error, so it is safe to call on untrusted input.

```typescript
function isValidAudioFile(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<boolean>;
```

#### Parameters

- `file`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to `true` if the file is valid and recognized by TagLib,
`false` otherwise.

#### Example

```typescript
if (await isValidAudioFile(buffer)) {
  const tags = await readTags(buffer);
}
```

### readMetadata()

Read complete metadata for a single file — tags, audio properties, cover-art
presence, and audio dynamics — in one call. Single-file companion to
[`readMetadataBatch()`](#readmetadatabatch).

```typescript
function readMetadata(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<FileMetadata>;
```

#### Parameters

- `file`: File path (string), audio data (Uint8Array/ArrayBuffer), or File
  object

#### Returns

Promise resolving to a `FileMetadata` object:

```typescript
interface FileMetadata {
  tags: ExtendedTag; // all metadata, incl. pictures/ratings/lyrics/chapters
  properties: AudioProperties | undefined;
  hasCoverArt: boolean;
  dynamics?: AudioDynamics; // ReplayGain / Apple Sound Check, when present
}
```

#### Example

```typescript
const { tags, properties, hasCoverArt } = await readMetadata("song.mp3");
console.log(tags.title?.[0], properties?.duration, hasCoverArt);
```

### getTagLib()

Get the shared, lazily-initialized `TagLib` instance that the Simple API uses
internally. Use this to drop down to the [Full API](#full-api) without managing
your own instance. The instance is created on first call and cached.

```typescript
function getTagLib(): Promise<TagLib>;
```

#### Returns

Promise resolving to the cached [`TagLib`](#taglib-class) instance.

#### Example

```typescript
const taglib = await getTagLib();
using file = await taglib.open("song.mp3");
console.log(file.tag().title);
```

### setBufferMode()

Pin the backend used by the Simple API and reset its cached instance. By default
the Simple API auto-detects the best backend; call `setBufferMode(true)` before
any Simple API call to force the Emscripten (buffer) backend, or
`setBufferMode(false)` to restore auto-detection.

```typescript
function setBufferMode(enabled: boolean): void;
```

#### Parameters

- `enabled`: `true` to force the Emscripten backend; `false` to restore
  auto-detection

### Batch Processing

The Simple API includes high-performance batch processing functions for
efficiently handling multiple files. These functions reuse a single TagLib
instance and support configurable concurrency, providing 10-20x performance
improvements over sequential processing.

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
  /** AbortSignal to cancel the batch operation between chunks */
  signal?: AbortSignal;
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
): Promise<BatchResult<ExtendedTag>>;
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

Read tags, audio properties, cover art presence, and audio dynamics data from
multiple files in a single operation. This is the most efficient method for
getting complete metadata.

```typescript
function readMetadataBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options?: BatchOptions,
): Promise<
  BatchResult<{
    tags: ExtendedTag;
    properties: AudioProperties | undefined;
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
    console.log(`  Artist: ${item.data.tags.artist?.[0]}`);
    console.log(`  Title: ${item.data.tags.title?.[0]}`);
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

::: tip The folder API requires filesystem access and is only available in Deno,
Node.js, and Bun environments. :::

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
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});

const okItems = result.items.filter((i) => i.status === "ok");
console.log(`Found ${result.items.length} files`);
console.log(`Processed ${okItems.length} successfully`);
```

### updateFolderTags()

Update metadata for multiple files in batch.

```typescript
function updateFolderTags(
  updates: Array<{ path: string; tags: Partial<TagInput> }>,
  options?: { continueOnError?: boolean },
): Promise<FolderUpdateResult>;
```

#### Example

```typescript
const result = await updateFolderTags([
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  { path: "/music/song2.mp3", tags: { album: "New Album" } },
]);

const updated = result.items.filter((i) => i.status === "ok").length;
console.log(`Updated ${updated} files`);
```

### findDuplicates()

Find duplicate audio files based on metadata criteria.

```typescript
function findDuplicates(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<DuplicateGroup[]>;
```

#### Example

```typescript
const duplicates = await findDuplicates("/music");
for (const group of duplicates) {
  console.log(`Found ${group.files.length} copies:`, group.criteria);
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

For complete documentation, see the [Folder API Reference](/api/folder-api).

## Full API

The Full API provides full control over audio metadata with advanced features.

### createTagLib()

Create a `TagLib` instance from a pre-loaded Wasm module. This is a low-level
escape hatch for advanced loading scenarios (e.g. a custom-instantiated module
or a `deno compile` binary that embeds the Wasm). Most callers should use
[`TagLib.initialize()`](#taglib-initialize) instead, which loads the module for
you.

```typescript
function createTagLib(module: WasmModule): Promise<TagLib>;
```

#### Parameters

- `module`: An already-instantiated `WasmModule`

#### Returns

Promise resolving to a [`TagLib`](#taglib-class) instance wrapping the module.

### loadTagLibModule()

Load and instantiate the raw Wasm module without wrapping it in a `TagLib`. A
low-level loader for custom setups; most callers should use
[`TagLib.initialize()`](#taglib-initialize), which loads the module and wraps it
for you.

```typescript
function loadTagLibModule(options?: LoadTagLibOptions): Promise<TagLibModule>;
```

#### Parameters

- `options` (optional): [`LoadTagLibOptions`](#loadtagliboptions) — Wasm binary,
  URL, forced backend, etc.

#### Returns

Promise resolving to a `TagLibModule` (pass to [`createTagLib()`](#createtaglib)
to get a `TagLib`).

### TagLib Class

Main entry point for the Full API.

#### TagLib.initialize()

Initialize the TagLib WebAssembly module.

```typescript
static async initialize(options?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  wasmUrl?: string;
  forceWasmType?: "wasi" | "emscripten";
  disableOptimizations?: boolean;
}): Promise<TagLib>
```

##### Parameters

- `options` (optional): Configuration for loading the WASM module
  - `wasmBinary`: Pre-loaded WASM binary (for offline usage)
  - `wasmUrl`: Custom WASM URL
  - `forceWasmType`: Explicitly select `"wasi"` or `"emscripten"` backend
  - `disableOptimizations`: Disable runtime optimizations

##### Example

```typescript
// Default initialization (auto-detects best backend)
const taglib = await TagLib.initialize();

// With pre-loaded WASM binary (for offline usage; selects the Emscripten
// backend, so fetch its artifact, taglib-web.wasm)
const wasmBinary = await fetch("taglib-web.wasm").then((r) => r.arrayBuffer());
const taglib = await TagLib.initialize({ wasmBinary });

// With custom WASM URL
const taglib = await TagLib.initialize({ wasmUrl: "/assets/taglib.wasm" });

// Force Emscripten backend
const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
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
  partial?: boolean; // Enable partial loading (default: true)
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
const fileInput =
  (document.getElementById("file-input") as HTMLInputElement).files![0];
using file = await taglib.open(fileInput);

// Partial loading is enabled by default — only headers/footers are read.
// Disable for operations that need the full file buffer:
using fullFile = await taglib.open("song.mp3", { partial: false });
```

#### taglib.updateFile()

Update tags in a file and save changes to disk in one operation. This is a
convenience method that opens, modifies, saves, and closes the file.

```typescript
updateFile(path: string, tags: Partial<TagInput>): Promise<void>
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
  file.setProperties({ albumArtist: ["Various Artists"] });
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
copyWithTags(sourcePath: string, destPath: string, tags: Partial<TagInput>): Promise<void>
```

##### Parameters

- `sourcePath`: Path to the source audio file
- `destPath`: Path where the copy will be saved
- `tags`: Tags to set on the copy (type `Partial<TagInput>`)

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

Represents an open audio file with methods to read and write metadata. AudioFile
implements `Symbol.dispose`, enabling automatic cleanup with the `using`
keyword:

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

When the file is narrowed to a specific format (`file.isFormat("OPUS")`), extra
format-specific fields appear. For Opus, that is `outputGainDb` — the OpusHead
output gain in decibels (RFC 7845). Players apply it unconditionally; it is
separate from, and stacks with, ReplayGain / R128 tags, and is almost always
`0`.

##### tag()

Get the tag object for reading/writing basic metadata.

```typescript
tag(): MutableTag
```

Returns a `MutableTag` object with getters and setters for metadata fields:

```typescript
interface MutableTag {
  // Read properties
  title: string;
  artist: string;
  album: string;
  comment: string;
  genre: string;
  year: number;
  date?: string; // Full release date (e.g. "1975-10-31"), the lossless companion to `year`. Same underlying tag at higher precision.
  track: number;

  // Write methods (chainable)
  setTitle(value: string): MutableTag;
  setArtist(value: string): MutableTag;
  setAlbum(value: string): MutableTag;
  setComment(value: string): MutableTag;
  setGenre(value: string): MutableTag;
  setYear(value: number): MutableTag;
  setDate(value: string): MutableTag; // Set the full release date; `year` resyncs to the leading year. `setDate("")` clears both date and year.
  setTrack(value: number): MutableTag;
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

Get all metadata properties as a key-value map. Includes both standard and
format-specific properties.

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
// Get all properties (keys are camelCase)
const props = file.properties();
console.log(props.albumArtist);

// Set properties (values are string arrays)
file.setProperties({
  albumArtist: ["Various Artists"],
  composer: ["Composer Name"],
  bpm: ["120"],
});

// Single property access (getProperty/setProperty also accept ALL_CAPS keys)
const albumArtist = file.getProperty("albumArtist");
file.setProperty("albumArtist", "New Album Artist");
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

#### Chapter Methods

##### getChapters()

Get all chapter markers, ordered by start time. Returns `[]` if the file has
none.

```typescript
getChapters(): Chapter[]
```

```typescript
interface Chapter {
  startTimeMs: number; // Chapter start, ms from the start of the file
  endTimeMs?: number; // Explicit for ID3v2 CHAP; inferred for MP4
  title?: string;
  id?: string; // ID3v2 CHAP element ID; undefined for MP4 chapters
  source?: "id3" | "nero" | "quicktime";
}
```

Chapters are read from ID3v2 `CHAP` frames (MP3) or, for MP4, a QuickTime
chapter track (preferred when present) or a Nero `chpl` atom. `endTimeMs` is
inferred for MP4 chapters as the next chapter's start time, or the track
duration (`audioProperties().durationMs`) for the last chapter.

##### setChapters()

Replace all chapter markers in the file.

```typescript
setChapters(chapters: Chapter[], options?: SetChaptersOptions): void

interface SetChaptersOptions {
  // MP4 only. "quicktime" (default) writes a QuickTime chapter track;
  // "nero" writes a Nero `chpl` atom (max 255 chapters); "both" writes both.
  // The structure(s) not selected are removed.
  mp4ChapterStyle?: "quicktime" | "nero" | "both";
}
```

Only MP3 (ID3v2 CHAP) and MP4 are supported; other formats throw
`UnsupportedFormatError`. `setChapters([])` clears all chapters. For MP3, an
omitted `endTimeMs` is filled from the next chapter's start (and from the track
duration for the last chapter). Call `save()` to persist.

```typescript
const file = await taglib.open("audiobook.m4b");
for (const ch of file.getChapters()) {
  console.log(`${ch.startTimeMs}ms ${ch.title} (${ch.source})`);
}
file.setChapters([
  { startTimeMs: 0, title: "Intro" },
  { startTimeMs: 95_000, title: "Chapter 1" },
], { mp4ChapterStyle: "both" });
file.save();
```

#### BWF / Broadcast Metadata Methods (WAV and FLAC only)

##### getBext()

Parsed BWF `bext` (Broadcast Audio Extension, EBU Tech 3285) chunk, or
`undefined` if the file has none / the chunk is too short to parse.

```typescript
getBext(): BroadcastAudioExtension | undefined
```

```typescript
interface BroadcastAudioExtension {
  description: string; // ≤ 256 bytes on write
  originator: string; // ≤ 32 bytes
  originatorReference: string; // ≤ 32 bytes
  originationDate: string; // "YYYY-MM-DD"
  originationTime: string; // "HH:MM:SS"
  timeReferenceSamples: bigint; // samples since midnight
  version: number; // 0 | 1 | 2
  umid?: string; // hex; present when version ≥ 1
  loudnessValueDb?: number; // present when version ≥ 2 (LUFS)
  loudnessRangeDb?: number; // LU
  maxTruePeakLevelDbtp?: number; // dBTP
  maxMomentaryLoudnessDb?: number; // LUFS
  maxShortTermLoudnessDb?: number; // LUFS
  codingHistory: string; // CR/LF-delimited text
}
```

##### setBext()

Encode and write a `bext` chunk. Throws `UnsupportedFormatError` for
non-WAV/FLAC files. `version` defaults to 2 when any loudness field is present;
over-long string fields are truncated to their widths and loudness values are
clamped.

```typescript
setBext(bext: BroadcastAudioExtension): void
```

##### getBextData() / setBextData()

Raw `bext` chunk bytes — an escape hatch for vendor extensions or malformed
chunks. `getBextData()` returns `undefined` if absent; `setBextData(null)`
removes the chunk.

```typescript
getBextData(): Uint8Array | undefined
setBextData(data: Uint8Array | null): void
```

##### getIxml() / setIxml()

Raw iXML chunk as a string (passed through verbatim — not parsed).
`setIxml(null)` removes the chunk.

```typescript
getIxml(): string | undefined
setIxml(data: string | null): void
```

The v2 loudness fields are EBU R128-style integrated-loudness measurements and
are distinct from ReplayGain tags. The `bwf.decodeBext` / `bwf.encodeBext`
functions are also exported from the package root for working with raw `bext`
bytes without a file handle.

```typescript
const file = await taglib.open("recording.wav");
const bext = file.getBext();
if (bext) console.log(bext.description, bext.codingHistory);
file.setBext({
  ...bext!,
  description: "Updated",
  version: 2,
  loudnessValueDb: -16,
});
file.setIxml("<BWFXML>…</BWFXML>");
file.save();
```

#### Raw ID3v2 Frame Methods (MP3 only)

Escape hatch for reading/writing raw ID3v2 frame bodies by frame ID — for vendor
or unmodeled frames (`RGAD`, `NCON`, `SYTC`, custom `TXXX`, …) that have no
dedicated `AudioFile` method.

##### getId3v2Frames()

Get every frame with the given ID (or, with no argument, every frame in the
tag).

```typescript
getId3v2Frames(id?: string): Id3v2Frame[]
```

##### setId3v2Frames()

Replace ALL frames carrying `id` with the given bodies. An empty array removes
them all.

```typescript
setId3v2Frames(id: string, data: Uint8Array[]): void
```

##### removeId3v2Frames()

Remove every frame with this ID. Equivalent to `setId3v2Frames(id, [])`.

```typescript
removeId3v2Frames(id: string): void
```

`data` is the frame body without the 10-byte header — the caller owns the body
encoding. Bytes round-trip verbatim for frames TagLib does not model. For
TagLib-modeled IDs (`TIT2`, `APIC`, …): typed getters see a raw write only after
save+reload; bytes may be normalized by later saves after that reload; and raw
reads reflect persisted state plus pending raw writes — not pending typed edits
(backend-dependent). A typed write to the same ID as an existing raw write is
silently ignored until that raw frame is removed or the file is saved and
reloaded — raw writes always win within a save. Frames with
compression/encryption flags are not supported for write (writes emit zero
flags). `Id3v2Frame.flags` exists for forward compatibility, but reads never
populate it today — TagLib always blanks header flags when re-rendering a frame.
On both backends, a raw write to an ID3v1-mapped frame ID (`TIT2`, `TPE1`,
`TALB`, `COMM`, `TCON`, `TDRC`, `TRCK`) suspends the usual ID3v1↔ID3v2
duplicate-sync on `save()` until that raw frame is removed.

```typescript
const file = await taglib.open("song.mp3");
const frames = file.getId3v2Frames("TXXX");
file.setId3v2Frames("RGAD", [rgadBody]);
file.removeId3v2Frames("NCON");
file.save();
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

AcoustID data is read and written through `getProperty()` / `setProperty()`:

```typescript
// Fingerprint
file.setProperty("acoustidFingerprint", fingerprint);
file.getProperty("acoustidFingerprint"); // string | undefined

// ID
file.setProperty("acoustidId", id);
file.getProperty("acoustidId"); // string | undefined
```

#### MusicBrainz Integration

```typescript
// Track ID
file.setProperty("musicbrainzTrackId", id);
file.getProperty("musicbrainzTrackId"); // string | undefined

// Release ID
file.setProperty("musicbrainzReleaseId", id);
file.getProperty("musicbrainzReleaseId"); // string | undefined

// Artist ID
file.setProperty("musicbrainzArtistId", id);
file.getProperty("musicbrainzArtistId"); // string | undefined
```

#### Volume Normalization

##### ReplayGain

```typescript
// Track gain/peak
file.setProperty("replayGainTrackGain", gain);
file.getProperty("replayGainTrackGain"); // string | undefined
file.setProperty("replayGainTrackPeak", peak);
file.getProperty("replayGainTrackPeak"); // string | undefined

// Album gain/peak
file.setProperty("replayGainAlbumGain", gain);
file.getProperty("replayGainAlbumGain"); // string | undefined
file.setProperty("replayGainAlbumPeak", peak);
file.getProperty("replayGainAlbumPeak"); // string | undefined
```

##### Apple Sound Check and gapless playback

Both are freeform MP4 atoms, written with Apple's exact casing (`iTunNORM` /
`iTunSMPB`) rather than an upper-cased variant, so other tools recognise them.

```typescript
// Volume normalization (iTunNORM)
file.setProperty("appleSoundCheck", iTunNORM);
file.getProperty("appleSoundCheck"); // string | undefined

// Gapless playback: encoder delay and padding (iTunSMPB)
file.setProperty("appleGaplessInfo", iTunSMPB);
file.getProperty("appleGaplessInfo"); // string | undefined
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
file.tag().setTitle("New Title");
file.tag().setArtist("New Artist");
await file.saveToFile("song-updated.mp3");
```

##### getFileBuffer()

Get the current file data as a buffer, including any modifications. Call this
after save() to get the updated file data.

```typescript
getFileBuffer(): Uint8Array
```

Returns the complete audio file with any modifications.

###### Throws

- `FileOperationError`: If the file was opened from a path on the WASI backend
  (path mode) and the data cannot be read back from disk — for example, the
  source file was moved or deleted after opening. The buffer is never silently
  empty on failure. Note that when combined with `save()`, the save has already
  written to disk before this read-back — a caught error does not mean the file
  is untouched.

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

#### AudioFileInput

Any audio source the library accepts: a path, raw bytes, a browser `File`, or a
named buffer.

```typescript
type AudioFileInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | File
  | NamedAudioInput;
```

#### NamedAudioInput

A buffer paired with a name, so batch results can be correlated back to their
source.

```typescript
interface NamedAudioInput {
  readonly name: string;
  readonly data: Uint8Array | ArrayBuffer;
}
```

#### TagInput

Input shape for writing tags; every field accepts a single string or a
`string[]`.

```typescript
interface TagInput {
  // Basic fields
  readonly title?: string | string[];
  readonly artist?: string | string[];
  readonly album?: string | string[];
  readonly comment?: string | string[];
  readonly genre?: string | string[];
  readonly year?: number;
  readonly date?: string | string[]; // wins over `year` when both set
  readonly track?: number;
  // Raw track field ("03", "3/12"); wins over `track` when both set, because it
  // preserves padding and the "/total" suffix a number cannot represent
  readonly trackNumber?: string | string[];

  // Extended string fields (abbreviated)
  readonly albumArtist?: string | string[];
  readonly composer?: string | string[];
  readonly copyright?: string | string[];
  readonly isrc?: string | string[];
  readonly musicbrainzTrackId?: string | string[];
  readonly replayGainTrackGain?: string | string[];
  readonly appleSoundCheck?: string | string[]; // iTunNORM
  readonly appleGaplessInfo?: string | string[]; // iTunSMPB
  // ...plus sort fields and further MusicBrainz/AcoustID/ReplayGain IDs

  // Extended numeric / boolean fields
  readonly discNumber?: number;
  readonly totalTracks?: number;
  readonly totalDiscs?: number;
  readonly bpm?: number;
  readonly compilation?: boolean;
}
```

#### PictureType

Picture/artwork category, matching the ID3v2 APIC frame codes.

```typescript
type PictureType =
  | "Other"
  | "FileIcon"
  | "OtherFileIcon"
  | "FrontCover"
  | "BackCover"
  | "LeafletPage"
  | "Media"
  | "LeadArtist"
  | "Artist"
  | "Conductor"
  | "Band"
  | "Composer"
  | "Lyricist"
  | "RecordingLocation"
  | "DuringRecording"
  | "DuringPerformance"
  | "MovieScreenCapture"
  | "ColouredFish"
  | "Illustration"
  | "BandLogo"
  | "PublisherLogo";
```

#### UnsyncedLyrics

Lyrics text without timing information, as read/written via `getLyrics()` /
`setLyrics()`.

```typescript
interface UnsyncedLyrics {
  text: string; // full lyrics text
  description?: string; // description or content type
  language?: string; // ISO 639-2 code, e.g. "eng"
}
```

#### Id3v2Frame

A raw ID3v2 frame, as read/written via `getId3v2Frames()` / `setId3v2Frames()` /
`removeId3v2Frames()`.

```typescript
interface Id3v2Frame {
  id: string; // 4-character frame ID, e.g. "TXXX", "RGAD"
  data: Uint8Array; // frame body, without the 10-byte frame header
  flags?: number; // reserved for forward compatibility; never populated today
}
```

#### AudioCodec

The compression format of the audio stream (`AudioProperties.codec`).

```typescript
type AudioCodec =
  | "AAC"
  | "ALAC"
  | "MP3"
  | "FLAC"
  | "Vorbis"
  | "Opus"
  | "Speex"
  | "PCM"
  | "IEEEFloat"
  | "WAV"
  | "WMA"
  | "WMALossless"
  | "APE"
  | "DSD"
  | "WavPack"
  | "MPC"
  | "TTA"
  | "Shorten"
  | "MOD"
  | "S3M"
  | "IT"
  | "XM"
  | "unknown";
```

#### ContainerFormat

The container that stores the audio and metadata
(`AudioProperties.containerFormat`). Distinct from the codec — e.g. an `MP4`
container may hold `AAC` or `ALAC`.

```typescript
type ContainerFormat =
  | "MP3"
  | "MP4"
  | "FLAC"
  | "OGG"
  | "WAV"
  | "AIFF"
  | "ASF"
  | "APE"
  | "DSF"
  | "DSDIFF"
  | "WavPack"
  | "MPC"
  | "TTA"
  | "Shorten"
  | "MOD"
  | "S3M"
  | "IT"
  | "XM"
  | "Matroska"
  | "unknown";
```

#### BitrateControlMode

How bitrate was managed during encoding (MP4/M4A specific). Not to be confused
with `BitrateMode` (`"CBR" | "VBR" | "ABR"`, the MP3 field on
`AudioProperties.bitrateMode`).

```typescript
type BitrateControlMode =
  | "Constant" // fixed bitrate throughout
  | "LongTermAverage" // average bitrate over time
  | "VariableConstrained" // variable within limits
  | "Variable"; // fully variable
```

#### TypedAudioProperties

`AudioProperties` narrowed by file format, promoting format-specific optional
fields to required after an `isFormat()` check (e.g. MP3 gains required
`mpegVersion`/`mpegLayer`).

```typescript
type TypedAudioProperties<F extends FileType> = F extends "MP3"
  ? AudioProperties & {
    readonly mpegVersion: number;
    readonly mpegLayer: number;
  }
  : F extends "MP4" | "ASF"
    ? AudioProperties & { readonly isEncrypted: boolean }
  : F extends "OPUS" ? AudioProperties & { readonly outputGainDb: number }
  : AudioProperties;
```

#### TypedAudioFile

An `AudioFile` narrowed to a specific format, so `getProperty`/`setProperty`
only accept keys valid for that format's tag system. Obtained via
`file.isFormat(format)`.

```typescript
interface TypedAudioFile<F extends FileType>
  extends Omit<AudioFile, "getProperty" | "setProperty" | "audioProperties"> {
  getFormat(): F;
  audioProperties(): TypedAudioProperties<F> | undefined;
  getProperty<K extends FormatPropertyKey<F>>(
    key: K,
  ): PropertyValue<K> | undefined;
  setProperty<K extends FormatPropertyKey<F>>(
    key: K,
    value: PropertyValue<K>,
  ): void;
}
```

#### LoadTagLibOptions

Options passed to `TagLib.initialize()` / `loadTagLibModule()` to control how
the Wasm module loads.

```typescript
interface LoadTagLibOptions {
  wasmBinary?: ArrayBuffer | Uint8Array; // pre-loaded Wasm binary
  wasmUrl?: string; // custom Wasm URL/path
  forceWasmType?: "wasi" | "emscripten"; // force a backend
  disableOptimizations?: boolean; // default false
}
```

`wasmBinary` is Emscripten-only: supplying it selects the Emscripten backend in
auto mode, and combining it with `forceWasmType: "wasi"` throws — the WASI
backend loads from a filesystem path or URL, so use `wasmUrl` with it. When a
`forceWasmType` choice fails to load, initialization throws rather than silently
serving the other backend.

#### TagLibErrorCode

The `code` carried by every `TagLibError`, for programmatic error handling.

```typescript
type TagLibErrorCode =
  | "INITIALIZATION"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_FORMAT"
  | "FILE_OPERATION"
  | "METADATA"
  | "MEMORY"
  | "ENVIRONMENT"
  | "WASM_MEMORY"
  | "MODULE_LOAD"
  | "WASI_HOST";
```

#### TagName

Union of all valid camelCase tag property names (the values of the `Tags`
constant). Returned by `getAllTagNames()` and guarded by `isValidTagName()`.

```typescript
type TagName = typeof Tags[keyof typeof Tags];
// e.g. "title" | "artist" | "album" | "albumArtist" | "composer" | ...
```

#### PropertyMetadata

Descriptive metadata for a single property, returned by `getPropertyMetadata()`.

```typescript
type PropertyMetadata = {
  key: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  supportedFormats: readonly string[];
  mappings: Record<
    string,
    string | { frame?: string; atom?: string; description?: string }
  >;
};
```

#### DuplicateGroup

A set of files judged duplicates by `findDuplicates()`, grouped by the matched
criteria.

```typescript
interface DuplicateGroup {
  criteria: Record<string, string>;
  files: AudioFileMetadata[];
}
```

#### COMPLEX_PROPERTIES

Introspection table describing each complex property (description, type,
supported formats, and per-format frame/atom mappings). Use for documentation or
format-aware logic.

```typescript
const COMPLEX_PROPERTIES = {
  PICTURE: {
    key: "PICTURE",
    type: "binary",
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "FLAC"],
    mappings: {
      id3v2: { frame: "APIC" },
      mp4: "covr",
      vorbis: "METADATA_BLOCK_PICTURE",
      flac: "PICTURE",
    },
  },
  RATING: {/* POPM / RATING / ----:com.apple.iTunes:RATING */},
  LYRICS: {/* USLT / LYRICS / ©lyr */},
  CHAPTER: {/* CHAP (ID3v2 only) */},
} as const;
```

#### COMPLEX_PROPERTY_KEY

Plain string-keyed map of the complex-property names — a companion to
`COMPLEX_PROPERTIES` that avoids the `.key` ceremony. Complex properties are
read and written through their dedicated `AudioFile` methods.

```typescript
const COMPLEX_PROPERTY_KEY = {
  PICTURE: "PICTURE",
  RATING: "RATING",
  LYRICS: "LYRICS",
  CHAPTER: "CHAPTER",
} as const;

// Complex properties use dedicated methods:
const ratings = file.getRatings(); // Rating[]
const pictures = file.getPictures(); // Picture[]
const lyrics = file.getLyrics(); // UnsyncedLyrics[]
const chapters = file.getChapters(); // Chapter[]
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

The WebAssembly module automatically detects the Workers environment and
optimizes memory usage accordingly.

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

// Check if a tag name is valid (names are camelCase)
isValidTagName("title"); // true
isValidTagName("INVALID_TAG"); // false

// Get all available tag names
const allTags = getAllTagNames();
console.log(`Available tags: ${allTags.length}`);
```

### Available Constants

The `Tags` object provides constants for all standard tag names:

- **Basic Tags**: `Title`, `Artist`, `Album`, `Date`, `Genre`, `Comment`,
  `TrackNumber`
- **Extended Tags**: `AlbumArtist`, `Composer`, `Bpm`, `Copyright`, `Conductor`
- **MusicBrainz**: `MusicBrainzArtistId`, `MusicBrainzReleaseId`,
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

The WebAssembly module automatically configures memory based on your
environment. For most use cases, the default configuration works well.

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
    albumArtist: ["Various Artists"],
    composer: ["Composer Name"],
    bpm: ["120"],
    replayGainTrackGain: ["-6.5 dB"],
  });

  // Add identifiers
  file.setProperty("acoustidFingerprint", "AQADtMmybfGO8NCN...");
  file.setProperty(
    "musicbrainzTrackId",
    "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
  );

  // Save changes to a new file
  const outputPath = filePath.replace(/\.(\w+)$/, "-modified.$1");
  await file.saveToFile(outputPath);
  console.log("Saved to:", outputPath);

  // file is automatically disposed when it goes out of scope
}

// Usage
await processAudioFile("song.mp3");

// Alternative: Using the simple API
import { applyTagsToFile } from "taglib-wasm";

await applyTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
  year: 2024,
});
// File on disk now has updated tags
```
