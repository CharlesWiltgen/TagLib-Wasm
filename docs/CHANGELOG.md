# Changelog

All notable changes to taglib-wasm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Container format and codec detection
  - New `containerFormat` field in `AudioProperties` interface
  - Differentiates between container formats (MP4, OGG) and codecs (AAC, Vorbis)
  - Properly identifies MP4 containers (including .m4a files) vs their codecs (AAC/ALAC)
  - Clear distinction between how audio data is packaged vs compressed
  - Supports all major container formats: MP4, OGG, MP3, FLAC, WAV, AIFF

- Smart Partial Loading for dramatically improved performance with large files
  - New `partial` option in `open()` method enables loading only metadata
    portions
  - Configurable `maxHeaderSize` and `maxFooterSize` options
  - Automatic full file loading when `saveToFile()` is called
  - 50-450x performance improvement for files >50MB
  - Supports Browser File API, Deno, and Node.js environments

- High-performance batch processing APIs for multiple files
  - New `readTagsBatch()`, `readPropertiesBatch()`, and `readMetadataBatch()` functions
  - 10-20x performance improvement when processing multiple files
  - Configurable concurrency control (default: 4 concurrent files)
  - Progress callback support for tracking batch operations
  - Single TagLib instance reused across all operations
  - Resolves performance issue where 19 files took 90+ seconds (now ~5 seconds)

### Fixed

- Fixed Unicode string handling - emoji, CJK characters, RTL text, and all
  Unicode characters now work correctly
  - Changed C++ wrapper to use `toCString(true)` instead of `to8Bit(true)` for
    proper UTF-8 encoding
  - All Unicode edge case tests now pass
  - Critical fix for international users

- Fixed double file opening in `scanFolder()` function
  - Previously opened each file twice (once for tags, once for properties)
  - Now reads both in a single operation, improving folder scan performance by ~2x

### Changed

- Updated README with comprehensive performance best practices section
- Added batch processing example (`examples/batch-performance.ts`)

### Documentation

- Enhanced performance guide with batch processing patterns
- Added performance comparison data for different processing methods
- Updated API exports to include new batch functions and types

## [0.3.2] - 2025-01-14

### Added

- Type-safe tag constants with IDE autocomplete support
- `Tags` const object with PascalCase property names (e.g., `Tags.Title`,
  `Tags.AlbumArtist`)
- Helper functions for tag validation (`isValidTagName`, `getAllTagNames`)
- Format mapping reference showing how tags map across audio formats
- Tag constants example demonstrating usage (`examples/tag-constants.ts`)
- Comprehensive tag name constants documentation (`docs/Tag-Name-Constants.md`)

### Changed

- Updated all documentation to show tag constants usage
- Enhanced PropertyMap examples with type-safe access patterns

### Documentation

- Added Tag Constants section to README.md
- Updated API documentation with tag constants information
- Enhanced quick start guide with constants examples
- Updated automatic tag mapping example to use constants

## [0.3.1] - 2025-01-12

### Added

- Comprehensive API documentation (`docs/API.md`)
- Error handling guide (`docs/Error-Handling.md`)
- Performance optimization guide (`docs/Performance.md`)
- Troubleshooting guide with FAQ (`docs/Troubleshooting.md`)

### Changed

- Cleaned up README.md by removing duplicate examples
- Improved Simple API documentation

### Removed

- Outdated Embind migration documents
- Duplicate platform examples in README

## [0.3.0] - 2025-01-10

### Added

- Production-ready WebAssembly port of TagLib v2.1
- Full support for MP3, MP4/M4A, FLAC, OGG Vorbis, and WAV formats
- Simple API for easy tag reading/writing (3 functions)
- Full API for full control and advanced features
- Workers API for Cloudflare Workers compatibility
- TypeScript definitions with complete type safety
- Automatic tag mapping for format-agnostic metadata handling
- AcoustID fingerprint and ID support
- MusicBrainz ID support (track, release, artist, album, etc.)
- ReplayGain volume normalization support
- Apple Sound Check (iTunNORM) support
- Extended metadata fields (albumArtist, composer, BPM, etc.)
- Memory-efficient in-memory processing
- Multi-runtime support (Deno, Node.js, Bun, browsers, Workers)
- Comprehensive test suite
- Production examples for all platforms
- Detailed documentation

### Published

- NPM: `taglib-wasm`
