# Changelog

## 1.4.0

### Features

- Simple read API now returns structured metadata: `readTags()`,
  `readTagsBatch()`, `readMetadata()`, and `readMetadataBatch()` populate the
  `ExtendedTag` fields `pictures`, `ratings`, `lyrics`, `chapters`, `bext`,
  `bextData`, and `ixml`. Previously these were declared on `ExtendedTag` but
  only reachable through the `AudioFile.getX()` methods.

### Fixes

- `clearTags()` now reliably removes all metadata on both backends. It was
  effectively a no-op on the WASI backend (the default in Deno/Node) and left
  structured fields (ratings, chapters, `bext`, iXML) behind on Emscripten.
- Partial-load save now propagates a text-property deletion instead of silently
  restoring it from the full-file reload (Emscripten partial loads).
- MP4 freeform items (`----:com.apple.iTunes:*`, including the Apple Sound Check
  `iTunNORM` atom) now round-trip through save on the WASI backend; they were
  previously dropped.

### Types

- `ExtendedTag.ratings` and `ExtendedTag.lyrics` now use the canonical `Rating[]`
  and `UnsyncedLyrics[]` types so `readTags()` matches `getRatings()` /
  `getLyrics()`. Their sub-fields (`email`/`counter`, `description`/`language`)
  are now optional, reflecting what the library actually returns. These fields
  were never populated before, so existing code is unaffected.

### Toolchain

- Emscripten backend upgraded to 6.0.1 and switched to Wasm exception handling,
  which raises the minimum supported browser versions (see docs). The WASI
  backend is unaffected.

### Internal

- Cross-backend parity audit: added `tests/PARITY-COVERAGE.md` (a per-method ×
  backend coverage matrix), a mandatory parity-test convention, and both-backend
  parity tests across the `AudioFile` surface.

## 1.3.1

### Features

- Unsynchronized lyrics: public `AudioFile.getLyrics()` / `setLyrics()`. Lyrics
  are now a structured field (like pictures/ratings/chapters) and are excluded
  from the text `properties()` map on both backends.

### Fixes

- `clearTags()` removes lyrics on clear.

### Internal

- CI runs `build:ts` in a `check:all` task plus a fast bundle job to catch
  bundler-resolution regressions that pass tests but break the shipped bundle.

## 1.3.0

### Features

- `file.tag()` (MutableTag) gains a `date` getter and `setDate()`, preserving
  full ISO date precision; `setDate("")` coherently clears both date and year.

### Fixes

- Lyrics persist on the WASI backend via the `LYRICS` text property.
- WASI `saveToFile(target)` no longer mutates the source file.
- Partial-load `saveToFile` carries chapters and ratings through the reconstruct.
- MP4 chapter style and partial-property merge corrected from code review.
- Drop a `@std/path` import so the browser/npm bundle builds.

### Internal

- Save reconstruct extracted into `save-reconstruct.ts` and driven from a shared
  field-copy registry so a structured field can't be silently dropped on save.

## 1.2.2

### Fixes

- `setYear()` is authoritative over a stored full date, and full ISO `DATE`
  strings are preserved with cross-backend parity.
- Release pipeline hardened against flaky legs and double publishes; Deno pinned
  to 2.8.0.

### Dependencies

- WASI SDK upgraded to 33; the custom exception-handling sysroot was retired in
  favor of the stock SDK 33 `eh/` multilib.
- msgpack-c (`lib/msgpack`) bumped cpp-6.1.0 → cpp-8.0.0; esbuild 0.28 and
  TypeScript 6.0.

### Internal

- Removed an orphan dual-build Emscripten C-API path.

## 1.2.1

### Features

- FLAC: `AudioFile.hasId3Tags()` / `stripId3Tags()` to detect and remove
  spurious ID3v1/ID3v2 tags while preserving Vorbis Comments and audio.

### Fixes

- Correct same-handle state after `stripId3Tags`, and harden mpack parsing.
- Resolve a duplicate `Chapter` interface across the public API.

### Internal

- Adopt knip for opt-in dead-code detection (`deno task knip`); dead-code sweep.
- ADR-0001 documenting the dual Wasm/JS boundary protocols.

## 1.2.0

### Features

- Chapters: `AudioFile.getChapters()` / `setChapters()` for MP3 (ID3v2 `CHAP`)
  and MP4 (QuickTime chapter track and/or Nero `chpl` atom, selectable via
  `SetChaptersOptions.mp4ChapterStyle`). Adds the `Chapter` and
  `SetChaptersOptions` types and `ExtendedTag.chapters`.
- Broadcast metadata (BWF): `AudioFile.getBext()` / `setBext()` parse and write
  the `bext` chunk (EBU Tech 3285) on WAV and FLAC, with `getBextData()` /
  `setBextData()` for raw chunk bytes and `getIxml()` / `setIxml()` for the iXML
  chunk. Adds the `BroadcastAudioExtension` type, `ExtendedTag.bext` /
  `bextData` / `ixml`, and a standalone `bwf.decodeBext` / `bwf.encodeBext`
  codec.
- Opus: `audioProperties()` exposes `outputGainDb` — the OpusHead output gain in
  decibels (RFC 7845).

### Dependencies

- Update TagLib from 2.2.1 to 2.3 (released 2026-05-10). Inherited fixes that
  ride along: correct ADTS/ESDS AAC bitrate reporting; fixed `MP4::ItemFactory`
  data race; bounded EBML/MP4 atom recursion and atom-count caps; `stco`/`co64`
  chunk-offset fix; more tolerant RIFF / ID3v2 / Matroska parsing; no false
  positives in MPEG detection; faster Matroska seek-head handling.

### Internal

- Remove a stale `git subtree` copy of TagLib (`CMakeLists.txt`, `taglib/`,
  `bindings/`) from the repo root — unused by the build (which uses the
  `lib/taglib` submodule) and only ever leaked into the JSR tarball. Tightened
  `deno.json` `publish.exclude` and rewrote `scripts/update-taglib.sh` to use
  the submodule flow instead of `git subtree`.

## 1.0.6

### Features

- Add Matroska/WebM (.mka, .mkv, .webm) format support across all backends
- Add Matroska format detection via EBML magic bytes

### CI

- Consolidate test.yml and dual-build.yml into single ci.yml pipeline

### Dependencies

- Update TagLib from 2.1.1 to 2.2.1 (Matroska/WebM support, Ogg FLAC fixes, stricter ID3v2 verification)

## 1.0.5

### Performance

- Eliminate COW memory multiplication during save()
- Increase MAXIMUM_MEMORY from 1GB to 2GB

## 1.0.4

### Performance

- Eliminate redundant buffer copy in loadFromBuffer
- Optimize Emscripten buffer transfers with typed_memory_view

## 1.0.2

### Bug Fixes

- Merge TRACKTOTAL/DISCTOTAL into IntPair format for MP4 and MP3

## 1.0.1

### Features

- Add browser conditional exports for Vite compatibility

### Bug Fixes

- Revert global.d.ts types to `any` for Node.js tsc compatibility
- Remove nonexistent mod.ts from sonar.sources

### Refactoring

- Replace `any` with `Record<string, unknown>` in module loader
- Remove forceBufferMode in favor of forceWasmType
- Remove vestigial mod.ts in favor of single index.ts entry point
- Rename writeTagsToFile to applyTagsToFile

## 1.0.0-beta.13

### Features

- Detect missing exnref support and warn Node.js users on WASI fallback

### Bug Fixes

- Add fast-check to devDependencies for Windows CI
- Make error message assertions platform-agnostic for Windows
- Use internal path utils instead of @std/path in src/
- Use fromFileUrl and @std/path for Windows compatibility
- Resolve cross-backend parity bugs for WV/TTA/WMA/Opus formats

## 1.0.0-beta.12

### Breaking Changes

- Unified camelCase property API replaces mixed-case keys
- Removed 26 convenience methods and ExtendedAudioFileImpl

### Features

- Add branded NormalizedRating and PopmRating types to RatingUtils
- Add runtime Node.js version check with clear error message
- Add format-specific type narrowing for property keys
- Unified camelCase property API with translation maps
- Add TotalTracks, TotalDiscs, Compilation to Tags constant

### Bug Fixes

- Fix CI: copy wasm artifacts to dist/ before TypeScript build
- Fix CI: remove runtime initialization from package-compat import tests
- Update test expectations for unified PropertyMap key vocabulary

## 1.0.0-beta.11

### Refactoring

- Extract ratings, pictures, and audio props from C++ shim

## 1.0.0-beta.10

### Bug Fixes

- Return null from getAudioProperties() when audio data absent
- Pass raw msgpack to C++ shim for full PropertyMap write support

## 1.0.0-beta.9

### Bug Fixes

- Implement buffer-to-buffer write via ByteVectorStream in WASI shim
- Surface audio properties from WASI decoded tag data

## 1.0.0-beta.8

### Bug Fixes

- Correct tl_read_tags return value interpretation and add e2e tests

## 1.0.0-beta.7

### Bug Fixes

- Publish WASM binaries to JSR and resolve import paths

## 1.0.0-beta.6

### Bug Fixes

- Use explicit file discovery in build script for bash compatibility
- Fix Deno compile wasm path resolution and dead code cleanup

### Refactoring

- Comprehensive quality remediation across codebase

## 1.0.0-beta.5

### Breaking Changes

- Removed deprecated simple API aliases (`getFormat`, `getTags`, `getProperties`, `setTags`, `getCoverArt`, `setCoverArt`)
- Minimum Node.js requirement: v22+ with `--experimental-wasm-exnref` flag

### Features

- **Fluent `edit()` API** for tag modifications with method chaining
- **`Symbol.dispose` support** across Full and Workers APIs for `using` pattern
- **RAII memory management** with `WasmAlloc` and `WasmArena` for leak-free Wasm operations
- **Runtime-agnostic WASI host** supporting Deno, Node.js, and Bun via `FileSystemProvider` DI
- **Realigned API naming**: `readTags`, `readProperties`, `readFormat`, `readCoverArt`, `applyCoverArt`, `readPictureMetadata`
- **Batch metadata API**: `readMetadataBatch` for efficient multi-file processing with cover art and dynamics data
- **Folder scanning API** for recursive directory metadata extraction

### Bug Fixes

- Fixed memory cleanup in `open()` error paths and `isValidAudioFile()`
- Fixed progress tracking and type-safe error tags in folder-api
- Hardened worker pool with proper try-finally cleanup
- Fixed negative seek position handling in WASI adapter

### Internal

- Migrated all tests to BDD syntax (135 tests passing)
- Split 10 oversized source files into directory modules
- Deduplicated batch operation scaffolding with shared `executeBatch` helper
- Removed stale build scripts and migration guides

## 1.0.0-beta.4

### Features

- Make WASI host runtime-agnostic for Node.js and Bun support

### Bug Fixes

- Freeze EMPTY_TAG and use atomic progress capture in folder-api
- Suppress S2187 false positives and reduce cognitive complexity

### Refactoring

- Migrate all test files from Deno.test() to BDD syntax

## 1.0.0-beta.3

### Breaking Changes

- Removed deprecated aliases for renamed simple API functions

### Features

- Realign API naming and add edit() method with fluent setters
- Make WASI host runtime-agnostic with FileSystemProvider DI

### Bug Fixes

- Throw on negative seek position
- Detect Bun runtime and lazy-load wasmer-sdk to prevent loader errors

## 1.0.0-beta.2

### Features

- Add Symbol.dispose to Full API with `using` pattern support

### Refactoring

- Migrate Emscripten Workers API to RAII memory management
- Use minimal WorkerSelf interface instead of webworker lib

## 1.0.0-beta.1

### Features

- WASI in-process filesystem access via WASI host
- FileRef with EH-enabled sysroot (removes format-specific workarounds)
- FileStream for efficient seek-based path I/O
- Sidecar routing for path-based access in Simple API

### Bug Fixes

- Build as reactor module for proper static constructor initialization
- Harden WASI host security and resource management
- Use valid SPDX license identifier for JSR/NPM publishing

### Refactoring

- Split oversized source files into directory modules
- Extract shared test helpers, deduplicate bench loops

## 1.0.0

### Features

- Stable release of taglib-wasm
- Dual-build architecture: WASI (Deno/Node.js/Bun) and Emscripten (browser)
- Full API, Simple API, and Workers API surfaces
- Complex properties, rating API, and cover art support
- RAII memory management with `Symbol.dispose`
- Comprehensive property system with rich metadata
- Worker pool for parallel audio processing
- Folder scanning and batch processing APIs
- Smart partial loading for large files
- Deno compile support with embedded WASM
- SonarCloud integration

## Pre-1.0 (0.4.0 - 0.9.0)

Early development releases establishing the core architecture:

- **0.9.0** — TagLib/mpack as git submodules, Phase 4 WASI exception handling, unified loader
- **0.5.x** — Worker pool, property system, batch processing, folder API, partial loading
- **0.4.x** — Deno compile support, codec detection, extended metadata, cover art, Embind migration, Cloudflare Workers/Bun support, format-agnostic metadata with ReplayGain and Sound Check
