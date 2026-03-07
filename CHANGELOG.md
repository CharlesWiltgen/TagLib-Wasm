# Changelog

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
