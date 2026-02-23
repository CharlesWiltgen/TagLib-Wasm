# Audio Container and Codec Detection in TagLib-Wasm

As of v0.3.20, TagLib-Wasm provides codec detection and lossless audio
detection capabilities. As of v0.4.0, container format detection has been
added to differentiate between container formats and compressed media formats.

## New AudioProperties Fields

The `AudioProperties` interface now includes these additional fields:

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
}
```

## Container vs Codec

Understanding the difference between container formats and codecs is important:

- **Container Format**: Defines how audio data and metadata are packaged in a file (e.g., MP4, OGG)
- **Codec**: Defines how the audio is compressed/encoded (e.g., AAC, Vorbis)

Some formats like MP3 and FLAC are both container and codec, while others like MP4 and OGG are containers that can hold different codecs:

- **MP4 container** (includes .m4a files): Can contain AAC (lossy) or ALAC (lossless)
- **OGG container**: Can contain Vorbis, Opus, FLAC, or Speex codecs
- **MP3**: Both container and codec
- **FLAC**: Both container and codec

## Container Format Detection

The `containerFormat` field returns:

- `"MP4"` - ISO Base Media File Format (includes .m4a files)
- `"OGG"` - Ogg container
- `"MP3"` - MPEG Layer 3
- `"FLAC"` - Free Lossless Audio Codec
- `"WAV"` - RIFF WAVE format
- `"AIFF"` - Audio Interchange File Format
- `"UNKNOWN"` - Format could not be determined

## Codec Detection

The `codec` field returns a string identifying the audio codec:

- **MP4/M4A files**: `"AAC"` or `"ALAC"`
- **MP3 files**: `"MP3"`
- **FLAC files**: `"FLAC"`
- **OGG files**: `"Vorbis"` or `"Opus"`
- **WAV files**: `"PCM"`, `"IEEE Float"`, or `"WAV"` (for other codecs)
- **AIFF files**: `"PCM"`
- **Unknown**: `"Unknown"`

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
- The Workers API (Cloudflare Workers compatibility mode) returns default values for these fields
