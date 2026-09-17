# Test Audio Files

This directory contains sample audio files for testing `taglib-wasm`
functionality.

## Directory Structure

```
test-files/
├── mp3/           # MP3 files with various tag configurations
├── flac/          # FLAC files with metadata
├── ogg/           # Ogg Vorbis files
├── wav/           # WAV files (some with INFO tags)
├── mp4/           # MP4/M4A files with iTunes-style metadata
├── opus/          # Opus files (Ogg container)
├── oga/           # Ogg files: Vorbis (.oga alias) + FLAC-in-Ogg
├── aac/           # ADTS / raw AAC streams
├── speex/         # Ogg Speex
├── wv/            # WavPack lossless audio
├── tta/           # TrueAudio lossless audio
├── wma/           # Windows Media Audio (ASF container)
└── README.md      # This file
```

### Codec-identity fixtures

`aac/empty1s.aac`, `oga/kiss-snippet-flac.oga`, and `speex/kiss-snippet.spx`
guard that the reported codec/container/format come from the audio STREAM, not
the TagLib file class — ADTS shares `MPEG::File` with MP3, and FLAC/Speex share
the Ogg reader with Vorbis/Opus. They are consumed by `tests/adts-label.test.ts`
and `tests/ogg-flavor-parity.test.ts`; regenerate with
`bash tests/test-files/_gen/make-codec-identity-fixtures.sh --regen`.

### Media-checksum fixtures

Built by `python3 tests/test-files/_gen/make-media-range-fixtures.py` and consumed
by `tests/media-ranges.test.ts`. The tests also read TagLib's own test data
(`lib/taglib/tests/data/{bladeenc.mp3,empty1s.aac,ape-id3v1.mp3}`) as the oracle
for frame boundaries.

| Fixture                                 | Layout                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mp3/tags-only.mp3`                     | 148 bytes: a 20-byte ID3v2 tag plus the 128-byte ID3v1 block and no audio frames — the walk must fall back                                                                                                   |
| `flac/flac-prepended-id3v2.flac`        | `flac/kiss-snippet.flac` behind an ID3v2.4 tag                                                                                                                                                               |
| `flac/flac-prepended-id3v2-footer.flac` | the same stream behind an ID3v2.4 tag with the v2.4 footer: header flag `0x10` plus the ten footer bytes the size field does not count                                                                       |
| `flac/flac-appended-id3v1.flac`         | `flac/kiss-snippet.flac` followed by the 128-byte ID3v1 block                                                                                                                                                |
| `flac/flac-appended-ape.flac`           | the same stream followed by a headerless APEv2 tag: the 32-byte footer alone, size field 32, header-present bit clear                                                                                        |
| `flac/flac-both-tags.flac`              | the same stream followed by both trailing tag kinds, the ID3v1 block outermost                                                                                                                               |
| `mp4/synth-multi-mdat.mp4`              | 176 bytes, seven atoms: `ftyp` (24), `free` (16), `mdat` (32 contents), a 64-bit-size `mdat` (24 contents), an empty `mdat` (8), `moov` (24), `mdat` (16 contents) — three payload ranges, at 48, 96 and 160 |

The five FLAC variants all wrap one 245430-byte stream, so the property they
exist for is that the FLAC walk hashes their payload identically to the untagged
base. Note the footer variant: TagLib counts the ID3v2.4 footer
(`ID3v2::Header::completeTagSize()`) and libFLAC does not, so `metaflac` rejects
that file as "not a FLAC file" while TagLib reads the stream behind it — the
disagreement is the reason the fixture exists, not a defect in it.

The MP4 fixture is the multi-`mdat` oracle, and its three ranges are what pin
the 64-bit size path: an atom's size field counts its own header, 16 bytes of it
in that form rather than 8, and a legal empty `mdat` contributes no range at all.

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
