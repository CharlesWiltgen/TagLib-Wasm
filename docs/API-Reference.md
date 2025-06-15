# API Reference

This document provides a complete reference for the taglib-wasm API, including both the Core API and Simple API.

## TagLib class

The main entry point for taglib-wasm. Initialize this class to start working with audio files.

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib>;
  open(input: string | ArrayBuffer | Uint8Array | File): Promise<AudioFile>;
  updateFile(path: string, tags: Partial<Tag>): Promise<void>;
  copyWithTags(sourcePath: string, destPath: string, tags: Partial<Tag>): Promise<void>;
  version(): string;
}
```

### Methods

#### `TagLib.initialize(config?: TagLibConfig): Promise<TagLib>`

Initializes the taglib-wasm module.

- **Parameters**:
  - `config` (optional): Configuration options
    - `memory?: { initial?: number }`: Initial memory allocation (default: automatic)
- **Returns**: Promise resolving to a TagLib instance
- **Throws**: `InitializationError` if initialization fails

#### `open(input: string | ArrayBuffer | Uint8Array | File): Promise<AudioFile>`

Opens an audio file from various input sources.

- **Parameters**:
  - `input`: File path (string), buffer (ArrayBuffer/Uint8Array), or File object
- **Returns**: Promise resolving to an AudioFile instance
- **Throws**: 
  - `InvalidFormatError` if the file format is not supported
  - `FileNotFoundError` if the file path doesn't exist (when using string path)

#### `updateFile(path: string, tags: Partial<Tag>): Promise<void>`

Updates tags in a file at the specified path.

- **Parameters**:
  - `path`: File system path to the audio file
  - `tags`: Object with tag fields to update
- **Returns**: Promise that resolves when the update is complete
- **Throws**: Various errors if file operation fails

#### `copyWithTags(sourcePath: string, destPath: string, tags: Partial<Tag>): Promise<void>`

Copies a file and applies new tags to the copy.

- **Parameters**:
  - `sourcePath`: Source file path
  - `destPath`: Destination file path
  - `tags`: Tags to apply to the copy
- **Returns**: Promise that resolves when the copy is complete

#### `version(): string`

Returns the TagLib version string.

- **Returns**: Version string (e.g., "2.1.0")

## AudioFile class

Represents an open audio file with methods to read and write metadata.

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
  saveToFile(path?: string): Promise<void>;
  dispose(): void;
}
```

### Methods

#### `isValid(): boolean`

Checks if the file was successfully loaded and is valid.

- **Returns**: `true` if valid, `false` otherwise

#### `getFormat(): string`

Returns the detected audio format.

- **Returns**: Format string (e.g., "MP3", "FLAC", "MP4", "OGG", "WAV")

#### `audioProperties(): AudioProperties`

Returns audio technical properties.

- **Returns**: AudioProperties object with:
  - `length`: Duration in seconds
  - `bitrate`: Bitrate in kbps
  - `sampleRate`: Sample rate in Hz
  - `channels`: Number of channels

#### `tag(): Tag`

Returns the Tag object for reading and writing basic metadata.

- **Returns**: Tag object with getters and setters for common fields

#### `properties(): PropertyMap`

Returns all metadata as a property map for advanced access.

- **Returns**: Object mapping property names to arrays of values

#### `setProperties(properties: PropertyMap): void`

Sets multiple properties at once.

- **Parameters**:
  - `properties`: Object mapping property names to arrays of values

#### `getProperty(key: string): string | undefined`

Gets a single property value.

- **Parameters**:
  - `key`: Property name (use Tag constants for reliability)
- **Returns**: First value for the property, or undefined

#### `setProperty(key: string, value: string): void`

Sets a single property value.

- **Parameters**:
  - `key`: Property name (use Tag constants for reliability)
  - `value`: Property value

#### `isMP4(): boolean`

Checks if the file is an MP4/M4A file.

- **Returns**: `true` if MP4 format, `false` otherwise

#### `getMP4Item(key: string): string | undefined`

Gets an MP4-specific metadata item.

- **Parameters**:
  - `key`: MP4 atom name
- **Returns**: Value or undefined

#### `setMP4Item(key: string, value: string): void`

Sets an MP4-specific metadata item.

- **Parameters**:
  - `key`: MP4 atom name
  - `value`: Value to set

#### `removeMP4Item(key: string): void`

Removes an MP4-specific metadata item.

- **Parameters**:
  - `key`: MP4 atom name to remove

#### `save(): boolean`

Saves changes back to the in-memory buffer.

- **Returns**: `true` if successful, `false` otherwise

#### `getFileBuffer(): Uint8Array`

Returns the current file data as a buffer.

- **Returns**: Uint8Array containing the file data with any saved changes

#### `saveToFile(path?: string): Promise<void>`

Saves the file to the filesystem (Node.js, Deno, Bun only).

- **Parameters**:
  - `path` (optional): Target path. If omitted, overwrites the original file
- **Throws**: `FileSystemError` if save fails

#### `dispose(): void`

Releases resources associated with the file. Always call this when done.

## Tag interface

Interface for basic metadata access with both getters and setters.

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

## Simple API Functions

Convenience functions for common operations without managing TagLib instances.

```typescript
// Read operations
async function readTags(file: string | Uint8Array | ArrayBuffer | File): Promise<Tag>;
async function readProperties(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioProperties>;

// Write operations
async function writeTags(
  file: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<Tag>,
  options?: number
): Promise<Uint8Array>;

async function updateTags(
  file: string,
  tags: Partial<Tag>,
  options?: number
): Promise<void>;

// Validation
async function isValidAudioFile(file: string | Uint8Array | ArrayBuffer | File): Promise<boolean>;
async function getFileFormat(file: string | Uint8Array | ArrayBuffer | File): Promise<string | null>;
```

### `readTags(file): Promise<Tag>`

Reads basic tags from an audio file.

- **Parameters**:
  - `file`: File path, buffer, or File object
- **Returns**: Promise resolving to Tag object
- **Throws**: Various errors if file is invalid

### `readProperties(file): Promise<AudioProperties>`

Reads audio properties from a file.

- **Parameters**:
  - `file`: File path, buffer, or File object
- **Returns**: Promise resolving to AudioProperties
- **Throws**: Various errors if file is invalid

### `writeTags(file, tags, options?): Promise<Uint8Array>`

Writes tags to a file and returns the modified buffer.

- **Parameters**:
  - `file`: File path, buffer, or File object
  - `tags`: Partial Tag object with fields to update
  - `options` (optional): Write options (reserved for future use)
- **Returns**: Promise resolving to modified file buffer
- **Throws**: Various errors if operation fails

### `updateTags(file, tags, options?): Promise<void>`

Updates tags in a file on the filesystem.

- **Parameters**:
  - `file`: File path (filesystem access required)
  - `tags`: Partial Tag object with fields to update
  - `options` (optional): Write options (reserved for future use)
- **Returns**: Promise that resolves when complete
- **Throws**: Various errors if operation fails

### `isValidAudioFile(file): Promise<boolean>`

Checks if a file is a valid audio file.

- **Parameters**:
  - `file`: File path, buffer, or File object
- **Returns**: Promise resolving to boolean

### `getFileFormat(file): Promise<string | null>`

Detects the format of an audio file.

- **Parameters**:
  - `file`: File path, buffer, or File object
- **Returns**: Promise resolving to format string or null

## Types

### PropertyMap

Map of property names to arrays of values.

```typescript
type PropertyMap = { [key: string]: string[] };
```

### AudioProperties

Audio technical properties.

```typescript
interface AudioProperties {
  length: number;      // Duration in seconds
  bitrate: number;     // Bitrate in kbps
  sampleRate: number;  // Sample rate in Hz
  channels: number;    // Number of channels
}
```

### TagLibConfig

Configuration options for TagLib initialization.

```typescript
interface TagLibConfig {
  memory?: {
    initial?: number;  // Initial memory in bytes
  };
}
```

## Tag Constants

taglib-wasm provides type-safe constants for common tag names. See [Tag Name Constants](Tag-Name-Constants.md) for the complete reference.

```typescript
import { Tags } from "taglib-wasm";

// Common tags
Tags.Title           // "TITLE"
Tags.Artist          // "ARTIST"
Tags.Album           // "ALBUM"
Tags.AlbumArtist     // "ALBUMARTIST"
Tags.Composer        // "COMPOSER"
Tags.Genre           // "GENRE"
Tags.Year            // "DATE"
Tags.Track           // "TRACKNUMBER"
Tags.DiscNumber      // "DISCNUMBER"
Tags.Comment         // "COMMENT"
Tags.Bpm             // "BPM"
Tags.Compilation     // "COMPILATION"

// Extended metadata
Tags.AcoustidFingerprint  // "ACOUSTID_FINGERPRINT"
Tags.AcoustidId           // "ACOUSTID_ID"
Tags.MusicBrainzTrackId   // "MUSICBRAINZ_TRACKID"
Tags.MusicBrainzAlbumId   // "MUSICBRAINZ_ALBUMID"
Tags.MusicBrainzArtistId  // "MUSICBRAINZ_ARTISTID"

// ReplayGain
Tags.TrackGain       // "REPLAYGAIN_TRACK_GAIN"
Tags.TrackPeak       // "REPLAYGAIN_TRACK_PEAK"
Tags.AlbumGain       // "REPLAYGAIN_ALBUM_GAIN"
Tags.AlbumPeak       // "REPLAYGAIN_ALBUM_PEAK"
```

## Error Handling

All errors extend from `TagLibError` base class. See [Error Handling Guide](Error-Handling.md) for complete details.

```typescript
import { 
  TagLibError,
  InitializationError,
  InvalidFormatError,
  FileNotFoundError,
  isTagLibError 
} from "taglib-wasm";

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