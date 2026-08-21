# Folder API Reference

The folder API provides batch operations for processing multiple audio files in
directories.

## Import

```typescript
import {
  type AudioFileMetadata,
  type DuplicateGroup,
  exportFolderMetadata,
  findDuplicates,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
} from "taglib-wasm";
```

> **Batch writes** (`writeTagsBatch`, `editTagsBatch`) live in the Simple API —
> `import { writeTagsBatch } from "taglib-wasm/simple"`. They replace the former
> `updateFolderTags`.

## Functions

### groupAlbums() / scanForAlbums()

Groups a folder scan into albums with disc subdivisions. `groupAlbums` is the
pure, synchronous core over a `FolderScanResult` (runtime-agnostic);
`scanForAlbums` scans then groups (Deno/Node/Bun only).

```typescript
function groupAlbums(
  result: FolderScanResult,
  options?: GroupAlbumsOptions,
): AlbumGroupingResult;

function scanForAlbums(
  folderPath: string,
  options?: ScanForAlbumsOptions, // FolderScanOptions & GroupAlbumsOptions
): Promise<AlbumGroupingResult>;
```

**`AlbumGroupingResult`:**

- `albums: AlbumGroup[]` - each with `key: AlbumGroupKey` (opaque, stable
  identity; identical input produces identical keys), `album`, `albumArtist`,
  `source: "tags" | "folder"`, `compilation: boolean | undefined` (tag
  agreement), `directory` (common album folder), `discs: AlbumDisc[]`, and
  `items: AlbumGroupItem[]`
- `AlbumGroupItem extends AudioFileMetadata` adding the per-file resolution:
  `albumDir` (the album folder the file was attributed to) and `discNumber` (tag
  wins, folder is the fallback)
- `AlbumDisc` - `discNumber`, `totalDiscs` (tag total → `of N` → max sibling),
  `folderDiscNumber`, `folderDiscTitle`, `tagDiscNumber`,
  `confidence: DiscConfidence` (`"high" | "medium" | "low"` — the strength of
  the folder-name evidence; tag-derived discs are `"high"`), `items`
- `singles: AudioFileMetadata[]` - ok items whose resolved album has exactly one
  file
- `unmatched: AudioFileMetadata[]` - no album tag and no folder title evidence
- `errors` - per-file scan errors (disjoint from all other buckets)

**Options:** `minFolderConfidence` (`"low" | "medium" | "high"`),
`flatDiscPrefixes` (default true), `folderFallback` (default true), `scanRoot`
(pins the scanned directory; a bare disc folder directly under it is unmatched).

**`discFolderInfo(name)`** — the standalone disc-folder recognizer. Classifies a
directory name only; it does not resolve the folder to its parent (the album
result's per-file `albumDir` carries the resolution). Returns
`DiscFolderInfo | undefined`: `kind`
(`"exact" | "embedded" | "volume" |
"bonus" | "bare"`), `gated` (corroboration
required — title-word markers like `tape`/`vinyl`/`cassette`/`lp`/`record`, side
letters like `CD D`, bonus, bare), `number`, `total`, `title`, `discTitle`,
`confidence`.

**Example:**

```typescript
const { albums, singles } = await scanForAlbums("/music", { recursive: true });
for (const album of albums) {
  console.log(album.album, album.discs.map((d) => d.discNumber));
}
```

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

### writeTagsBatch()

Applies tag updates to multiple files in batch — the single batch-write
convention (this replaced the Folder API's `updateFolderTags`, which was
removed). Import from `taglib-wasm/simple`.

```typescript
function writeTagsBatch(
  updates: Array<{
    path: string;
    tags?: Partial<TagInput>; // typed merge
    properties?: Record<string, string[]>; // raw WIRE-key map ([] removes)
  }>,
  options?: BatchOptions,
): Promise<BatchResult<void>>;
```

**Parameters:**

- `updates` - Per-file updates: `tags` is the typed merge; `properties` is a raw
  wire-key map with the same shape and rule as the Full API's `setProperties` —
  keys outside TagInput (e.g. `BARCODE`) ride here, and an empty array removes
  the key (true removal, no empty-string carrier). Both apply in one save. A
  path may appear more than once (last update wins)
- `options` - `BatchOptions`: `concurrency`, `continueOnError` (default:
  `true`), `onProgress(processed, total, file)`, `signal`

**Returns:** Promise with per-file `ok`/`error` items in input order plus
`duration`. A failed file is left in its pre-write state (atomic temp-file
saves); abort is honored between files, never mid-save.

**Example:**

```typescript
import { writeTagsBatch } from "taglib-wasm/simple";

const result = await writeTagsBatch([
  { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
  {
    path: "/music/song2.mp3",
    tags: { album: "New Album" },
    properties: { BARCODE: ["LC1234"], COMPILATION: [] },
  },
], {
  concurrency: 8,
  onProgress: (processed, total, file) =>
    console.log(`${processed}/${total}: ${file}`),
});
```

The mutator-callback variant `editTagsBatch(files, mutator, options)` opens each
file, applies `mutator(audioFile, path)` (the path it was opened from — no order
coupling), and saves — same options and result contract.

### findDuplicates()

Finds duplicate audio files based on metadata criteria.

```typescript
function findDuplicates(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<DuplicateGroup[]>;
```

**Parameters:**

- `folderPath` - Directory to search for duplicates
- `options` - Optional configuration (includes all `FolderScanOptions` fields)
  - `criteria` - Tag fields to compare (default: `["artist", "title"]`)

**Returns:** An array of `DuplicateGroup` objects, each
`{ criteria: Record<string, string>; files: AudioFileMetadata[] }`

**Example:**

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

  /** Tag fields to compare for duplicate detection (default: ["artist", "title"]) */
  criteria?: Array<keyof Tag>;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}
```

### FolderScanResult

Results from a folder scan operation.

```typescript
type FolderScanItem =
  | ({ status: "ok" } & AudioFileMetadata)
  | { status: "error"; path: string; error: Error };

interface FolderScanResult {
  /** All scan results (check status to discriminate ok vs error) */
  items: FolderScanItem[];

  /** Time taken in milliseconds */
  duration: number;
}
```

### FolderUpdateResult

Removed with `updateFolderTags`. Batch-write results use the Simple API's
`BatchResult<void>` (`{ status: "ok" | "error"; path; ... }` per item in input
order) — see `writeTagsBatch` above.

### AudioFileMetadata

Metadata for a single audio file including path information.

```typescript
interface AudioFileMetadata {
  /** Absolute or relative path to the audio file */
  path: string;

  /** Tag information including extended fields */
  tags: ExtendedTag;

  /** Audio properties (optional) */
  properties?: AudioProperties;

  /** Whether the file contains embedded cover art */
  hasCoverArt?: boolean;

  /** Audio dynamics data (ReplayGain and Sound Check) */
  dynamics?: AudioDynamics;
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

### DuplicateGroup

A set of files judged duplicates by `findDuplicates()`, grouped by the matched
criteria.

```typescript
interface DuplicateGroup {
  /** The tag values that these files share (e.g. { artist, title }) */
  criteria: Record<string, string>;

  /** The duplicate files in this group */
  files: AudioFileMetadata[];
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

Folder operations use a hardcoded concurrency of 4 for balanced performance and
memory usage.

### Memory Usage

Each concurrent operation loads a file into memory. For large collections:

```typescript
// Memory-efficient settings
const result = await scanFolder("/huge-library", {
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
  const errors = result.items.filter((i) => i.status === "error");
  if (errors.length > 0) {
    console.warn(`Failed to process ${errors.length} files`);
    for (const item of errors) {
      console.error(`${item.path}: ${item.error.message}`);
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

- [Folder Operations Guide](/guide/folder-operations) - Detailed usage examples
- [Simple API](/api/#simple-api) - Individual file operations
- [Performance Guide](/concepts/performance) - Optimization tips
