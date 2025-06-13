# Changelog

All notable changes to taglib-wasm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [1.0.0] - 2024-12-08

### Added
- Production-ready WebAssembly port of TagLib v2.1
- Full support for MP3, MP4/M4A, FLAC, OGG Vorbis, and WAV formats
- Simple API for easy tag reading/writing (3 functions)
- Core API for full control and advanced features
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
- JSR: `@charleswiltgen/taglib-wasm`
- NPM: `taglib-wasm`

## [0.9.0] - 2024-12-01 (Pre-release)

### Added
- Initial WebAssembly compilation of TagLib
- Basic tag reading and writing
- Audio properties extraction
- Support for major audio formats
- TypeScript bindings
- Basic test suite

### Changed
- Migrated from C-style API to cleaner TypeScript wrapper
- Improved memory management with Emscripten's allocate()

### Fixed
- Memory corruption issues with buffer allocation
- UTF-8 string encoding problems
- Format detection reliability

## [0.5.0] - 2024-11-15 (Alpha)

### Added
- Initial proof of concept
- TagLib compilation to WebAssembly
- Basic MP3 ID3 tag reading
- Simple Node.js example

### Known Issues
- Limited format support
- Memory leaks with some operations
- No TypeScript support