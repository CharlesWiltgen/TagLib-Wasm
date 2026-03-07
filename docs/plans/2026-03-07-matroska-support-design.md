# Matroska/WebM Support Design

## Context

TagLib 2.2.1 added Matroska (MKA/MKV) and WebM support. The underlying C++ library is compiled and working, but TagLib-Wasm's TypeScript and C API layers don't expose the format yet.

## Decisions

- **Single format type**: `"matroska"` covers all three extensions (.mkv, .mka, .webm). WebM is a subset of Matroska; TagLib uses one `Matroska::File` class internally.
- **Magic byte detection**: Add EBML signature (`0x1A 0x45 0xDF 0xA3`) to `tl_detect_format()` for consistency with all other formats.
- **Test files**: Copy from TagLib's test suite (`lib/taglib/tests/data/no-tags.mka`). Tagged fixture generation deferred.

## Changes

### C layer

- `src/capi/core/taglib_core.h` — Add `TL_FORMAT_MATROSKA` enum variant
- `src/capi/taglib_boundary.c` — Add EBML magic byte detection in `tl_detect_format()` and `"matroska"` case in `tl_format_name()`

### TypeScript types

- `src/types/audio-formats.ts` — Add `"matroska"` to `FileType`, `"Matroska"` to `ContainerFormat`

### Constants

- `src/errors/base.ts` — Add `"matroska"` to `SUPPORTED_FORMATS`
- `src/folder-api/types.ts` — Add `.mkv`, `.mka`, `.webm` to `DEFAULT_AUDIO_EXTENSIONS`

### Tests

- `tests/shared-fixtures.ts` — Add `"matroska"` to format lists and expected audio properties
- `tests/test-utils.ts` — Add matroska test file entry
- Copy `no-tags.mka` from `lib/taglib/tests/data/` to `tests/test-files/`

### Unchanged

- `taglib_shim.cpp` — FileRef handles Matroska automatically
- Build scripts — Matroska compiles with default CMake flags
- Property mapping — same property map interface as other formats

## Out of scope

- WebM as a separate format type
- Tagged test file generation for roundtrip tests
- Matroska-specific chapter/attachment APIs
