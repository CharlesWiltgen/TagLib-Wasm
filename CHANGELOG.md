# Changelog

## Unreleased

### Internal

- **`wasm-freshness` now tracks C++ sources, not just the submodule.** As first
  shipped it triggered only on `lib/taglib`, but both binaries also compile
  from `src/capi/` — so editing the WASI shim without rebuilding still shipped
  a binary built from older C++ than the source beside it. Input sets are now
  per-backend and match what each script actually compiles: WASI gets
  `lib/taglib`, `lib/mpack`, `src/capi/*`; Emscripten gets `lib/taglib`,
  `build/taglib_embind.cpp`, `src/capi/formats/*` (it links only
  `taglib_lame.cpp` from `src/capi`, not the WASI shim). Replayed over the last
  80 commits: zero false positives. The earlier over-broad set would have
  failed 8 of them.
- **`test-wasi` now tests the binary it built.** The job downloaded the fresh
  WASI artifact into `dist/wasi/` but the loader reads `build/taglib-wasi.wasm`
  (`src/runtime/wasi-host-loader.ts:50`), so it tested the committed binary and
  the fresh build was only size-reported. It now copies the artifact into
  `build/` first. The committed binary is still covered by the main `test` job,
  which defaults to the WASI backend — so `test` covers what ships and
  `test-wasi` covers what current source produces.

## 1.5.3

### Changes

- **Upgraded the bundled TagLib to 2.3.1** (from 2.3). Both Wasm backends were
  rebuilt. Upstream is a bug-fix release, and several fixes land on formats
  taglib-wasm exposes:
  - **Matroska** (MKA/MKV/WebM): fixed a crash when the seek head is invalid or
    missing, added element-length checks, support for unknown-size elements,
    and skipping of invalid elements. These are malformed-input paths, where a
    C++ crash traps the whole Wasm instance.
  - **MP4**: avoids excessive sample allocation with an invalid `stsc` for
    QuickTime chapters; fixed `MP4::Chapter` destructor and assignment
    operator; `cnID` widened to 64-bit for large Apple Music catalog IDs;
    support for NI STEM atoms with 64-bit length; raised the top-level atom
    limit.
  - **XM**: fixed the save path to skip sample data after sample headers,
    correcting tracker files written with samples.
  - **ID3v2**: fixed the data-length-indicator check for compressed frames.
- **FLAC `bext`/iXML presence now reflects on-disk state.** Upstream changed
  `FLAC::File::hasiXMLData()`/`hasBEXTData()` to track whether the APPLICATION
  block exists in the file rather than whether an in-memory payload is set,
  matching the model `RIFF::WAV::File` already used. Reading `bext`/iXML back
  from a FLAC file after `setBext()`/`setIxml()` but _before_ `save()` now
  reports absent; reopening after save is unaffected, as is WAV. This removes a
  FLAC-vs-WAV divergence rather than introducing one.

### Internal

- **`build:wasm` now builds both Wasm backends.** It previously ran only the
  Emscripten build, so `build/taglib-wasi.wasm` — the committed, published WASI
  binary — changed only when someone remembered to run `build/build-wasi.sh` by
  hand. Bumping `lib/taglib` and running the documented build command would
  ship Emscripten built from the new TagLib and WASI from the old one, with CI
  green: CI builds the WASI binary fresh but the loader reads the committed one
  (`src/runtime/wasi-host-loader.ts:50`), and publish only checks that the file
  exists. Split into `build:wasm:emscripten` / `build:wasm:wasi`, with
  `build:wasm` running both; CI jobs that provision only one SDK now name the
  specific variant.
- **New `wasm-freshness` CI job** fails if a commit moves the `lib/taglib`
  gitlink without rebuilding both wasm binaries.
- **The release preflight now builds the npm package before linting it.**
  `publint`, `arethetypeswrong`, and `npm pack --dry-run` lint the packed
  tarball, but the release script only ran `deno task build`, whose `build:ts`
  emits `.js` only — the `.d.ts` files come from `tsc` in the npm `build:ts`.
  Those checks were therefore validating whatever stale `dist/` happened to be
  present locally, and reported missing types once `dist/` was cleaned.
- **The release gate now actually verifies the WASI binary.** `release.sh` and
  `release-safe.sh` compared `build/taglib-wasi.wasm` against
  `dist/wasi/taglib-wasi.wasm`, which could never fail — `build-wasi.sh` writes
  both paths from the same run — and fell back to an exists-and-over-100KB
  warning when `dist/wasi/` was absent. Both now use the same
  `git diff --quiet` staleness check already applied to the Emscripten binary,
  which works because `deno task build` rebuilds both backends and same-machine
  rebuilds are byte-identical.
- `prepareWasmForEmbedding()` now searches `build/` before `dist/`. `dist/` is
  gitignored and refreshed only by the npm chain (`build:copy-wasm`/
  `postbuild`), so in a working checkout a months-old copy there silently
  shadowed the committed, freshly built binary in `build/`. Published packages
  ship no `build/` and are unaffected — resolution falls through to `dist/` as
  before. The search order is now a named constant with a regression test.
- The npm `build` script now cleans `dist/` first, so local builds match the
  clean-checkout guarantee CI gets instead of relying on every writer to
  overwrite its own stale output. `dist/wasi/` is deliberately preserved: it is
  written by `build/build-wasi.sh`, which `npm run build` does not invoke, so
  the packaging chain has no business deleting another build's output.
- `tests/offline-support.test.ts` reads the Emscripten binary from `build/`
  rather than `dist/`. Its whole Emscripten suite was gated on a file in a
  gitignored directory, so 10 test steps had been skipping silently in this
  repo since the stale copy was written, and would skip on any fresh clone.

## 1.5.2

### Fixes

- **Emscripten backend: resizable-heap posture rolled back.** The toolchain is
  now pinned to Emscripten 6.0.3, whose `GROWABLE_ARRAYBUFFERS` default was
  reverted to off upstream after Web API compatibility issues — and which also
  fixed an upstream `UTF8ToString` bug on resizable heaps. Builds since 1.4.1
  had the resizable heap auto-enabled (6.0.2 default with
  `ALLOW_MEMORY_GROWTH`), putting both issues in the string-decoding hot path
  once the wasm heap grew. Memory growth returns to copy-on-grow (the
  pre-1.4.1 behavior); the WASI backend is unaffected. A regression test now
  forces heap growth past the initial 16MB and round-trips multibyte tags on
  both backends.

### Internal

- CI: `bun-version` pinned to 1.3.14 in the Package Compatibility job —
  `latest` resolved tags via a GitHub API call from the runner on every run,
  which intermittently returned 503.
- Repository history was rewritten to remove editor settings and an internal
  planning document; all commit SHAs changed. Existing clones and forks must
  be re-cloned (published npm/JSR packages and GitHub Releases are
  unaffected).

## 1.5.1

### Fixes

- **Windows: all drives now preopen on Node.js and Electron** (#24). The
  loader's drive detection used `new Function("return require('node:fs')")()`,
  which evaluates in the global scope where `require` never exists in standard
  module files (ESM _or_ CJS) — so only `C:\` was registered as a WASI preopen
  and files on other drives failed with error `-4`. node:fs is now acquired via
  `process.getBuiltinModule("node:fs")` (Node ≥ 20.16 / Electron ≥ 32), with
  the legacy hack kept only for global-`require` contexts.
- **`getFileBuffer()` no longer silently returns wrong data** — two data-loss
  vectors closed. On WASI path-mode it returned an **empty** buffer when the
  disk read-back failed (e.g. source moved/deleted), and a **stale pre-save**
  buffer when it had been called before `save()`/`saveToFile()`; consumers
  writing the returned buffer back to disk would truncate or revert their
  files. Read failures now throw `FileOperationError` (with the source path),
  and the path-mode cache is invalidated on every save path.
- `getRating()` now returns the branded `NormalizedRating` type, so the
  documented `RatingUtils` pairing (`toStars(file.getRating()!)`) type-checks.
  Type-level only — the value is still a plain number at runtime, and the
  branded type remains assignable to `number`.

### Internal

- Browser bundles (`index.browser.js`, `simple.browser.js`) no longer contain
  `new Function` source — strict-CSP consumers (e.g. MV3 extensions) reject it.
- Deno detection deduplicated behind a shared `isDeno()`.
- Docs: `getFileBuffer()`'s throw contract documented (API reference,
  troubleshooting, AGENTS.md); nine stale code examples fixed via a
  type-checked docs preflight.

## 1.5.0

### Features

- **Raw ID3v2 frame API** (MP3): `getId3v2Frames(id?)`, `setId3v2Frames(id,
  bodies)`, `removeId3v2Frames(id)` — an escape hatch for vendor/rare frames
  (RGAD, NCON, custom TXXX, …) with byte round-trip fidelity and cross-backend
  parity.

### Fixes

- `wasmBinary` is deterministic: Emscripten-only, and never silently ignored
  when another backend is selected.
- `forceWasmType: "wasi"` fails loudly when the WASI backend cannot load
  instead of silently falling back to Emscripten.
- Raw ID3v2 frame correctness: MPEG `save()` no longer clobbers raw-written
  typed-ID frames; the ID3v1 duplicate-sync gate is scoped to raw-written
  mapped frame IDs and mirrored into the WASI save path; staged frame bodies
  are copied on WASI reads.

## 1.4.3

### Fixes

- Fix `TagLib.initialize()` failing on **Deno / JSR** for both the Emscripten and
  the default WASI backend. `deno publish` (Deno ≥ 2.8.2, denoland/deno#34549)
  rewrites the import module names inside the published wasm to relative
  specifiers (`a` → `./a`, `wasi_snapshot_preview1` → `./wasi_snapshot_preview1`),
  which no longer match the glue's import object, throwing
  `WebAssembly.instantiate(): Import #0 "./a": module is not an object or function`.
  The runtime now provides its wasm imports under both the bare and `./`-prefixed
  names, so the JSR-published wasm instantiates correctly. The wasm bytes are
  unchanged. **npm was unaffected; 1.4.1 and 1.4.2 are broken on Deno/JSR — use
  1.4.3.**

### Internal

- Add a post-publish CI gate that instantiates the actual published JSR package
  (both backends) — the only check that can catch this publish-time corruption,
  since the build-time guard runs before `deno publish` rewrites the wasm.

## 1.4.2

### Fixes

- Fix the Emscripten backend failing to instantiate on Deno (regression in
  1.4.1). The published wasm imported module `./a` while its glue provided
  `{a: …}` — a wasm/glue mismatch caused by a stray `wasm-opt` (Binaryen) on the
  CI runner minifying the wasm's import module names inconsistently with the
  glue. `TagLib.initialize()` threw
  `WebAssembly.instantiate(): Import #0 "./a": module is not an object or function`
  on Deno. **1.4.1 is broken on Deno — use 1.4.2.**

### Internal

- Pin `BINARYEN_ROOT` to Emscripten's own vendored `wasm-opt` in the build so a
  stray PATH `wasm-opt` cannot desync the wasm from the glue.
- Add a build guard that fails the build if the wasm's import module name does
  not match the glue's import-object key, plus a hard Deno instantiation smoke
  test in CI (the unit suite only skips the Emscripten backend on load-failure,
  so a broken wasm previously stayed green).

## 1.4.1

### Fixes

- Emscripten backend: re-add `wasmBinary` (and `locateFile`) to the linker's
  `INCOMING_MODULE_JS_API`. Emscripten 6.0.2 drops `wasmBinary` from the default
  set, so under release builds (`ASSERTIONS=0`) an explicitly provided Wasm
  binary was silently ignored — affecting the `wasmBinary` option and
  Deno-compiled/embedded loading. No public API change.

### Internal

- Bump the Emscripten toolchain pin from 6.0.1 to 6.0.2 (developer setup and
  CI). The Emscripten backend now uses `GROWABLE_ARRAYBUFFERS` (resizable-buffer
  memory growth), auto-enabled in 6.0.2 with `ALLOW_MEMORY_GROWTH`.
- Add a regression test guarding against a provided `wasmBinary` being silently
  dropped by a future toolchain or flag change.
- Document the remaining public exports; docs-coverage backlog is now zero.

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
