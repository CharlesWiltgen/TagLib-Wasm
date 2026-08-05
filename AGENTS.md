# TagLib-Wasm — AI Agent Reference

WebAssembly build of TagLib for reading/writing audio metadata in JS/TS.
Works in Deno, Node.js, Bun, browsers, and Cloudflare Workers.

## Boundaries (OFF LIMITS)

- The Poppy app repo (`~/Projects/Poppy`) is **off limits**. Never open,
  read, grep, or run tools in it — even when a memory search, a user topic,
  or a "Nit" about a progress bar seems to point there. Ask the user first;
  Poppy work happens only in Poppy sessions.
- General rule: never leave this workspace's repo without explicit user
  confirmation. Memory hits and vague topics are not authorization to cross
  into another project.

## Install

```text
npm install taglib-wasm           # Node.js / Bun
import ... from "jsr:@charlesw/taglib-wasm"  # Deno (preferred)
```

## Quick Start

```typescript
// Simplest: read tags
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
console.log(tags.artist?.[0], tags.title?.[0]);

// Simplest: write tags
import { applyTagsToFile } from "taglib-wasm/simple";
await applyTagsToFile("song.mp3", { title: "New Title", artist: "New Artist" });
```

## Three APIs

| API        | Import                      | Memory                       | Best for                                          |
| ---------- | --------------------------- | ---------------------------- | ------------------------------------------------- |
| **Simple** | `taglib-wasm/simple`        | Automatic                    | One-off reads/writes, batch processing, cover art |
| **Full**   | `taglib-wasm`               | Manual (`using`/`dispose()`) | Complex operations, PropertyMap, ratings          |
| **Folder** | `taglib-wasm` (main export) | Automatic                    | Library scanning, duplicates, bulk updates        |

### Choosing an API

- **One file?** → Simple API: `readTags()`, `applyTagsToFile()`
- **Many files?** → Simple API: `readTagsBatch(files, { concurrency: 8 })` (10-20x faster)
- **Scan directory?** → Folder API: `scanFolder("/music", { recursive: true })`
- **PropertyMap / MusicBrainz / ReplayGain?** → Full API
- **Cover art?** → Simple API: `readCoverArt()`, `applyCoverArt()`
- **Ratings?** → Full API: `audioFile.getRating()`, `audioFile.setRating(0.8)`
- **Chapters?** → Full API: `audioFile.getChapters()`, `audioFile.setChapters([...])` (MP3 + MP4)
- **Broadcast metadata (BWF `bext`/iXML)?** → Full API: `audioFile.getBext()` / `setBext(...)` / `getIxml()` / `setIxml(...)` (WAV + FLAC)
- **Raw/vendor ID3v2 frames (RGAD, NCON, custom TXXX, …)?** → Full API: `audioFile.getId3v2Frames(id)` / `setId3v2Frames(id, data)` / `removeId3v2Frames(id)` (MP3 only)

## Simple API Reference

```typescript
import {
  applyCoverArt,
  applyTags,
  applyTagsToFile,
  readCoverArt,
  readMetadataBatch,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
} from "taglib-wasm/simple";

// Read
const tags = await readTags("song.mp3"); // { title?: string[], artist?: string[], ... }
const props = await readProperties("song.mp3"); // { duration, bitrate, sampleRate, channels, codec, isLossless }
const cover = await readCoverArt("song.mp3"); // Uint8Array | undefined

// Write
await applyTagsToFile("song.mp3", { title: "New" }); // Writes to disk
const buf = await applyTags("song.mp3", { title: "New" }); // Returns modified buffer
const buf2 = await applyCoverArt("song.mp3", imgData, "image/jpeg");

// Batch (10-20x faster than sequential)
const results = await readTagsBatch(files, { concurrency: 8 });
const metadata = await readMetadataBatch(files, { concurrency: 8 });
// Results: { items: [{ status: "ok", path, data } | { status: "error", path, error }] }
```

### Simple API Tag Shape

`readTags()` returns `ExtendedTag` — a superset of `Tag` with additional fields.

```typescript
// Base Tag
interface Tag {
  title?: string[];
  artist?: string[];
  album?: string[];
  comment?: string[];
  genre?: string[];
  year?: number;
  track?: number; // Note: numbers, not arrays
}

// ExtendedTag adds (all optional):
//   albumArtist, composer, conductor, copyright, isrc, lyricist: string[]
//   label, subtitle, producer: string[]
//   originalArtist, originalAlbum, originalDate: string[]
//   titleSort, artistSort, albumSort, albumArtistSort, composerSort: string[]
//   musicbrainzTrackId, musicbrainzReleaseId, musicbrainzArtistId, musicbrainzReleaseGroupId: string[]
//   releaseType: string[]  — release type (album, single, EP, ...); multi-value;
//     stored per format (TXXX "MUSICBRAINZ ALBUM TYPE" / freeform / APEv2
//     MUSICBRAINZ_ALBUMTYPE / ASF "MusicBrainz/Album Type" / Vorbis+Matroska raw)
//   acoustidFingerprint, acoustidId: string[]
//   replayGainTrackGain, replayGainTrackPeak: string[]
//   replayGainAlbumGain, replayGainAlbumPeak: string[]
//   r128TrackGain, r128AlbumGain: number  — EBU R128 loudness gain in dB
//     (RFC 7845); the wire value is a signed Q7.8 integer ("-573" =
//     -2.23828125 dB). readTags() converts int/256; a number you pass to
//     applyTags() is converted with round(dB*256) (lossless for values that
//     came from a file), a string[] passes the raw wire integer verbatim.
//   appleSoundCheck (iTunNORM), appleGaplessInfo (iTunSMPB): string[]
//   trackNumber: string | string[]  — RAW track field ("03", "3/12"); wins over
//     the numeric `track` on write, and is what makes readTags -> applyTags
//     round-trip without destroying a "/total" suffix
//   discNumber, totalTracks, totalDiscs, bpm: number
//   compilation: boolean
//   pictures: Picture[]; ratings, lyrics, chapters: array types
```

## Full API Reference

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize(); // Call once, reuse

// CRITICAL: Always use `using` for automatic cleanup (C++ objects aren't GC'd)
using audioFile = await taglib.open("song.mp3"); // Also accepts buffer, File, ArrayBuffer

// Read tags (properties, not methods)
const tag = audioFile.tag();
tag.title;
tag.artist;
tag.album;
tag.year;
tag.date; // Full release date (e.g. "1975-10-31"), the lossless companion to `year`. Same underlying tag at higher precision.
tag.track;
tag.genre;

// Write tags (setter methods, not property assignment)
tag.setTitle("New");
tag.setArtist("New");
tag.setAlbum("New");
tag.setYear(2024);
tag.setDate("1975-10-31"); // `year` resyncs to the leading year. `setDate("")` clears both date and year.
tag.setTrack(5);

// Audio properties (can be undefined — guard before dereferencing)
const props = audioFile.audioProperties();
if (!props) throw new Error("No audio properties");
props.duration;
props.bitrate;
props.sampleRate;
props.channels;
props.codec;
props.containerFormat;
props.isLossless;
props.bitsPerSample;
props.bitrateMode; // "CBR" | "VBR" | "ABR" | undefined (MP3 only)

// Save
audioFile.save(); // Returns boolean
const buffer = audioFile.getFileBuffer(); // Get modified data (throws FileOperationError if WASI path-mode read-back fails — never returns empty on failure)

// Convenience methods (open + edit + save + dispose in one call)
await taglib.edit("song.mp3", (file) => {
  file.tag().setTitle("New");
}); // Auto-saves to disk for paths, returns Uint8Array for buffers
await taglib.updateFile("song.mp3", { title: "New", artist: "New" }); // Shorthand

// PropertyMap (advanced metadata)
import { PROPERTIES } from "taglib-wasm"; // Type-safe property keys
const allProps = audioFile.properties(); // { albumArtist: ["..."], bpm: ["120"], ... }
audioFile.getProperty(PROPERTIES.musicbrainzTrackId.key);
audioFile.setProperty(PROPERTIES.replayGainTrackGain.key, "-3.5 dB");
audioFile.setProperties({ albumArtist: ["VA"], composer: ["Bach"] });

// Ratings (normalized 0.0-1.0)
audioFile.getRating(); // number | undefined
audioFile.setRating(0.8); // 4/5 stars
audioFile.setRating(0.8, "user@example.com");

// Chapters (MP3 ID3v2 CHAP; MP4 QuickTime track / Nero chpl)
audioFile.getChapters(); // Chapter[]: { startTimeMs, endTimeMs?, title?, id?, source? }
audioFile.setChapters([{ startTimeMs: 0, title: "Intro" }]); // replaces all
audioFile.setChapters([{ startTimeMs: 0, title: "Intro" }], {
  mp4ChapterStyle: "both",
});
audioFile.setChapters([]); // clears all chapters

// Opus: audioProperties() also exposes outputGainDb (OpusHead gain, RFC 7845)

// BWF bext + iXML (WAV/FLAC only); throws UnsupportedFormatError otherwise
audioFile.getBext(); // BroadcastAudioExtension | undefined (parsed EBU 3285 chunk)
// setBext takes a complete BroadcastAudioExtension — read-modify-write:
const bext = audioFile.getBext();
if (bext) audioFile.setBext({ ...bext, description: "Take 1" });
audioFile.getBextData(); // raw bext bytes | undefined; setBextData(null) removes
audioFile.getIxml(); // raw iXML string | undefined; setIxml(null) removes
// Also: import { bwf } from "taglib-wasm"; bwf.decodeBext(rawBytes) / bwf.encodeBext(obj)

// Raw ID3v2 frames (escape hatch, MP3 only): { id, data, flags? }[]
audioFile.getId3v2Frames("TXXX"); // every frame with this ID
const rgadBody = new Uint8Array([/* raw frame body bytes */]);
audioFile.setId3v2Frames("RGAD", [rgadBody]); // replaces ALL frames with this ID
audioFile.removeId3v2Frames("NCON"); // = setId3v2Frames("NCON", [])
// data excludes the 10-byte frame header; bytes round-trip verbatim for
// frames TagLib doesn't model. For modeled IDs (TIT2, APIC, ...): a typed
// getter sees a raw write only after save+reload, and a later save may
// re-normalize the bytes. A typed write to the same ID as an existing raw
// write is silently ignored until that raw frame is removed or the file is
// saved+reloaded (raw always wins within a save). flags is reserved for
// forward compat and is never populated on read (TagLib blanks header flags
// at render). On both backends, a raw write to an ID3v1-mapped ID
// (TIT2/TPE1/TALB/COMM/TCON/TDRC/TRCK) suspends ID3v1<->ID3v2 duplicate-sync
// on save() until that frame is removed.
```

### RatingUtils

```typescript
import { RatingUtils } from "taglib-wasm";
const { normalized, popm } = RatingUtils;

RatingUtils.toPopm(normalized(0.8)); // PopmRating(196)
RatingUtils.fromPopm(popm(196)); // NormalizedRating(0.8)
RatingUtils.toStars(normalized(0.8)); // 4
RatingUtils.fromStars(4); // NormalizedRating(0.8)
RatingUtils.toPercent(normalized(0.8)); // 80
```

## Folder API Reference

```typescript
import { scanFolder, updateFolderTags, findDuplicates, exportFolderMetadata } from "taglib-wasm";

// Scan (Deno/Node.js/Bun only)
const result = await scanFolder("/music", {
  recursive: true,
  extensions: [".mp3", ".flac"],
  onProgress: (processed, total, file) => { ... },
});
// result.items[]: { status, path, tags, properties?, hasCoverArt?, dynamics? }
// dynamics: { replayGainTrackGain?, replayGainAlbumGain?, appleSoundCheck? }

// Batch update
await updateFolderTags([
  { path: "/music/song.mp3", tags: { artist: "New" } },
]);

// Find duplicates
const dupes = await findDuplicates("/music", { criteria: ["artist", "title"] });

// Export
await exportFolderMetadata("/music", "./catalog.json");
```

### Album grouping (read-only)

`scanForAlbums` scans a folder and groups the result into albums with disc
subdivisions; `groupAlbums` is the pure, synchronous core over an existing
`scanFolder` result (runtime-agnostic — browsers included).

```typescript
import { groupAlbums, scanForAlbums } from "taglib-wasm";

const { albums, singles, unmatched, errors } = await scanForAlbums("/music", {
  recursive: true,
});

// albums[].discs[] — one per resolved disc number
// albums[].items[] — every file, each carrying its own resolution:
//   item.albumDir    — the album folder the file was attributed to
//   item.discNumber  — resolved disc (tag wins, folder is the fallback)
// albums[].directory — common album folder (for cover lookup)
// albums[].compilation — true/false from tag agreement (COMPILATION/TCMP/cpil),
//                        undefined when tags are absent or disagree
// singles[] — ok items whose resolved album has exactly one file
// unmatched[] — untagged files with no folder title evidence
// errors[] — per-file scan errors

// Pure core (no I/O): group any FolderScanResult
const grouped = groupAlbums(scanResult, {
  minFolderConfidence: "high", // drop weak folder disc evidence
  flatDiscPrefixes: true, // parse "1-01"/"101" filename discs
  folderFallback: true, // group untagged files by folder
});
```

Semantics: embedded tags are authority, folder/filename structure is evidence
(confidence tiers, sibling corroboration); a single-file album is a `single`,
not an album; per-file `albumDir`/`discNumber` is the resolution consumers key
UI and lint buckets by. Folder disc recognition covers `CD1`, `Disc One`,
`DVD 1`, `Album (Disc 1)`, `Volume 1`, `Bonus Disc` (gated), bare numbers, and
flat filename prefixes (`1-01`, `101`); plain `Bonus`/`Extras` are never discs.

Standalone recognizer (no resolve-to-parent semantics — the caller decides
what the parse means):

```typescript
import { discFolderInfo } from "taglib-wasm";

discFolderInfo("CD1"); // { kind: "exact", gated: false, number: 1, confidence: "high", ... }
discFolderInfo("Tape 4"); // { kind: "exact", gated: true,  number: 4, confidence: "low" }
discFolderInfo("Album (CD D)"); // { kind: "embedded", gated: true, number: undefined, title: "Album", ... }
discFolderInfo("Greatest Hits"); // undefined
```

Title-word markers (`tape`, `vinyl`, `cassette`, `lp`, `record`) and side
letters (`CD D`) are gated: they only act as disc evidence with sibling
corroboration, so real album titles like "Tape 4" are not misread as discs.

## Import Patterns

```typescript
// Deno (JSR — preferred)
import { TagLib } from "jsr:@charlesw/taglib-wasm";
import { readTags } from "jsr:@charlesw/taglib-wasm/simple";

// Deno (NPM)
import { TagLib } from "npm:taglib-wasm";

// Node.js / Bun
import { TagLib } from "taglib-wasm";
import { readTags } from "taglib-wasm/simple";

// Type imports
import type { AudioProperties, FolderScanResult, Tag } from "taglib-wasm";

// Error utilities
import {
  isFileOperationError,
  isTagLibError,
  isUnsupportedFormatError,
  TagLibError,
} from "taglib-wasm";
```

## Key Behaviors

**Runtime auto-detection**: WASI backend for Deno/Node.js (seek-based filesystem I/O).
Emscripten for browsers (loads full buffer). No configuration needed.

**Deno compile**: `TagLib.initialize()` auto-detects compiled mode. For custom Wasm
paths: `import { initializeForDenoCompile } from "taglib-wasm"`. For offline,
embed with `deno compile --allow-read --include taglib-web.wasm myapp.ts`.

**Memory**: Simple API auto-manages. Full API requires `using` (preferred) or `dispose()`.
WASI path mode (Deno/Node.js with file paths) uses ~1-2MB regardless of file size.
Buffer mode (browsers, or when passing Uint8Array) uses ~2x file size.

**Supported formats**: MP3 (ID3v1/v2), MP4/M4A, FLAC, OGG Vorbis, WAV, Opus, APE,
MPC, WavPack, TrueAudio, Matroska/WebM. Auto-detected from content.

**Tag mapping**: All format-specific tag names normalized to camelCase via `properties()`.
Example: ID3v2 `TPE2` / Vorbis `ALBUMARTIST` / iTunes `aART` → `albumArtist`.
**Read-side aliases** (taglib-7ru2): legacy wire names resolve to the canonical
property — `ALBUM ARTIST`/`ALBUM_ARTIST`→albumArtist, `ORGANIZATION`/`PUBLISHER`→label,
`UPC`/`EAN`/`GTIN`→barcode, `TOTALTRACKS`→totalTracks, `TOTALDISCS`→totalDiscs,
`MUSICBRAINZ_ALBUMTYPE`→releaseType, `CONTENTADVISORY`/`EXPLICIT`→itunesAdvisory.
**Content advisory** (taglib-an30): typed `advisory: "explicit" | "clean" | "unspecified"`
on `readTags()`/`applyTags()` — wire values `ITUNESADVISORY` "1"/"2"/"0". On MP4 the
value lives in the native `rtng` atom (0/1/2), bridged in C++ on both backends; other
formats use ITUNESADVISORY (TXXX/freeform/Vorbis/APE/ASF). `"unspecified"` clears the
representation (removes rtng + freeform atom on MP4, the TXXX frame/freeform/Vorbis
field elsewhere).
`DATE` is canonical; a `YEAR`-only file populates `year`/`date` on the typed surface
(properties() keeps the raw `YEAR` key), and a typed write canonicalizes it. Canonical
spelling wins when a file carries both; writes through setProperties normalize aliases.

## Error Handling

```typescript
try {
  using audioFile = await taglib.open(buffer);
} catch (error) {
  if (isUnsupportedFormatError(error)) { /* error.format */ }
  if (isFileOperationError(error)) { /* error.operation, error.path */ }
  if (isTagLibError(error)) { /* base error type */ }
}
```

Error types: `TagLibInitializationError`, `FileOperationError`, `UnsupportedFormatError`,
`InvalidFormatError`, `MemoryError`, `MetadataError`, `EnvironmentError`.

## Common Mistakes

| Mistake                       | Fix                                                                   |
| ----------------------------- | --------------------------------------------------------------------- |
| `TagLib.open(buffer)`         | `const taglib = await TagLib.initialize(); await taglib.open(buffer)` |
| `tag.getTitle()`              | `tag.title` (properties, not getter methods)                          |
| `tag.title = "New"`           | `tag.setTitle("New")` (setter methods, not assignment)                |
| Forgetting disposal           | Use `using audioFile = ...` for automatic cleanup                     |
| Processing files sequentially | Use batch APIs with `concurrency: 8`                                  |

## Initialization Options

```typescript
await TagLib.initialize(); // Default (auto)
await TagLib.initialize({ wasmUrl: "https://cdn.example/t.wasm" }); // CDN streaming
await TagLib.initialize({ wasmBinary: arrayBuffer }); // Embedded
await TagLib.initialize({ forceWasmType: "emscripten" }); // Force backend
```

## Recipes

### Read + Write Roundtrip (Full API)

```typescript
const taglib = await TagLib.initialize();

// Simplest: edit + auto-save in one call
await taglib.edit("song.mp3", (file) => file.tag().setTitle("Updated Title"));

// Or manual control:
using audioFile = await taglib.open("song.mp3");
audioFile.tag().setTitle("Updated Title");
await audioFile.saveToFile("song.mp3");
```

### Cover Art

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";
const cover = await readCoverArt("song.mp3");
const modified = await applyCoverArt("song.mp3", imageData, "image/jpeg");
```

### Batch Album Processing

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
const result = await readMetadataBatch(albumFiles, { concurrency: 8 });
for (const item of result.items) {
  if (item.status === "ok") {
    console.log(item.data.tags.title?.[0], item.data.properties?.duration);
  }
}
```

### Copy Tags Between Formats

```typescript
import { applyTagsToFile, readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");
await applyTagsToFile("song.flac", tags); // Format mapping is automatic
```

### Cloudflare Worker

```typescript
import { TagLib } from "taglib-wasm";
let taglib: Awaited<ReturnType<typeof TagLib.initialize>> | null = null;

export default {
  async fetch(request: Request): Promise<Response> {
    taglib ??= await TagLib.initialize();
    using file = await taglib.open(new Uint8Array(await request.arrayBuffer()));
    return Response.json({
      title: file.tag().title,
      artist: file.tag().artist,
    });
  },
};
```

### Browser File Input

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
const input = document.querySelector('input[type="file"]') as HTMLInputElement;
input.addEventListener("change", async (e) => {
  using audioFile = await taglib.open((e.target as HTMLInputElement).files![0]);
  console.log(audioFile.tag().title);
});
```

## Troubleshooting

| Error                            | Cause                | Fix                                          |
| -------------------------------- | -------------------- | -------------------------------------------- |
| "Module not initialized"         | Wasm not loaded      | Ensure `await TagLib.initialize()` completed |
| "Invalid audio file format"      | Bad/unsupported file | Check file content and size (>1KB)           |
| "Cannot read property of null"   | Used after dispose   | Check disposal order                         |
| "Failed to allocate memory"      | Leak or huge file    | Use `using` or check for missing `dispose()` |
| "WebAssembly.instantiate failed" | CORS or network      | Check Wasm URL and CORS headers              |

## Contributing

### Setup

```bash
git clone --recurse-submodules https://github.com/CharlesWiltgen/TagLib-Wasm.git
cd TagLib-Wasm
```

### Build & Test

```bash
deno task test              # Run the test suite (fast inner loop)
deno task check:all         # Full pre-push gate: fmt, lint, typecheck, tests, build:ts
deno task build             # Build TypeScript + both Wasm backends
deno task build:wasm        # Rebuild both Wasm backends
deno task build:wasm:wasi   # Rebuild WASI Wasm only (requires WASI SDK 33)
```

### Architecture

Two Wasm backends: **Emscripten** (browsers) and **WASI** (Deno/Node.js).
Auto-selected at runtime. Both wrap TagLib 2.3.1 C++ via a C boundary layer.

Key files: `build/taglib_embind.cpp` (Emscripten), `src/capi/taglib_shim.cpp` (WASI),
`src/capi/core/taglib_boundary.c` (C boundary), `src/taglib.ts` (core TS API).

Dependencies are git submodules: `lib/taglib`, `lib/mpack`, `lib/msgpack`.

### The dual-backend state model (read before adding a feature)

The two backends do not merely differ in packaging — they use **different state
models**, and that difference is the single largest source of subtle bugs in
this project. Every parity bug found so far is an instance of it.

**Emscripten is imperative.** JavaScript holds a live handle to a C++ object.
A write crosses into C++ immediately, and a subsequent read reflects it:

```ts
// src/taglib/embind-adapter.ts:91-99
setTagData(data) {
  const tw = raw.getTag();      // live C++ TagWrapper
  if (data.title !== undefined) tw.setTitle(data.title);  // applied now
}
```

**WASI is declarative.** C++ hands JavaScript a MessagePack _snapshot_. Writes
mutate a JS-side cache; nothing reaches C++ until `save()` ships the whole
snapshot back and C++ rebuilds the file from it:

```ts
// src/runtime/wasi-adapter/file-handle.ts:184-194
setTagData(data) {
  const merged = { ...this.tagData, ...data };  // JS object, line 105
  this.tagData = merged;                        // nothing crossed to C++
}
// ...and only at save() (:161):
writeTagsToWasm(this.wasi, this.fileData, this.tagData);
```

**The consequence.** "Write, then ask" can legitimately give different answers
per backend. Emscripten reports the live object; WASI reports whatever the
cache or the file says. Neither is wrong — they are different models — but code
written against one silently misbehaves on the other.

#### Where the abstraction leaks

- **Immediate vs. deferred reads.** The recurring trap. `taglib-y91`:
  `hasID3v1Tag()` checked a C++ location on Emscripten and a cache field on
  WASI — same name, different semantics. TagLib 2.3.1 introduced a fresh
  instance upstream: FLAC's `hasBEXTData()`/`hasiXMLData()` changed from
  reporting in-memory payload to on-disk block presence, so a read between
  `setBext()` and `save()` now answers differently.
- **Asymmetric write paths.** WASI's `apply_propmap`
  (`src/capi/taglib_shim.cpp:548-560`) calls `setProperties()` _and then_
  writes `TITLE`/`ARTIST`/`ALBUM` again through `file->tag()`. The Embind path
  writes only through the tag. On files carrying two tag types, a double-write
  through a `TagUnion` can reach tags the other backend never touches.
- **Write-time directives riding the tag snapshot.** WASI has no side channel,
  so control flags travel as `_`-prefixed pseudo-tags: `_mp4ChapterStyle`
  (`file-handle.ts:458` → `taglib_chapters.cpp:254`) and `_stripId3`
  (`file-handle.ts:506-519` → `taglib_id3_strip.cpp:66`). They are filtered
  from real tag data by allowlists (`src/msgpack/encoder.ts:24`,
  `file-handle.ts:54`). Emscripten needs no equivalent. See `taglib-7gs`.
- **Optimistic cache updates.** Because WASI cannot ask C++ mid-session, some
  writes update the cache to predict what C++ will do. When the prediction is
  wrong, the backends diverge until save/reopen.
- **Staging to imitate the other model.** It runs both directions —
  `embind-adapter.ts:74-76` keeps a `stagedId3v2Frames` mirror so the
  imperative side can present deferred-style semantics.

#### Rules when adding or changing an `AudioFile` method

1. Implement it on **both** backends, or make it fail loudly on the one that
   lacks it. Silent no-ops are how `taglib-nc5` happened.
2. Add a parity test that runs the **same scenario** on both backends —
   `forEachBackend()` / `BackendAdapter` (`tests/backend-adapter.ts:435`), or
   a loop over `TagLib.initialize({ forceWasmType })`. A test with no
   `forceWasmType` exercises WASI only on Deno, which is _not_ parity coverage.
3. Prefer one seed-then-assert scenario looped over both backends, so the test
   can actually fail on divergence.
4. Decide explicitly whether a read reflects **staged** or **saved** state, and
   make both backends agree. Most parity bugs are an unexamined answer here.
5. Update `tests/PARITY-COVERAGE.md`, the per-method × backend matrix.

See `.claude/rules/testing-patterns.md` for the testing requirement itself.

#### Regression tests must be observed failing

Two traps from the 1.6.1 cycle, each of which produced tests that could never
fail:

1. **A test written after its fix, verified only by "it is green".** That
   proves the test agrees with current behavior, not that it detects the
   defect. The worst case certified data loss for a full review round: a guard
   asserted a COMM frame _count_ that the broken path also satisfied while it
   destroyed the frame's payload. A regression test must be **observed
   failing** against the defect — write it first, or mutation-verify it
   afterwards by reverting the fix. Corollary: assert what the defect actually
   destroys, not a proxy for it.
2. **A parity instance that cannot fail.** Tests here loop over
   `["wasi", "emscripten"]`. When a defect is one-backend, the other backend's
   instance is a _baseline_ asserting cross-backend agreement, not a guard —
   yet both render identically as `ok`, so the suite reads as double the
   coverage it has. Label a baseline instance as such (a comment suffices),
   and never pin an expectation to a known-broken value: a test asserting the
   defect can only fail once somebody fixes the bug.

Mechanical note: tests load the prebuilt `build/*.wasm`, so reverting C++
source proves nothing without a rebuild. Mutation-verifying C++ means either
rebuilding (~5 min per backend) or swapping in a binary from a commit that
genuinely predates the fix — verify it by hash, because binaries are sometimes
staged in a different commit than the source change they carry.

See `CONTRIBUTING.md` for full contributor guide.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git add <files>
   git commit -m "..."
   git push
   ```

<!-- END BEADS INTEGRATION -->
