# Audio Codec Detection in taglib-wasm

As of v0.3.20, taglib-wasm now provides codec detection and lossless audio
detection capabilities.

## New AudioProperties Fields

The `AudioProperties` interface now includes three new fields:

```typescript
interface AudioProperties {
  // ... existing fields ...

  /** Bits per sample (0 if not applicable or unknown) */
  readonly bitsPerSample: number;

  /** Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM") */
  readonly codec: string;

  /** Whether the audio is lossless (uncompressed or losslessly compressed) */
  readonly isLossless: boolean;
}
```

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
const file = await taglib.open(audioBuffer);
const props = file.audioProperties();

if (props) {
  console.log(`Codec: ${props.codec}`);
  console.log(`Is lossless: ${props.isLossless}`);
  console.log(`Bits per sample: ${props.bitsPerSample}`);

  // Distinguish between AAC and ALAC in MP4/M4A files
  if (file.getFormat() === "MP4") {
    if (props.codec === "AAC") {
      console.log("This is an AAC file (lossy)");
    } else if (props.codec === "ALAC") {
      console.log("This is an Apple Lossless file");
    }
  }
}
```

## Implementation Notes

- The codec detection leverages TagLib's native properties classes
- Bits per sample is only available for formats that support it (FLAC, WAV,
  AIFF, MP4)
- The Workers API (Cloudflare Workers compatibility mode) returns default values
  for these new fields
