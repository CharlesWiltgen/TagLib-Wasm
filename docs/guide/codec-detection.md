# Audio Container and Codec Detection

`AudioProperties` answers two separate questions about a file: which **container
format** it is (how the audio and its metadata are packaged — MP4, OGG, WAV) and
which **codec** the audio inside uses (how it is encoded — AAC, Vorbis, PCM). It
also reports whether that codec is lossless.

## AudioProperties Fields

The `AudioProperties` interface carries these fields:

```typescript
interface AudioProperties {
  // ... existing fields ...

  /** Bits per sample (0 if not applicable or unknown) */
  readonly bitsPerSample: number;

  /** Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM") */
  readonly codec: string;

  /** Container format (e.g., "MP4", "OGG", "MP3", "FLAC") */
  readonly containerFormat: string;

  /** Whether the audio is lossless (uncompressed or losslessly compressed) */
  readonly isLossless: boolean;

  /** Bitrate mode (MP3 only — undefined for formats where it is not meaningful or detectable) */
  readonly bitrateMode?: "CBR" | "VBR" | "ABR";
}
```

## Bitrate Mode (MP3)

For MP3 files, `bitrateMode` reports whether the file uses constant (`"CBR"`),
variable (`"VBR"`), or average (`"ABR"`) bitrate encoding. Detection is based on
the LAME extension header in the first MPEG frame; older or non-LAME-encoded
files may fall back to detection from the Xing/Info/VBRI magic alone.

The field is `undefined` for non-MP3 formats and for headerless MP3 files where
the mode cannot be determined. Lossless formats (FLAC, WAV, AIFF, ALAC) are not
reported as VBR/CBR — use `isLossless` instead.

## Container vs Codec

Understanding the difference between container formats and codecs is important:

- **Container Format**: Defines how audio data and metadata are packaged in a file (e.g., MP4, OGG)
- **Codec**: Defines how the audio is compressed/encoded (e.g., AAC, Vorbis)

Some formats like MP3 and FLAC are both container and codec, while others like MP4 and OGG are containers that can hold different codecs:

- **MP4 container** (includes .m4a files): Can contain AAC, ALAC, AC-3, E-AC-3, DTS, FLAC, or Opus
- **OGG container**: Can contain Vorbis, Opus, FLAC, or Speex codecs
- **MP3**: Both container and codec
- **FLAC**: Both container and codec

## Container Format Detection

The `containerFormat` field returns one of the 21 `ContainerFormat` members —
the 20 containers below, plus `"unknown"` when the format could not be
determined:

- `"MP3"` - MPEG Layer 3 (container and codec)
- `"ADTS"` - Audio Data Transport Stream (raw AAC, `.aac`)
- `"MP4"` - ISO Base Media File Format (includes .m4a files)
- `"FLAC"` - Free Lossless Audio Codec (container and codec)
- `"OGG"` - Ogg container (Vorbis, Opus, FLAC, Speex)
- `"WAV"` - RIFF WAVE format
- `"AIFF"` - Audio Interchange File Format
- `"ASF"` - Advanced Systems Format (WMA/WMV)
- `"APE"` - Monkey's Audio container
- `"DSF"` - DSD Stream File
- `"DSDIFF"` - DSD Interchange File Format
- `"WavPack"` - WavPack container
- `"MPC"` - Musepack container
- `"TTA"` - TrueAudio container
- `"Shorten"` - Shorten container
- `"MOD"` - ProTracker module
- `"S3M"` - Scream Tracker 3 module
- `"IT"` - Impulse Tracker module
- `"XM"` - Extended module
- `"Matroska"` - Matroska container (MKA, MKV, WebM)

Watch the spelling split: `ContainerFormat` uses `"WavPack"`, `"Shorten"` and
`"Matroska"`, while `getFormat()` and `SUPPORTED_FORMATS` use the `FileType`
literals `"WV"`, `"SHN"` and `"MATROSKA"` for the same three formats.

## Codec Detection

The `codec` field returns a string identifying the audio codec:

- **MP4/M4A files**: `"AAC"`, `"ALAC"`, `"AC-3"`, `"E-AC-3"`, `"DTS"`, `"FLAC"`, `"Opus"`, or `"unknown"` (a sample entry TagLib cannot classify)
- **MP3 files**: `"MP3"`
- **ADTS / raw AAC files** (`.aac`): `"AAC"`
- **FLAC files**: `"FLAC"`
- **OGG files**: `"Vorbis"`, `"Opus"`, `"FLAC"` (FLAC-in-Ogg), or `"Speex"`
- **WAV files**: `"PCM"` (format 1), `"IEEEFloat"` (format 3), or `"WAV"` for
  other codecs — note the three-way answer is Emscripten-only. The WASI shim
  reports `"PCM"` for every WAV regardless of its format chunk, so a
  floating-point WAV is indistinguishable from integer PCM there
  (taglib-e2cg).
- **AIFF files**: `"PCM"`
- **Unclassified**: `"unknown"`

## Lossless Detection

The `isLossless` field returns `true` for:

- Uncompressed formats (PCM, IEEE Float)
- Losslessly compressed formats (FLAC, ALAC)

And `false` for lossy formats (AAC, MP3, Vorbis, Opus).

## Example Usage

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open(audioBuffer);
const props = file.audioProperties();

if (props) {
  console.log(`Container: ${props.containerFormat}`);
  console.log(`Codec: ${props.codec}`);
  console.log(`Is lossless: ${props.isLossless}`);
  console.log(`Bits per sample: ${props.bitsPerSample}`);

  // Example: Distinguish between different MP4/M4A codecs
  if (props.containerFormat === "MP4") {
    if (props.codec === "AAC") {
      console.log("This is an MP4/M4A file with AAC audio (lossy)");
    } else if (props.codec === "ALAC") {
      console.log("This is an MP4/M4A file with Apple Lossless audio");
    }
  }

  // Example: OGG container can have different codecs
  if (props.containerFormat === "OGG") {
    console.log(`OGG container with ${props.codec} codec`);
  }
}
```

## Implementation Notes

- Container format detection uses TagLib's file type identification
- Codec detection leverages TagLib's native properties classes
- M4A files are identified as MP4 containers (ISOBMFF) since M4A is just a file extension convention
- Bits per sample is only available for formats that support it (FLAC, WAV, AIFF, MP4)
- The two backends do not describe every format alike. On the Emscripten
  backend — browsers, Web Workers, and Cloudflare Workers — the sniffer only
  places the containers it recognizes, so nine of the formats the library reads
  (APE, DSF, DSDIFF, MPC, SHN, MOD, S3M, IT, XM) report `"unknown"` for both
  `containerFormat` and `codec`, with `isLossless` `false`, `bitsPerSample` `0`,
  and `bitrateMode` `undefined`. Their tags, duration, bitrate, sample rate, and
  channel count all load, and `getFormat()` names the format. The WASI backend
  (Deno, Node.js, Bun) resolves the container and codec for all nine
  (taglib-uat8).

## Next Steps

- [Implementation Guide](/advanced/implementation) — why the two backends can
  answer differently: Embind reads the buffer directly, while the WASI C shim
  serializes a MessagePack snapshot
- [Runtime Compatibility](/concepts/runtime-compatibility) — which backend each
  platform gets, and how to force one with `forceWasmType`
