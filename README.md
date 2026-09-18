# TagLib-Wasm

[![Tests](https://github.com/CharlesWiltgen/TagLib-Wasm/actions/workflows/ci.yml/badge.svg)](https://github.com/CharlesWiltgen/TagLib-Wasm/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![npm downloads](https://img.shields.io/npm/dm/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/LICENSE)
<br>[![Built with](https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=f5f5f5)](https://www.typescriptlang.org/)
[![Built with Emscripten](https://img.shields.io/badge/Built%20with-Emscripten-4B9BFF.svg)](https://emscripten.org/)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0.svg?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Built with TagLib](https://img.shields.io/badge/Built%20with-TagLib-brightgreen.svg)](https://taglib.org/)
<br>[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Deno](https://img.shields.io/badge/Deno-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Electron (Node.js)](https://img.shields.io/badge/Electron%20%28Node.js%29-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Browsers](https://img.shields.io/badge/Browsers-E34C26?logo=html5&logoColor=white)](https://html.spec.whatwg.org/multipage/)

TagLib-Wasm is the **universal tagging library for TypeScript/JavaScript**
(TS|JS) platforms: **Node.js**, **Deno**, **Bun**, **Cloudflare Workers**,
**Electron** (via Node.js), and **browsers**.

## Features

- **Local filesystem support** – On Node.js and Deno, WASI enables seek-based
  I/O that reads only headers and tags from disk — not entire files
- **Automatic runtime optimization** – Auto-selects WASI (server) or Emscripten
  (browser) for optimal performance with no configuration
- **Full audio format support** – Supports all audio formats supported by TagLib
- **TypeScript first** – Complete type definitions and modern API
- **Wide TS/JS runtime support** – Node.js, Deno, Bun, Electron (Node.js),
  Cloudflare Workers, and browsers
- **Format abstraction** – Handles container format details automatically when
  possible
- **Rich metadata** – Cover art, ratings, chapters (MP3 `CHAP`, MP4
  QuickTime/Nero), and broadcast metadata (BWF `bext`/iXML for WAV/FLAC)
- **Value fidelity** – Tag values round-trip verbatim: a `"3/12"` track or a
  zero-padded `"03"` is preserved, and MP4 freeform atoms keep their exact
  casing and vendor `mean`, so other tools still recognise them
- **Zero dependencies** – Self-contained Wasm bundle
- **Tested** – 448 tests across all formats, with cross-backend parity coverage
- **Two API styles** – Use the "Simple" API (3 functions), or the full "Core"
  API for more advanced applications
- **Batch folder operations** – Scan directories, process multiple files, find
  duplicates, and export metadata catalogs

## Installation

### Node.js

```bash
npm install taglib-wasm
```

> **Note:** Requires Node.js v24 or higher (the Active LTS line) for WASI and
> WebAssembly exception handling support. To consume the package as TypeScript source
> (e.g., via `tsx`), see the
> [installation guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/installation.html).

### Deno

```typescript
import { TagLib } from "@charlesw/taglib-wasm";
```

### Bun

```bash
bun add taglib-wasm
```

### Electron (Node.js)

```bash
npm install taglib-wasm
```

taglib-wasm works in Electron's main process (which is Node.js). For the
renderer process, expose metadata through IPC:

```typescript
// Main process
import { TagLib } from "taglib-wasm";
```

See [Platform Examples](docs/guide/platform-examples.md#electron) for full IPC
setup.

### Deno Compiled Binaries (Offline Support)

For Deno compiled binaries that need to work offline, you can embed the WASM
file:

```typescript
// 1. Prepare your build by copying the WASM file
import { prepareWasmForEmbedding } from "@charlesw/taglib-wasm";
await prepareWasmForEmbedding("./taglib-web.wasm");

// 2. In your application, use the helper for automatic handling
import { initializeForDenoCompile } from "@charlesw/taglib-wasm";
const taglib = await initializeForDenoCompile();

// 3. Compile with the embedded WASM
// deno compile --allow-read --include taglib-web.wasm myapp.ts
```

See the
[complete Deno compile guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/deno-compile.html)
for more options including CDN loading.

`prepareWasmForEmbedding` and `initializeForDenoCompile` resolve a Deno main
module and file paths, so they belong to the Node/Deno entry: they are absent
from the `browser` condition, and a browser-targeted build reports them as
missing exports — the section below, "Bundle Size and Tree-Shaking", shows how
to get that as a TypeScript error instead of a bundler error. `isDenoCompiled`,
the `typeof Deno` probe under them, is exported by both: in a browser it answers
`false`.

For manual control:

```typescript
// Load embedded WASM in compiled binaries
const wasmBinary = await Deno.readFile(
  new URL("./taglib-web.wasm", import.meta.url),
);
const taglib = await TagLib.initialize({ wasmBinary });
```

Supplying `wasmBinary` selects the Emscripten backend (the bytes above are
`taglib-web.wasm`, its artifact). The WASI backend loads from a filesystem
path or URL instead — use `wasmUrl` with it.

## Quick Start

> **Import paths:** Deno uses `@charlesw/taglib-wasm`, npm uses `taglib-wasm`.
> Examples below use npm paths — substitute accordingly.

### Simple API

```typescript
import { applyTags, applyTagsToFile, readTags } from "taglib-wasm/simple";

// Read tags (string fields are arrays to support multi-value metadata)
const tags = await readTags("song.mp3");
console.log(tags.title?.[0], tags.artist?.[0], tags.album?.[0]);

// Apply tags and get modified buffer (in-memory)
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Or update tags on disk (requires file path)
await applyTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### High-Performance Batch Processing

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Process multiple files in parallel
const files = ["track01.mp3", "track02.mp3", /* ... */ "track20.mp3"];

// Read just tags (18x faster than sequential)
const tags = await readTagsBatch(files, { concurrency: 8 });

// Read complete metadata including cover art detection (15x faster)
const metadata = await readMetadataBatch(files, { concurrency: 8 });

// Real-world performance:
// Sequential: ~100 seconds for 20 files
// Batch: ~5 seconds for 20 files (20x speedup!)
```

### Full API

The Full API might be a better choice for apps and utilities focused on advanced
metadata management.

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (automatically cleaned up when scope exits)
using file = await taglib.open("song.mp3");

// Read and update metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");

// Save changes
file.save();
```

### Batch Folder Operations

Process entire music collections efficiently:

```typescript
import { findDuplicates, scanFolder, scanForAlbums } from "taglib-wasm";

// Scan a music library
const result = await scanFolder("/path/to/music", {
  recursive: true,
  onProgress: (processed, total, file) => {
    console.log(`Processing ${processed}/${total}: ${file}`);
  },
});
console.log(`Found ${result.items.length} audio files`);
console.log(
  `Successfully processed ${
    result.items.filter((i) => i.status === "ok").length
  } files`,
);

// Process results (narrow the ok/error union first)
for (const file of result.items) {
  if (file.status !== "ok") continue;
  console.log(
    `${file.path}: ${file.tags.artist?.[0]} - ${file.tags.title?.[0]}`,
  );
  console.log(`Duration: ${file.properties?.duration}s`);
}

// Find duplicates
const duplicates = await findDuplicates("/path/to/music", {
  criteria: ["artist", "title"],
});
console.log(`Found ${duplicates.length} groups of duplicates`);

// Group into albums with disc subdivisions (tags are authority, folder
// names are evidence)
const { albums, singles, unmatched } = await scanForAlbums("/path/to/music");
for (const album of albums) {
  console.log(
    `${
      album.albumArtist ?? ""
    } - ${album.album}: ${album.discs.length} disc(s)`,
  );
}
console.log(`${singles.length} singles, ${unmatched.length} unmatched`);
```

The disc-folder grammar (`discFolderInfo`) and the pure `groupAlbums` core are
Wasm-free — import them from the dedicated subpath in browser/UI contexts
(no TagLib runtime is loaded):

```typescript
import { discFolderInfo, groupAlbums } from "taglib-wasm/disc-folder";
```

`scanFolder`, `scanForAlbums`, `findDuplicates` and `exportFolderMetadata` read
and write a filesystem, so they are **Node/Deno/Bun-only**, and so is the
`taglib-wasm/folder` subpath that exports them: it declares no `browser`
`exports` condition, which makes a browser-targeted build fail loudly (esbuild:
`Could not resolve "node:fs/promises"`). That failure is deliberate — a browser
stub that threw at runtime would move the same mistake from build time to the
first call in production. In a browser, scan on a server and post the result:
`groupAlbums` and `discFolderInfo` are exported from both `taglib-wasm` and
`taglib-wasm/disc-folder` and run anywhere.

### Working with Cover Art

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";

// Extract cover art
const coverData = await readCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set new cover art
const imageData = await Deno.readFile("new-cover.jpg");
const modifiedBuffer = await applyCoverArt("song.mp3", imageData, "image/jpeg");
// Save modifiedBuffer to file if needed
```

### Working with Ratings

```typescript
import { RatingUtils, TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("song.mp3");

// Read rating (normalized 0.0-1.0)
const rating = file.getRating();
if (rating !== undefined) {
  console.log(`Rating: ${RatingUtils.toStars(rating)} stars`);
}

// Set rating (4 out of 5 stars)
file.setRating(0.8);
file.save();
```

See the [Track Ratings Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/ratings.html)
for RatingUtils API and cross-format conversion details.

### Working with Chapters

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("audiobook.m4b");

// Read chapters (ordered by start time)
for (const ch of file.getChapters()) {
  console.log(`${ch.startTimeMs}–${ch.endTimeMs} ${ch.title} (${ch.source})`);
}

// Replace all chapters
file.setChapters([
  { startTimeMs: 0, title: "Intro" },
  { startTimeMs: 95_000, title: "Chapter 1" },
]);
file.save();
```

Chapters are read from ID3v2 `CHAP` frames (MP3) or, for MP4, a QuickTime
chapter track (preferred when present) or a Nero `chpl` atom — each chapter
reports its `source`. `setChapters()` supports MP3 and MP4 only; for MP4,
`mp4ChapterStyle` (`"quicktime"` default, `"nero"`, or `"both"`) selects which
structure(s) to write (the Nero atom is capped at 255 chapters). `endTimeMs` is
explicit for ID3v2 chapters and inferred for MP4 (the next chapter's start, or
the track duration for the last chapter).

### Broadcast metadata (BWF `bext` / iXML)

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("recording.wav");

const bext = file.getBext(); // parsed EBU 3285 bext chunk, or undefined
console.log(bext?.description, bext?.timeReferenceSamples, bext?.codingHistory);
console.log(file.getIxml()); // raw iXML string, or undefined

file.setBext({
  ...bext!,
  description: "Updated",
  version: 2,
  loudnessValueDb: -16,
});
file.setIxml("<BWFXML>…</BWFXML>");
file.save();
```

`getBext()` / `setBext()` (WAV and FLAC only) parse and serialize the BWF
Broadcast Audio Extension chunk; `getBextData()` / `setBextData()` expose the
raw chunk bytes for vendor extensions or malformed chunks, and `setBextData(null)`
removes the chunk. iXML is passed through verbatim as a string
(`setIxml(null)` removes it). The `bext` v2 loudness fields are EBU R128-style
measurements, distinct from ReplayGain tags. `bwf.decodeBext` / `bwf.encodeBext`
are also exported for working with raw `bext` bytes directly.

### Raw ID3v2 Frames (Escape Hatch)

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("song.mp3");

// Escape hatch: read/write raw ID3v2 frame bytes by ID (MP3 only)
const frames = file.getId3v2Frames("TXXX"); // [{ id, data, flags? }]
const rgadBody = new Uint8Array([/* raw frame body bytes */]);
file.setId3v2Frames("RGAD", [rgadBody]); // replaces ALL RGAD frames
file.removeId3v2Frames("NCON"); // removes every NCON frame
file.save();
```

`data` is the frame body without the 10-byte header; the caller owns the body
encoding. Bytes round-trip verbatim for frames TagLib does not model. For
TagLib-modeled IDs (`TIT2`, `APIC`, …): typed getters see a raw write only
after save+reload; bytes may be normalized by later saves after that reload;
and raw reads reflect persisted state plus pending raw writes — not pending
typed edits (backend-dependent). A typed write to the same ID as an existing
raw write is silently ignored until that raw frame is removed or the file is
saved and reloaded — raw writes always win within a save. Frames with
compression/encryption flags are not supported for write (writes emit zero
flags). `flags` exists on the returned frames for forward compatibility, but
reads never populate it today — TagLib always blanks header flags when
re-rendering a frame. On both backends, a raw write to an ID3v1-mapped frame ID
(`TIT2`, `TPE1`, `TALB`, `COMM`, `TCON`, `TDRC`, `TRCK`) suspends the usual
ID3v1↔ID3v2 duplicate-sync on `save()` until that raw frame is removed.

### Container Format and Codec Detection

```typescript
import { readProperties } from "taglib-wasm/simple";

// Get detailed audio properties including container and codec info
const props = await readProperties("song.m4a");

console.log(props.containerFormat); // "MP4" (container format)
console.log(props.codec); // "AAC", "ALAC", "AC-3", … (compressed media format)
console.log(props.isLossless); // false for AAC, true for ALAC
console.log(props.bitsPerSample); // 16 for most formats
console.log(props.bitrate); // 256 (kbps)
console.log(props.bitrateMode); // "CBR" | "VBR" | "ABR" | undefined (MP3 only)
console.log(props.sampleRate); // 44100 (Hz)
console.log(props.duration); // 180 (duration in seconds)
```

For Opus files, `audioProperties()` additionally exposes `outputGainDb` — the
OpusHead output gain in decibels (RFC 7845). Players apply this unconditionally;
it is separate from, and stacks with, ReplayGain / R128 tags, and is almost
always `0`.

Container format vs Codec:

- **Container format** – How audio data and metadata are packaged (e.g., MP4, OGG)
- **Codec** – How audio is compressed/encoded (e.g., AAC, Vorbis)

Supported formats:

- **MP4 container** (.mp4, .m4a) – Can contain AAC, ALAC, AC-3, E-AC-3, DTS, FLAC, or Opus
- **OGG container** (.ogg) – Can contain Vorbis, Opus, FLAC, or Speex
- **MP3** – Both container and codec (lossy)
- **FLAC** – Both container and codec (lossless)
- **WAV** – Container for PCM (uncompressed) audio
- **AIFF** – Container for PCM (uncompressed) audio

## Documentation

**[View Full Documentation](https://charleswiltgen.github.io/TagLib-Wasm/)**

### Getting Started

- [Installation Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/installation.html)
- [Quick Start Tutorial](https://charleswiltgen.github.io/TagLib-Wasm/guide/quick-start.html)
- [All Examples](https://charleswiltgen.github.io/TagLib-Wasm/guide/examples.html)

### Guides

- [API Reference](https://charleswiltgen.github.io/TagLib-Wasm/api/)
- [Performance Guide](https://charleswiltgen.github.io/TagLib-Wasm/concepts/performance.html)
- [Album Processing Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/album-processing.html)
- [Platform Examples](https://charleswiltgen.github.io/TagLib-Wasm/guide/platform-examples.html)
- [Working with Cover Art](https://charleswiltgen.github.io/TagLib-Wasm/guide/cover-art.html)
- [Track Ratings](https://charleswiltgen.github.io/TagLib-Wasm/guide/ratings.html)
- [Chapters](https://charleswiltgen.github.io/TagLib-Wasm/guide/chapters.html)
- [Broadcast Metadata (BWF bext / iXML)](https://charleswiltgen.github.io/TagLib-Wasm/guide/broadcast-metadata.html)
- [Cloudflare Workers](https://charleswiltgen.github.io/TagLib-Wasm/advanced/cloudflare-workers.html)
- [Error Handling](https://charleswiltgen.github.io/TagLib-Wasm/concepts/error-handling.html)
- [Contributing](CONTRIBUTING.md)
- [AI Agent Documentation](AGENTS.md)

## Supported Formats

`taglib-wasm` is designed to support all formats supported by TagLib:

- **.mp3** – ID3v2 and ID3v1 tags
- **.aac** – ADTS / raw AAC streams (ID3v2 metadata, read through the MPEG reader)
- **.m4a/.mp4** – MPEG-4/AAC metadata for AAC and Apple Lossless audio
- **.flac** – Vorbis comments and audio properties (plus BWF `bext`/iXML)
- **.ogg** – Ogg container: Vorbis with full metadata support, plus FLAC-in-Ogg
  and Speex
- **.wav** – INFO chunk metadata, plus BWF `bext` and iXML
- **Additional formats** – Opus, APE, MPC, WavPack, TrueAudio, AIFF, WMA, and
  more

## Performance and Best Practices

### Batch Processing for Multiple Files

When processing multiple audio files, use the optimized batch APIs for better performance:

```typescript
import { readMetadataBatch, readTagsBatch } from "taglib-wasm/simple";

// Processing files one by one (can take 90+ seconds for 19 files)
for (const file of files) {
  const tags = await readTags(file); // Re-initializes for each file
}

// Batch processing (10-20x faster)
const result = await readTagsBatch(files, {
  concurrency: 8, // Process 8 files in parallel
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} files processed`);
  },
});

// Read complete metadata in one batch
const metadata = await readMetadataBatch(files, { concurrency: 8 });
```

**Performance comparison for 19 audio files:**

- Sequential: ~90 seconds (4.7s per file)
- Batch (concurrency=4): ~8 seconds (11x faster)
- Batch (concurrency=8): ~5 seconds (18x faster)

### Smart Partial Loading

For large audio files (>50MB), enable partial loading to reduce memory usage:

```typescript
// Enable partial loading for large files
using file = await taglib.open("large-concert.flac", {
  partial: true,
  maxHeaderSize: 2 * 1024 * 1024, // 2MB header
  maxFooterSize: 256 * 1024, // 256KB footer
});

// Read operations work normally
const tags = file.tag();
console.log(tags.title, tags.artist);

// Smart save - automatically loads full file when needed
await file.saveToFile(); // Full file loaded only here
```

**Performance gains:**

- **500MB file**: ~450x less memory usage (1.1MB vs 500MB)
- **Initial load**: 50x faster (50ms vs 2500ms)
- **Memory peak**: 3.3MB instead of 1.5GB

### Runtime Optimization Tiers

taglib-wasm auto-selects the fastest available backend — no configuration needed:

| Environment              | Backend           | How it works                                           | Performance |
| ------------------------ | ----------------- | ------------------------------------------------------ | ----------- |
| **Node.js / Deno / Bun** | WASI (auto)       | Seek-based filesystem I/O; reads only headers and tags | Fastest     |
| **Browsers / Workers**   | Emscripten (auto) | Entire file loaded into memory as buffer               | Baseline    |

On Node.js, Deno, and Bun you get WASI automatically — nothing to configure.

### Bundle Size and Tree-Shaking

Importing the barrel (`taglib-wasm`) does **not** pull in the Folder or Web API:
every bundler tested here tree-shakes to leaf granularity. Measured on
taglib-wasm 2.2.3 installed from a packed tarball (`npm pack` →
`npm install <tarball>`), minified ES2022 ESM bundles on Node 24.21.0. Figures
are minified JavaScript bytes — the ~700 KB Wasm binary is loaded at runtime and
is not part of the bundle in any scenario below. The `./web` figures further down
were re-measured with the same invocations after that subpath gained a `browser`
condition.

Each row is a one-file app whose whole body is that import plus the call the row
names, keeping the imported function reachable (`globalThis.__app = { … }`).
Exact invocations, so the table can be reproduced:

- **esbuild 0.28.2** — `esbuild <app> --bundle --minify --format=esm
  --target=es2022 --platform=browser --external:module` for the browser column;
  the same with `--platform=node` and no `--external` for the Node column.
  (`--external` takes a colon, not `=`.)
- **rollup 4.63.3** — `input: <app>`, plugins `@rollup/plugin-node-resolve`
  (`{ browser: true, exportConditions: ["browser", "default"] }` for the browser
  column, default options for the Node column) and `@rollup/plugin-terser`,
  output `{ format: "esm", inlineDynamicImports: true }`.
- **vite 8.3.0** — a real app build: `index.html` plus a
  `<script type="module">` pointing at the entry, `build.minify: "esbuild"`,
  `target: "es2022"`. Vite builds for the browser.
- **webpack 5.111.1** — `mode: "production"`, `target: "web"`,
  `externals: { module: "module" }`. `target: "web"` alone fails on the
  `import("module")` inside `dist/taglib-wrapper.js`.

| Consumer app                          | esbuild (browser)¹ | rollup (browser)¹ | vite (app) | webpack (web)² | esbuild (Node)³ | rollup (Node)³ |
| ------------------------------------- | ------------------ | ----------------- | ---------- | -------------- | --------------- | -------------- |
| `taglib-wasm` — `TagLib.initialize()` | 81,991             | 78,374            | 84,802     | 57,141         | 145,056         | 134,312        |
| `taglib-wasm/simple` — `getTagLib()`  | 81,279             | 78,495            | 84,094     | 57,260         | 146,047         | 134,713        |
| `taglib-wasm/folder` — `scanFolder`⁴  | —                  | 138,075⁴          | 146,094⁴   | —              | 149,396         | 138,075        |

¹ the `browser` `exports` condition. ² `target: "web"`. ³ the Node `exports`
condition. ⁴ Node-only entry — see below.

**`./folder` is Node-only.** The subpath declares no `browser` export condition
because `scanFolder` and friends read and write a filesystem, so a
browser-targeted build resolves the Node-oriented graph and fails: esbuild
`--platform=browser` reports `Could not resolve "node:fs/promises"`, and webpack
`target: "web"` fails with four errors (`./taglib-web.wasm`, `node:fs`,
`node:fs/promises`, `node:buffer`). That outcome is the design: a build error
beats a stub that throws on the first call in production. If the same cells were
reachable they would come from shimming Node builtins into a bundle that cannot
work — which is exactly what vite and rollup did before the condition was
declared. `./rating` and `./disc-folder` are pure JavaScript and build for
either target. In a browser, scan on a server and post the result; the pure
`groupAlbums` / `discFolderInfo` half is exported from `taglib-wasm` and
`taglib-wasm/disc-folder` and runs anywhere.

**`./web` builds for the browser.** It declares a `browser` condition, so a
browser-targeted build resolves an Emscripten-only build of that entry and pulls
**`taglib-web.wasm` alone** — measured with the vite invocation above on
`pictureToDataURL` from `taglib-wasm/web`: one 703,477-byte Wasm asset where the
Node-oriented graph emitted both `taglib-web.wasm` and `taglib-wasi.wasm`
(1.4 MB of assets for a call that needs neither engine), and a 6,289-byte
JavaScript bundle where the shimmed Node graph produced 17,461 bytes. Note the
browser build is a pre-bundled file like `index.browser.js`, so it does not
tree-shake to a leaf the way the Node files do: the same call costs 80,959 bytes
in the browser column against 205 bytes on Node, and importing any pure helper
from the barrel costs ~82 KB there too. That granularity is a property of the
pre-bundled browser entries, not of this subpath.

**TypeScript resolves the same condition.** A browser consumer gets the matching
type surface only if TypeScript is told about it — in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "customConditions": ["browser"]
  }
}
```

With that condition, `dist/index.browser.d.ts` is the declaration file used, so
`import { scanFolder } from "taglib-wasm"` is a compile error naming the missing
export (`TS2305: Module '"taglib-wasm"' has no exported member 'scanFolder'`)
instead of a bundler error — and importing `bwf`, `groupAlbums`,
`discFolderInfo`, or any type (including `FolderScanResult`) compiles. Without
`customConditions`, TypeScript reads the Node declarations from
`dist/index.d.ts` while the bundler still ships `dist/index.browser.js`; that
mismatch is what produced the original silent failure.

**Bundler interop.** `dist/taglib-wrapper.js` — the Emscripten glue — contains a
dynamic `import("module")`, and browser targets have no such builtin, so the two
targets need one line each: esbuild `--external:module`, webpack
`externals: { module: "module" }` (webpack `target: "web"` alone fails on it).
Rollup needs nothing extra; vite externalizes it for the browser with a warning.
The `browser` condition itself is resolved by default by esbuild
(`--platform=browser`), vite, and webpack (`target: "web"`); rollup needs
`nodeResolve({ browser: true, exportConditions: ["browser", "default"] })`.

**The barrel is not a tax.** Adding an API to an import that already loads the
engine costs only that API. Against the `taglib-wasm` row above (esbuild, Node
column): adding `scanFolder` costs **4,377 bytes** and adding
`pictureToDataURL` costs **187 bytes**, because neither drags in the rest of the
Folder or Web module tree.

**The browser barrel's residue.** The browser entry is a pre-bundled file, and
aligning its export surface with the Node barrel's added the pure
`bwf` / `groupAlbums` / `discFolderInfo` exports to it. A browser consumer that
imports none of them pays **350 bytes** more than before (measured on
`import { TagLib }`, one toolchain and one snapshot, pre- and post-change
entries): **56 bytes** for the `bwf` namespace object's top-level export table
and **294 bytes** for the `discFolderInfo`/`groupAlbums` re-export entries —
neither is droppable when unused. Nothing else moved: `isDenoCompiled`, a plain
function, shakes away completely, the Folder and Web APIs are still reached only
when imported, and the Node entries are unchanged.

**Entry-point choice is not a size lever.** `taglib-wasm` and
`taglib-wasm/simple` differ by less than 1 KB in either direction — in a browser
bundle `simple` is 712 bytes _smaller_, on Node 991 bytes _larger_, because
`getTagLib()` reaches the full `TagLib` class through a dynamic import. Pick by
API surface. The lever that does matter is the `browser` export condition: a
browser-targeted bundle is ~82 KB where a Node-targeted one is ~145 KB.

**`"sideEffects": false`** is set in `package.json`, so a bundler may drop any
module whose exports go unused. Before that field, importers of the sub-entries
paid ~17 KB for property-metadata tables that were kept only because module-level
table building looked impure; those bundles are now a few hundred bytes or less.
Measured with esbuild `--platform=node`, rollup with default `node-resolve`
options, and vite's app build — the combination under which all four apps build
under every bundler:

| Consumer app                                                   | esbuild off → on  | rollup off → on   | vite off → on   |
| -------------------------------------------------------------- | ----------------- | ----------------- | --------------- |
| `import "taglib-wasm/web"` (uses nothing)                      | 17,198 → 21       | 16,329 → 21       | 17,348 → 731    |
| `import "taglib-wasm/folder"` (uses nothing)                   | 17,430 → 21       | 16,380 → 21       | 17,689 → 731    |
| `pictureToDataURL` from `taglib-wasm/web`                      | 17,361 → 184      | 16,497 → 189      | 17,519 → 902    |
| `import { TagLib } from "taglib-wasm"`, referenced by `typeof` | 145,596 → 145,030 | 134,337 → 134,286 | 84,278 → 84,278 |

## Runtime Compatibility

`taglib-wasm` works across all major JavaScript runtimes:

| Runtime                | Status  | Installation              | Notes                                                                                              |
| ---------------------- | ------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Node.js**            | Full    | `npm install taglib-wasm` | TypeScript via tsx                                                                                 |
| **Deno**               | Full    | `npm:taglib-wasm`         | Native TypeScript                                                                                  |
| **Bun**                | Partial | `bun add taglib-wasm`     | Import + init verified; full test suite is Deno-only                                               |
| **Browser**            | Full    | Via bundler               | Full API support                                                                                   |
| **Cloudflare Workers** | Full    | `npm install taglib-wasm` | Buffer-based (Emscripten); no filesystem. See [Workers guide](docs/advanced/cloudflare-workers.md) |
| **Electron**           | Node.js | `npm install taglib-wasm` | Main process; renderer via IPC                                                                     |

## Known Limitations

- **Memory Usage (browsers)** – In browser environments, entire files are loaded
  into memory. On Node.js/Deno, WASI reads only headers and tags from disk.
- **Concurrent Access** – Not thread-safe (JavaScript single-threaded nature
  mitigates this)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md)
for details on our code of conduct and the process for submitting pull requests.

## License

This project uses dual licensing:

- **TypeScript/JavaScript code** – MIT License (see [LICENSE](LICENSE))
- **WebAssembly binaries (taglib-web.wasm, taglib-wasi.wasm)** – LGPL-2.1-or-later
  (inherited from TagLib)

The TagLib library is dual-licensed under LGPL/MPL. When compiled to
WebAssembly, the resulting binary must comply with LGPL requirements. This
means:

- You can use taglib-wasm in commercial projects
- If you modify the TagLib C++ code, you must share those changes
- You must provide a way for users to relink with a modified TagLib

For details, see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL)

## Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
- [WASI](https://wasi.dev/) – WebAssembly System Interface for server-side runtimes
