# Quick Start

This guide will get you reading and writing audio metadata in minutes.

## Simple API (Recommended)

The Simple API provides the easiest way to work with audio metadata:

### Reading Tags

```typescript
import { readProperties, readTags } from "taglib-wasm/simple";

// Read basic tags
const tags = await readTags("song.mp3");
console.log(tags);
// Output: { title: ["My Song"], artist: ["Artist Name"], album: ["Album Name"], ... }

// Read audio properties
const props = await readProperties("song.mp3");
console.log(props);
// Output: { duration: 180, bitrate: 320, sampleRate: 44100, channels: 2, bitsPerSample: 16, codec: "MP3", containerFormat: "MP3", isLossless: false }
```

### Writing Tags

```typescript
import { applyTags, applyTagsToFile } from "taglib-wasm/simple";

// Apply tags and get modified buffer (in-memory)
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
  year: 2024,
  genre: "Electronic",
});
// Save modifiedBuffer to file if needed

// Or update tags directly on disk (requires file path)
await applyTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### Working with File Buffers

```typescript
import { readFile, writeFile } from "fs/promises";
import { applyTags, readTags } from "taglib-wasm/simple";

// Read from buffer
const buffer = await readFile("song.mp3");
const tags = await readTags(buffer);

// Apply tags to buffer
const updatedBuffer = await applyTags(buffer, {
  title: "Updated Title",
});
await writeFile("song-updated.mp3", updatedBuffer);
```

## Full API (Advanced)

For more control, use the Full API:

### Basic Usage

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

// Initialize TagLib
const taglib = await TagLib.initialize();

// Load audio file
const audioData = await readFile("song.mp3");
using file = await taglib.open(new Uint8Array(audioData));

// Check if file is valid
if (!file.isValid()) {
  console.error("Invalid audio file");
  return;
}

// Read metadata
const tags = file.tag();
console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Album: ${tags.album}`);

// Read audio properties
const props = file.audioProperties();
console.log(`Duration: ${props.duration} seconds`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);
console.log(`Bits per sample: ${props.bitsPerSample}`);

// Update metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");

// Save changes
const success = file.save();
if (success) {
  console.log("Tags saved successfully");
  const updatedBuffer = file.getFileBuffer();
  // Write updatedBuffer to file if needed
}
```

### Advanced Metadata

```typescript
// MusicBrainz integration
file.setProperty("musicbrainzTrackId", "12345678-90ab-cdef-1234-567890abcdef");
file.setProperty(
  "musicbrainzReleaseId",
  "abcdef12-3456-7890-abcd-ef1234567890",
);

// AcoustID fingerprinting
file.setProperty("acoustidFingerprint", "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setProperty("acoustidId", "e7359e88-f1f7-41ed-b9f6-16e58e906997");

// ReplayGain volume normalization
file.setProperty("replayGainTrackGain", "-6.54 dB");
file.setProperty("replayGainTrackPeak", "0.987654");
```

### Using Tag Constants

#### Enhanced PROPERTIES Constant (Recommended)

For the best type safety and rich metadata access, use the `PROPERTIES`
constant:

```typescript
import { PROPERTIES } from "taglib-wasm";

// Access property metadata
const titleProp = PROPERTIES.title;
console.log(titleProp.description); // "The title of the track"
console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]

// Read properties with type safety (arrays; ?.[0] for the first value)
const title = file.getProperty(PROPERTIES.title.key)?.[0];
const albumArtist = file.getProperty(PROPERTIES.albumArtist.key)?.[0];

// Write properties
file.setProperty(PROPERTIES.title.key, "My Song");
file.setProperty(PROPERTIES.bpm.key, "120");

// Set multiple properties
file.setProperties({
  [PROPERTIES.title.key]: ["My Song"],
  [PROPERTIES.albumArtist.key]: ["Various Artists"],
  [PROPERTIES.bpm.key]: ["120"],
});
```

## Platform Examples

The API is identical on every runtime — only file access differs. The
[Platform Guide](./platform-examples.md) has a worked example for each: Node.js,
Deno and Bun, the browser's File API plus the download step, Web Workers, and
Cloudflare Workers with its buffer-only and memory constraints.

## Error Handling

Handle errors:

```typescript
try {
  using file = await taglib.open(audioData);

  if (!file.isValid()) {
    throw new Error("Invalid audio file format");
  }

  // Process file...
} catch (error) {
  console.error("Error processing audio file:", error);
}
```

## Next Steps

- Explore [Tag Name Constants](/api/tag-constants) for format-agnostic metadata
  handling
- Learn about [Runtime Compatibility](/concepts/runtime-compatibility) for your
  platform
- Check the [API Reference](/api/) for all available methods
