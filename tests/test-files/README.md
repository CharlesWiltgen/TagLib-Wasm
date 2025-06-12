# Test Audio Files

This directory contains sample audio files for testing `taglib-wasm` functionality.

## Directory Structure

```
test-files/
├── mp3/           # MP3 files with various tag configurations
├── flac/          # FLAC files with metadata
├── ogg/           # Ogg Vorbis files
├── wav/           # WAV files (some with INFO tags)
├── mp4/           # MP4/M4A files with iTunes-style metadata
└── README.md      # This file
```

## Recommended Test Files

### MP3 Files (`mp3/`)

- **simple.mp3** - Basic MP3 without any tags (for testing core decoder)
- **with-id3v1.mp3** - MP3 with ID3v1 tags only
- **with-id3v2.mp3** - MP3 with ID3v2 tags only
- **with-both.mp3** - MP3 with both ID3v1 and ID3v2 tags

### FLAC Files (`flac/`)

- **simple.flac** - Basic FLAC without metadata
- **with-tags.flac** - FLAC with Vorbis comments

### OGG Files (`ogg/`)

- **simple.ogg** - Basic Ogg Vorbis file
- **with-vorbis-comments.ogg** - Ogg with metadata

### WAV Files (`wav/`)

- **minimal.wav** - Smallest valid WAV file
- **with-info-tags.wav** - WAV with INFO chunk metadata

### MP4 Files (`mp4/`)

- **simple.m4a** - Basic MP4 audio
- **with-metadata.m4a** - MP4 with iTunes-style metadata

## Testing Strategy

1. **Start with minimal.wav** - Simplest format to verify basic functionality
2. **Test simple.mp3** - Most common format
3. **Progress to files with metadata** - Test tag reading/writing
4. **Test all formats** - Ensure comprehensive codec support

## File Sources

When adding files, prefer:

- Small file sizes (< 100KB when possible)
- Creative Commons or public domain content
- Self-generated test tones/silence
- Avoid copyrighted material

## Usage in Tests

Files in this directory are used by:

- `test-real-file.ts` - Manual testing script
- `tests/` - Automated test suite
- `examples/` - Documentation examples
