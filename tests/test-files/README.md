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
by `tests/media-ranges.test.ts` — except `mp3/large-1_2MiB.mp3`, which
`tests/media-checksum.test.ts` consumes. The tests also read TagLib's own test
data (`lib/taglib/tests/data/{bladeenc.mp3,empty1s.aac,ape-id3v1.mp3}`) as the
oracle for frame boundaries.

| Fixture                                 | Layout                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mp3/tags-only.mp3`                     | 148 bytes: a 20-byte ID3v2 tag plus the 128-byte ID3v1 block and no audio frames — the walk must fall back                                                                                                   |
| `flac/flac-prepended-id3v2.flac`        | `flac/kiss-snippet.flac` behind an ID3v2.4 tag                                                                                                                                                               |
| `flac/flac-prepended-id3v2-footer.flac` | the same stream behind an ID3v2.4 tag with the v2.4 footer: header flag `0x10` plus the ten footer bytes the size field does not count                                                                       |
| `flac/flac-appended-id3v1.flac`         | `flac/kiss-snippet.flac` followed by the 128-byte ID3v1 block                                                                                                                                                |
| `flac/flac-appended-ape.flac`           | the same stream followed by a headerless APEv2 tag: the 32-byte footer alone, size field 32, header-present bit clear                                                                                        |
| `flac/flac-both-tags.flac`              | the same stream followed by both trailing tag kinds, the ID3v1 block outermost                                                                                                                               |
| `mp4/synth-multi-mdat.mp4`              | 176 bytes, seven atoms: `ftyp` (24), `free` (16), `mdat` (32 contents), a 64-bit-size `mdat` (24 contents), an empty `mdat` (8), `moov` (24), `mdat` (16 contents) — three payload ranges, at 48, 96 and 160 |
| `wav/synth-plain.wav`                   | 4140 bytes: `fmt` (16) then `data` (4096) — the untagged half of the matched pair, so its payload is at 44                                                                                                   |
| `wav/synth-tags-before-data.wav`        | 4184 bytes: the same 4096-byte payload behind `LIST` (18) and `id3` (10) chunks — the payload is at 88                                                                                                       |
| `wav/synth-multi-data.wav`              | 84 bytes: `fmt` (16) then an EMPTY `data` (0), `data` (16) and `data` (8) — two payload ranges, at 52 and 76, with the empty chunk first                                                                     |
| `mp3/large-1_2MiB.mp3`                  | 1180510 bytes: `mp3/kiss-snippet.mp3` with its 1044-byte last frame (at 84182) repeated 1049 times, then the 128-byte ID3v1 block — the one fixture a `File` input is spliced for                            |

The last one is not a hand-laid byte string, so it has its own mode:
`python3 tests/test-files/_gen/make-media-range-fixtures.py --large` builds only
it, while the bare command builds every fixture. It is the fixture
`tests/media-checksum.test.ts` needs for the spec's input-form equivalence — the
File, `Uint8Array` and path routes must hash the same bytes — and on a small file
those routes agree by construction because the loader never splices. At 1180510
bytes it clears `TagLib.open`'s 1 MiB + 128 KiB partial-load window by 862 bytes,
so a `File` input is spliced to a 1179648-byte header+footer image instead of
read whole. The repeated bytes are real MPEG audio, not padding, so the
spliced-away 862 bytes are payload; and the ID3v1 block puts a trailer in the
footer window, so the splice has to clear the header gate and the trailer gate.
An MP3 rather than a WAV because RIFF is not a container `metadataFitsInHeader`
recognises, so a WAV of any size is never spliced.

The five FLAC variants all wrap one 245430-byte stream, so the property they
exist for is that the FLAC walk hashes their payload identically to the untagged
base. Note the footer variant: TagLib counts the ID3v2.4 footer
(`ID3v2::Header::completeTagSize()`) and libFLAC does not, so `metaflac` rejects
that file as "not a FLAC file" while TagLib reads the stream behind it — the
disagreement is the reason the fixture exists, not a defect in it.

The MP4 fixture is the multi-`mdat` oracle, and its three ranges are what pin
the 64-bit size path: an atom's size field counts its own header, 16 bytes of it
in that form rather than 8, and a legal empty `mdat` contributes no range at all.

The WAV pair is the same kind of oracle for a container whose payload moves: both
files carry one 4096-byte `data` payload, and inserting the `LIST` + `id3`
chunks moves it from 44 to 88. Their hashes agreeing is the property under test;
the two offsets are the by-construction check that they agree over the payload
rather than over, say, two identically-wrong ranges. Neither file has an
odd-sized chunk, so the walk's pad-byte rule is pinned by `wav/bext-ixml.wav`
instead: its 629-byte `bext` chunk sits after `data`, and a walk that ignored the
pad byte would misalign and fall back. Every WAV fixture but one carries exactly
one non-empty `data` chunk, so `wav/synth-multi-data.wav` is what pins the rule
that _every_ non-empty chunk contributes, in chunk order — it leads with an empty
`data`, which a walk taking the first chunk unconditionally would answer with a
zero-length range.

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
