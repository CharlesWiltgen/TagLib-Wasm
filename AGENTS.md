# TagLib-Wasm — AI Agent Reference

WebAssembly build of TagLib for reading/writing audio metadata in JS/TS.
Works in Deno, Node.js, Bun, browsers, and Cloudflare Workers.

## Install

```text
npm install taglib-wasm           # Node.js / Bun
import ... from "npm:taglib-wasm"  # Deno (npm specifier)
import ... from "jsr:@charlesw/taglib-wasm"  # Deno (JSR)
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
- **A stable fingerprint of the audio (survives tag edits, with one FLAC
  boundary)?** → Simple API: `readMediaChecksum()`
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
  readMediaChecksum,
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

// Media checksum: the encoded media payload's SHA-256 — the bytes that ARE the
// audio, not the tags around them, so it survives a tag edit (both backends),
// except in one documented case — see below.
const sum = await readMediaChecksum("song.mp3");
// { algorithm: "sha256", hex, bytesHashed, source: "audio-payload" | "file" }
// source: "audio-payload" is the strong guarantee: editing a tag leaves `hex`
// unchanged — with one boundary: an ID3v2 tag appended after a FLAC's audio is
// inside its payload, so editing THAT tag moves `hex`. A format whose payload
// cannot be delimited answers the WHOLE FILE with source: "file", where a tag
// edit does move the hash. basis: "pcm" asks FLAC for its STREAMINFO MD5
// instead ({ algorithm: "md5", source: "flac-streaminfo-md5" }) and throws
// UnsupportedFormatError off FLAC. Per-format shape table (which files get
// which source, incl. the MP3 re-mux caveat and the 64 KiB scan bound):
// docs/api/index.md § "Which container shapes get which `source`".
const pcm = await readMediaChecksum("song.flac", { basis: "pcm" });

// The checksum types, from "taglib-wasm/simple" or "taglib-wasm" as a type-only
// import: MediaChecksum (the discriminated result union), MediaChecksumOptions
// ({ basis?: "encoded" | "pcm" }), ChecksumSource (MediaChecksum["source"]) and
// ChecksumAlgorithm (MediaChecksum["algorithm"]) — so a consumer can hold the
// literals without restating them.

// Write
await applyTagsToFile("song.mp3", { title: "New" }); // Writes to disk
const buf = await applyTags("song.mp3", { title: "New" }); // Returns modified buffer
const buf2 = await applyCoverArt("song.mp3", imgData, "image/jpeg");

// Batch (10-20x faster than sequential)
const results = await readTagsBatch(files, { concurrency: 8 });
const metadata = await readMetadataBatch(files, { concurrency: 8 });
// Batch writes: same BatchOptions contract (concurrency, continueOnError,
// onProgress, signal). Per-file ok/error items in input order; a failed file
// is left in its pre-write state (atomic temp-file saves); abort is honored
// between files, never mid-save. WriteTagUpdate = { path, tags?, properties? }
// — `tags` is the typed merge; `properties` is a raw WIRE-key map with the
// SAME shape and rule as the Full API's setProperties (empty array removes
// the key; no empty-string carrier). Both apply in ONE save. A duplicate
// path applies the last update; an update with no fields still re-saves.
await writeTagsBatch([
  { path: "song.mp3", tags: { title: "New" } },
  {
    path: "song.flac",
    tags: { artist: ["A", "B"] },
    properties: { BARCODE: ["LC1234"], COMPILATION: [], PUBLISHER: [] },
  },
]);
// Mutator-callback variant (Full-API style per-file edits, auto-saved). The
// mutator receives (audioFile, path) — the path it was opened from, a
// per-invocation contract, so precomputed per-path plans need no order
// coupling; a one-argument mutator keeps working:
await editTagsBatch(["/music/a.mp3", "/music/b.mp3"], (file, path) => {
  file.tag().setTitle(plans.get(path)!.title);
});
// Extra wire keys outside the typed set: readTags/readTagsBatch/readMetadata/
// readMetadataBatch accept { includeProperties: ["CATALOGNUMBER", ...] } (WIRE
// keys); the per-item result carries them in `data.extraProperties` (or
// `data.tags.extraProperties` for metadata) — raw string[] under their exact
// wire names, absent keys omitted. Read-only: applyTags never writes it back.
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
//   releaseCountry: string[]  — ISO 3166-1 release country (TXXX
//     "MUSICBRAINZ ALBUM RELEASE COUNTRY" / MP4 freeform / APEv2 raw / ASF /
//     WAV ICNT / Vorbis+Matroska raw)
//   releaseStatus: string[]  — release status (official, promotion, bootleg, ...);
//     stored per format (TXXX "MUSICBRAINZ ALBUM STATUS" / freeform / APEv2
//     MUSICBRAINZ_ALBUMSTATUS / ASF "MusicBrainz/Album Status" / Vorbis+Matroska raw)
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

// Media checksum: the same digest as the Simple API's readMediaChecksum(), from
// an already-open handle. Returns `MediaChecksum` — { algorithm, hex,
// bytesHashed, source }, where `source` is a `ChecksumSource`. The file's bytes
// are what get hashed, never the handle's partial-load window image; pass
// `MediaChecksumOptions` ({ basis: "pcm" }) for FLAC's STREAMINFO MD5, which
// throws UnsupportedFormatError on anything else. `ChecksumAlgorithm` is the
// digest name ("sha256" for the payload, "md5" for STREAMINFO).
const sum = await audioFile.mediaChecksum(); // { algorithm: "sha256", hex, bytesHashed, source: "audio-payload" | "file" }

// Convenience methods (open + edit + save + dispose in one call)
await taglib.edit("song.mp3", (file) => {
  file.tag().setTitle("New");
}); // Auto-saves to disk for paths, returns Uint8Array for buffers
await taglib.updateFile("song.mp3", { title: "New", artist: "New" }); // Shorthand

// PropertyMap (advanced metadata)
import { PROPERTIES } from "taglib-wasm"; // Type-safe property keys
const allProps = audioFile.properties(); // { albumArtist: ["..."], bpm: ["120"], ... }
audioFile.getProperty(PROPERTIES.musicbrainzTrackId.key); // string[] | undefined
audioFile.setProperty(PROPERTIES.replayGainTrackGain.key, "-3.5 dB");
audioFile.removeProperty(PROPERTIES.replayGainTrackGain.key); // clears
audioFile.setProperties({ albumArtist: ["VA"], composer: ["Bach"] });

// Clearing contract: writing an EMPTY value removes the
// property — setProperty(key, "") and removeProperty(key) are equivalent on
// both backends (WASI's setProperties is replace-style; an absent/empty key
// removes). Empty-string values are NOT stored.

// Tag shape contract: tag READS are arrays everywhere —
// readTags/readTagsBatch/scanFolder, properties(), and getProperty() all
// return string[] (undefined = absent). Scalars exist only in the typed
// accessors (tag().title) and the write side (setProperty takes a single
// value; use setProperties for multi). First-value idiom: getProperty(k)?.[0].

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
import { exportFolderMetadata, findDuplicates, scanFolder } from "taglib-wasm";
// Batch writes live in the Simple API (writeTagsBatch / editTagsBatch), the
// single batch-write convention; the Folder API's updateFolderTags was
// removed in their favor.
```

```typescript
// Scan (Deno/Node.js/Bun only)
const result = await scanFolder("/music", {
  recursive: true,
  extensions: [".mp3", ".flac"],
  onProgress: (processed, total, file) => { ... },
});
// result.items[]: { status, path, tags, properties?, hasCoverArt?, dynamics? }
// dynamics: { replayGainTrackGain?, replayGainAlbumGain?, appleSoundCheck? }

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
what the parse means). The grammar is PURE — no Wasm, no runtime deps — and is
declared as such: import it from the dedicated `taglib-wasm/disc-folder`
subpath (also exports the pure `groupAlbums` core and its types), which CI
verifies stays dependency-free. Browser/UI consumers must use
the subpath rather than the main entry:

```typescript
import { discFolderInfo } from "taglib-wasm/disc-folder";

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
// Deno (npm specifier)
import { TagLib } from "npm:taglib-wasm";
import { readTags } from "npm:taglib-wasm/simple";

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

The barrel is tree-shaken to leaf granularity by esbuild, rollup, vite, and
webpack — importing `TagLib` does not pull in the Folder or Web API, and
`index` vs `simple` is not a size lever (both are ~80 KB in a browser bundle,
~144 KB in a Node bundle). `./folder` is Node-only in a browser build (it walks
a filesystem; a loud build error is the contract); `./web` has its own `browser`
condition and builds there, resolving `taglib-web.wasm` alone. The browser
entries (`index.browser.ts`, `simple.browser.ts`, `web.browser.ts`) must export
every browser-capable Node export and no others — `tests/browser-entry-surface.test.ts`
holds the classification. `"sideEffects": false` is set. Measured numbers, the
exact bundler invocations, and the method: README § "Bundle Size and
Tree-Shaking".

## Key Behaviors

**Runtime auto-detection**: WASI backend for Deno/Node.js (seek-based filesystem I/O).
Emscripten for browsers (loads full buffer). No configuration needed.

**Deno compile**: `TagLib.initialize()` auto-detects compiled mode. For custom Wasm
paths: `import { initializeForDenoCompile } from "taglib-wasm"`. For offline,
embed with `deno compile --allow-read --include taglib-web.wasm myapp.ts`.

**Memory**: Simple API auto-manages. Full API requires `using` (preferred) or `dispose()`; a best-effort
FinalizationRegistry also releases a forgotten handle when its wrapper is garbage-collected, but that path
is non-deterministic — explicit disposal is still the contract.
WASI path mode (Deno/Node.js with file paths) uses ~1-2MB regardless of file size.
Buffer mode (browsers, or when passing Uint8Array) uses ~2x file size.

**Supported formats**: MP3 (ID3v1/v2), ADTS/raw AAC, MP4/M4A, FLAC, OGG (Vorbis,
FLAC, Speex), WAV (incl. RF64/BW64), Opus, APE, MPC, WavPack, TrueAudio,
Matroska/WebM. Auto-detected from content.

**Tag mapping**: All format-specific tag names normalized to camelCase via `properties()`.
Example: ID3v2 `TPE2` / Vorbis `ALBUMARTIST` / iTunes `aART` → `albumArtist`.
**Read-side aliases**: legacy wire names resolve to the canonical
property — `ALBUM ARTIST`/`ALBUM_ARTIST`→albumArtist, `ORGANIZATION`/`PUBLISHER`→label,
`UPC`/`EAN`/`GTIN`→barcode, `TOTALTRACKS`→totalTracks, `TOTALDISCS`→totalDiscs,
`MUSICBRAINZ_ALBUMTYPE`→releaseType, `MUSICBRAINZ_ALBUMSTATUS`→releaseStatus,
`CONTENTADVISORY`/`EXPLICIT`→itunesAdvisory.
**Content advisory**: typed `advisory: "explicit" | "clean" | "unspecified"`
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
  if (isUnsupportedFormatError(error)) {
    /* error.format */
  }
  if (isFileOperationError(error)) {
    /* error.operation, error.path */
  }
  if (isTagLibError(error)) {
    /* base error type */
  }
}
```

Error types: `TagLibInitializationError`, `FileOperationError`, `UnsupportedFormatError`,
`InvalidFormatError`, `MemoryError`, `MetadataError`, `EnvironmentError`.

## Common Mistakes

| Mistake                       | Fix                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `TagLib.open(buffer)`         | `const taglib = await TagLib.initialize(); await taglib.open(buffer)`                                                                |
| `tag.getTitle()`              | `tag.title` (properties, not getter methods)                                                                                         |
| `tag.title = "New"`           | `tag.setTitle("New")` (setter methods, not assignment)                                                                               |
| Forgetting disposal           | Use `using audioFile = ...` for automatic cleanup (a FinalizationRegistry safety net exists, but explicit disposal is deterministic) |
| Processing files sequentially | Use batch APIs with `concurrency: 8`                                                                                                 |

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

`pnpm` is the package manager: `package.json` pins it via the `packageManager`
field and `pnpm-lock.yaml` is the lockfile — run `pnpm install` first, because
`vp` loads `vite.config.ts` strictly and aborts without the `vite-plus`
devDependency installed. `pnpm-workspace.yaml` omits `packages` on purpose: only
the root project is a workspace member, and `docs/` stays a standalone pnpm
project with its own lockfile (`docs/pnpm-lock.yaml`).

```bash
pnpm install              # Install dependencies (required before any `vp` command)
pnpm run check:all        # EVERY gate, in one command (see the note below)
pnpm exec vp check        # Format + lint gates (oxlint, type-aware rules)
pnpm exec vp test         # Tests (Vitest): 105 files across tests/ and src/
pnpm exec tsc --noEmit -p tsconfig.check.json   # Type gate (includes tests/)
pnpm exec tsc --noEmit -p tsconfig.examples.json # Examples type gate
pnpm run check:examples   # Examples gate: resolution, run, working-tree guard
pnpm run build:ts         # Bundle gate: catches bundler-resolution breaks
pnpm run build:wasm       # Rebuild both Wasm backends
pnpm run build:wasm:wasi  # Rebuild WASI Wasm only (requires WASI SDK 34)
```

**Which tool runs what.** pnpm owns this project's dependency graph, its
lockfiles, and script/`exec` invocations. npm remains, deliberately, the
_registry client_ and _consumer proxy_: `npm pack` (`scripts/check-package-files.sh`,
`scripts/release-safe.sh`), `npm publish` / `npm view` (the release path's OIDC
trusted publishing is verified against the npm CLI), `npm install -g` for global
CLI tools (`binaryen`, `ast-grep` — npm's global bin dir is on PATH on every
runner, pnpm's is not), and `npm install` inside scratch dirs that simulate an
npm consumer (`scripts/verify-published.mjs`, `scripts/test-npm-package.sh`).
Don't "fix" those to pnpm.

`pnpm run check:all` is the authoritative gate: it runs format, lint, ast-grep,
docs coverage, knip, the type check, the tests, the bundle, the emitted-tree
resolution and Wasm-free guards, and the toolchain pins. The commands above are
the individual gates for iterating — if you change the gate set, change
`check:all`, not this list. `pnpm exec vpr static` is the cached commit-time
subset (format + lint).

`pnpm exec vp test` is a **Vite+ built-in**, not the `test` script; use
`pnpm test` (short for the script) to run the script itself.

`pnpm run build:ts` builds the shippable bundles. Run it before pushing: it
catches bundler-resolution breaks — e.g. a JSR import that isn't an npm
dependency — that pass the test suite but break the published package.

**What actually ships.** The published package is `dist/` plus `package.json`,
`README.md`, `LICENSE`, `NOTICE` and `legal/COPYING.LGPL` — nothing else: neither
`src/` nor `AGENTS.md` is
published. (`LICENSE` is the MIT text only, so GitHub detects the license;
`NOTICE` and `legal/COPYING.LGPL` carry the LGPL notice and text for the
compiled TagLib in the Wasm binaries.)
`package.json` `files` (plus npm's own auto-includes) decides what the
registry receives; `scripts/check-package-files.sh` pins that allowlist _and_ the
packed file set, and the Publish workflow's "Prepare publish directory" steps
must stage every one of those files. Staging extras is harmless — npm filters
them at pack time — but _omitting_ one is silent, which is why
`scripts/verify-published.mjs` asserts the installed tree carries them and why
the build-artifacts upload lists the same set. When those agree, `npm pack`
produces exactly the published artifact, which is what makes local install tests
meaningful. `node scripts/verify-published.mjs <dir|tarball|version> [version]`
runs the artifact probes (both wasm backends under Node, plus path-mode reads and
the shipped-Wasm resolver under Deno); the Publish workflow runs it on
`publish-dir` _before_ the PUT and again from the registry afterwards.

**The action artifacts are hand-offs, so they expire in a day.** Every
`upload-artifact` step in `ci.yml` sets `retention-days: 1`: `embind-build`,
`wasi-build` and `wasi-fresh-reference` are consumed by jobs in the same run
(`download-artifact`), and `coverage-lcov` exists for a human download —
SonarCloud computes its own lcov. Published bytes ship through npm/JSR/GitHub
Releases, not through these, and the 90-day default had left 837 artifacts
(476 MB) of superseded builds behind by 2026-10-12. A day covers the hand-off
and a same-day rerun. `retention-days` is an `upload-artifact` input, not a
workflow-level key — at the top level GitHub fails the workflow's validation
run with no jobs and no logs, which reads as an unexplained red X.

**One test suite.** `pnpm exec vp test` covers all 105 test files under `tests/`
and `src/`. The only exclusions are `tests/bun-integration.test.ts` (registered
with `bun:test`, run via `pnpm run test:bun`), `tests/cross-runtime/**` (run
under three runtimes via `tests/cross-runtime/run.sh`) and `tests/deno-*.test.ts`
(Deno's own runner, via `pnpm run test:deno`).

**Deno** is no longer the dev toolchain for formatting, linting or type checking,
and the build pipeline does not require it: the bundles are produced by `vp pack`
(configured in `vite.config.ts`), `scripts/postbuild.mjs` runs under `node`, and
the auxiliary `.ts` scripts run under `pnpm exec tsx`. Deno is still needed for
the Deno runtime test leg (`pnpm run test:deno`; the Deno arm of
`tests/cross-runtime/run.sh`) and for the JSR legs of the release workflow
(`publish-jsr` and `verify-jsr` in `publish-everywhere.yml`, OIDC-authenticated;
the package manifest is `jsr.json`, and `scripts/check-jsr-package-files.sh`
pins the file set a publish ships).

### Architecture

Two Wasm backends: **Emscripten** (browsers) and **WASI** (Deno/Node.js).
Auto-selected at runtime. Both wrap TagLib 2.3.2 C++ via a C boundary layer.

Key files: `build/taglib_embind.cpp` (Emscripten), `src/capi/taglib_read.cpp` +
`src/capi/taglib_write.cpp` (WASI halves, shared `taglib_shim_common.cpp`),
`src/capi/core/taglib_boundary.c` (C boundary), `src/taglib.ts` (core TS API).

Dependencies are git submodules: `lib/taglib`, `lib/mpack`. (The C
`lib/msgpack` submodule was removed with the orphan Emscripten C-API path;
the WASI backend speaks MessagePack through `lib/mpack`, and the
TS side has its own encoder/decoder in `src/msgpack/`.)

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

- **Immediate vs. deferred reads.** The recurring trap:
  `hasID3v1Tag()` checked a C++ location on Emscripten and a cache field on
  WASI — same name, different semantics. TagLib 2.3.1 introduced a fresh
  instance upstream: FLAC's `hasBEXTData()`/`hasiXMLData()` changed from
  reporting in-memory payload to on-disk block presence, so a read between
  `setBext()` and `save()` now answers differently.
- **Asymmetric write paths.** WASI's `apply_propmap`
  (`src/capi/taglib_write.cpp`) calls `setProperties()` _and then_
  writes `TITLE`/`ARTIST`/`ALBUM` again through `file->tag()`. The Embind path
  writes only through the tag. On files carrying two tag types, a double-write
  through a `TagUnion` can reach tags the other backend never touches.
- **Write-time directives riding the tag snapshot.** WASI has no side channel,
  so control flags travel as `_`-prefixed pseudo-tags: `_mp4ChapterStyle`
  (`file-handle.ts:458` → `taglib_chapters.cpp:254`) and `_stripId3`
  (`file-handle.ts:506-519` → `taglib_id3_strip.cpp:66`). They are filtered
  from real tag data by allowlists (`src/msgpack/encoder.ts:24`,
  `file-handle.ts:54`). Emscripten needs no equivalent.
- **Optimistic cache updates.** Because WASI cannot ask C++ mid-session, some
  writes update the cache to predict what C++ will do. When the prediction is
  wrong, the backends diverge until save/reopen.
- **Staging to imitate the other model.** It runs both directions —
  `embind-adapter.ts:74-76` keeps a `stagedId3v2Frames` mirror so the
  imperative side can present deferred-style semantics.

#### Rules when adding or changing an `AudioFile` method

1. Implement it on **both** backends, or make it fail loudly on the one that
   lacks it. Silent no-ops are how backend-specific bugs hide.
2. Add a parity test that runs the **same scenario** on both backends —
   `forEachBackend()` / `BackendAdapter` (`tests/backend-adapter.ts:435`), or
   a loop over `TagLib.initialize({ forceWasmType })`. Without `forceWasmType`
   the detector selects the WASI backend, so such a test is _not_ parity coverage.
3. Prefer one seed-then-assert scenario looped over both backends, so the test
   can actually fail on divergence.
4. Decide explicitly whether a read reflects **staged** or **saved** state, and
   make both backends agree. Most parity bugs are an unexamined answer here.
5. Update `tests/PARITY-COVERAGE.md`, the per-method × backend matrix.

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

See `.github/CONTRIBUTING.md` for full contributor guide.
