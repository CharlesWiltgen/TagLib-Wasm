# Folder API Reference

The folder API provides batch operations for processing multiple audio files in
directories.

## Import

```typescript
import {
  type AudioFileMetadata,
  exportFolderMetadata,
  findDuplicates,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
  updateFolderTags,
} from "taglib-wasm";
```

## Functions

### scanFolder()

Scans a directory for audio files and reads their metadata.

```typescript
function scanFolder(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<FolderScanResult>;
```

**Parameters:**

- `folderPath` - Path to the directory to scan
- `options` - Optional configuration object

**Returns:** Promise resolving to scan results

**Example:**

```typescript
const result = await scanFolder("/music", {
  recursive: true,
  onProgress: (processed, total) => {
    console.log(`${processed}/${total}`);
  },
});

// Check for files with dynamics data
for (const file of result.items) {
  if (file.hasCoverArt) {
    console.log(`${file.path} has cover art`);
  }

  if (file.dynamics?.replayGainTrackGain) {
    console.log(
      `${file.path} has ReplayGain: ${file.dynamics.replayGainTrackGain}`,
    );
  }

  if (file.dynamics?.appleSoundCheck) {
    console.log(`${file.path} has Sound Check data`);
  }
}
```

### updateFolderTags()

Updates metadata for multiple files in batch.

```typescript
function updateFolderTags(
  updates: Array<{ path: string; tags: Partial<Tag> }>,
  options?: {
    continueOnError?: boolean;
    concurrency?: number;
  },
): Promise<{
  successful: number;
  failed: Array<{ path: string; error: Error }>;
  duration: number;
}>;
```

**Parameters:**

- `updates` - Array of file paths and tag updates
- `options` - Optional configuration
  - `continueOnError` - Continue if files fail (default: `true`)
  - `concurrency` - Parallel processing limit (default: `4`)

**Returns:** Promise with update results

**Example:**

```typescript
const result = await updateFolderTags([
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  { path: "/music/song2.mp3", tags: { album: "New Album" } },
]);
```

### findDuplicates()

Finds duplicate audio files based on metadata criteria.

```typescript
function findDuplicates(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<Map<string, AudioFileMetadata[]>>;
```

**Parameters:**

- `folderPath` - Directory to search for duplicates
- `options` - Optional configuration (includes all `FolderScanOptions` fields)
  - `criteria` - Tag fields to compare (default: `["artist", "title"]`)

**Returns:** Map of duplicate groups keyed by composite metadata

**Example:**

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

Exports folder metadata to a JSON file.

```typescript
function exportFolderMetadata(
  folderPath: string,
  outputPath: string,
  options?: FolderScanOptions,
): Promise<void>;
```

**Parameters:**

- `folderPath` - Directory to scan
- `outputPath` - Where to save the JSON file
- `options` - Same options as `scanFolder()`

**Example:**

```typescript
await exportFolderMetadata("/music", "./catalog.json", {
  recursive: true,
  includeProperties: true,
});
```

## Types

### FolderScanOptions

Configuration options for scanning folders.

```typescript
interface FolderScanOptions {
  /** Scan subdirectories recursively (default: true) */
  recursive?: boolean;

  /** File extensions to include (default: common audio formats) */
  extensions?: string[];

  /** Maximum number of files to process (default: unlimited) */
  maxFiles?: number;

  /** Progress callback */
  onProgress?: (
    processed: number,
    total: number,
    currentFile: string,
  ) => void;

  /** Include audio properties (default: true) */
  includeProperties?: boolean;

  /** Continue on errors (default: true) */
  continueOnError?: boolean;

  /** Parallel processing limit (default: 4) */
  concurrency?: number;

  /** Tag fields to compare for duplicate detection (default: ["artist", "title"]) */
  criteria?: Array<keyof Tag>;
}
```

### FolderScanResult

Results from a folder scan operation.

```typescript
interface FolderScanResult {
  /** Successfully processed files with metadata */
  files: AudioFileMetadata[];

  /** Files that failed to process */
  errors: Array<{
    path: string;
    error: Error;
  }>;

  /** Total number of audio files found */
  totalFound: number;

  /** Total number of files successfully processed */
  totalProcessed: number;

  /** Time taken in milliseconds */
  duration: number;
}
```

### AudioFileMetadata

Metadata for a single audio file including path information.

```typescript
interface AudioFileMetadata {
  /** Absolute or relative path to the audio file */
  path: string;

  /** Basic tag information */
  tags: Tag;

  /** Audio properties (optional) */
  properties?: AudioProperties;

  /** Whether the file contains embedded cover art */
  hasCoverArt?: boolean;

  /** Audio dynamics data (ReplayGain and Sound Check) */
  dynamics?: AudioDynamics;

  /** Error if processing failed */
  error?: Error;
}
```

### AudioDynamics

Audio dynamics data for volume normalization.

```typescript
interface AudioDynamics {
  /** ReplayGain track gain in dB (e.g., "-6.54 dB") */
  replayGainTrackGain?: string;

  /** ReplayGain track peak value (0.0-1.0) */
  replayGainTrackPeak?: string;

  /** ReplayGain album gain in dB */
  replayGainAlbumGain?: string;

  /** ReplayGain album peak value (0.0-1.0) */
  replayGainAlbumPeak?: string;

  /** Apple Sound Check normalization data (iTunNORM) */
  appleSoundCheck?: string;
}
```

## Default Audio Extensions

The following extensions are scanned by default:

```typescript
const DEFAULT_AUDIO_EXTENSIONS = [
  ".mp3", // MPEG Audio Layer 3
  ".m4a", // MPEG-4 Audio
  ".mp4", // MPEG-4 (with audio)
  ".flac", // Free Lossless Audio Codec
  ".ogg", // Ogg Vorbis
  ".oga", // Ogg Audio
  ".opus", // Opus Audio
  ".wav", // Waveform Audio
  ".wv", // WavPack
  ".ape", // Monkey's Audio
  ".mpc", // Musepack
  ".tta", // True Audio
  ".wma", // Windows Media Audio
];
```

## Performance Considerations

### Concurrency

The `concurrency` option controls parallel processing:

- **Higher values** (8-16): Faster processing, more memory usage
- **Lower values** (1-4): Slower processing, less memory usage
- **Default** (4): Balanced for most systems

### Memory Usage

Each concurrent operation loads a file into memory. For large collections:

```typescript
// Memory-efficient settings
const result = await scanFolder("/huge-library", {
  concurrency: 2, // Process fewer files at once
  includeProperties: false, // Skip audio properties
});
```

### Progress Monitoring

For long operations, use the progress callback:

```typescript
const startTime = Date.now();
const result = await scanFolder("/music", {
  onProgress: (processed, total, file) => {
    const elapsed = Date.now() - startTime;
    const rate = processed / (elapsed / 1000);
    const eta = (total - processed) / rate;
    console.log(`${processed}/${total} - ETA: ${Math.round(eta)}s`);
  },
});
```

## Error Handling

All functions handle errors gracefully:

```typescript
try {
  const result = await scanFolder("/music");

  // Check for partial failures
  if (result.errors.length > 0) {
    console.warn(`Failed to process ${result.errors.length} files`);
    for (const { path, error } of result.errors) {
      console.error(`${path}: ${error.message}`);
    }
  }
} catch (error) {
  // Complete failure (e.g., invalid directory)
  console.error(`Scan failed: ${error.message}`);
}
```

## Runtime Compatibility

The folder API requires filesystem access:

| Runtime | Support | Notes                |
| ------- | ------- | -------------------- |
| Deno    | ✅ Full | Native support       |
| Node.js | ✅ Full | Via `fs/promises`    |
| Bun     | ✅ Full | Via `fs/promises`    |
| Browser | ❌ None | No filesystem access |
| Workers | ❌ None | No filesystem access |

## See Also

- [Folder Operations Guide](/guide/folder-operations.html) - Detailed usage
  examples
- [Simple API](/api/#simple-api) - Individual file operations
- [Performance Guide](/concepts/performance.html) - Optimization tips
