# Changelog

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
- Updated SonarCloud configuration
