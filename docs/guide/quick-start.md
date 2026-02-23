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
// Output: { title: "My Song", artist: "Artist Name", album: "Album Name", ... }

// Read audio properties
const props = await readProperties("song.mp3");
console.log(props);
// Output: { length: 180, bitrate: 320, sampleRate: 44100, channels: 2, codec: "MP3", isLossless: false, bitsPerSample: 16 }
```

### Writing Tags

```typescript
import { applyTags, updateTags } from "taglib-wasm/simple";

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
await updateTags("song.mp3", {
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
console.log(`Duration: ${props.length} seconds`);
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
file.setMusicBrainzTrackId("12345678-90ab-cdef-1234-567890abcdef");
file.setMusicBrainzReleaseId("abcdef12-3456-7890-abcd-ef1234567890");

// AcoustID fingerprinting
file.setAcoustIdFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustIdId("e7359e88-f1f7-41ed-b9f6-16e58e906997");

// ReplayGain volume normalization
file.setReplayGainTrackGain("-6.54 dB");
file.setReplayGainTrackPeak("0.987654");
```

### Using Tag Constants

#### Enhanced PROPERTIES Constant (Recommended)

For the best type safety and rich metadata access, use the `PROPERTIES` constant:

```typescript
import { PROPERTIES } from "taglib-wasm/constants";

// Access property metadata
const titleProp = PROPERTIES.TITLE;
console.log(titleProp.description); // "The title of the track"
console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]

// Read properties with type safety
const title = file.getProperty(PROPERTIES.TITLE.key);
const albumArtist = file.getProperty(PROPERTIES.ALBUMARTIST.key);

// Write properties
file.setProperty(PROPERTIES.TITLE.key, "My Song");
file.setProperty(PROPERTIES.BPM.key, "120");

// Set multiple properties
file.setProperties({
  [PROPERTIES.TITLE.key]: ["My Song"],
  [PROPERTIES.ALBUMARTIST.key]: ["Various Artists"],
  [PROPERTIES.BPM.key]: ["120"],
});
```

#### Legacy Tags Constants

For backward compatibility, the `Tags` constants are still available:

```typescript
import { Tags } from "taglib-wasm";

// Read properties with constants
const properties = file.properties();
const title = properties[Tags.Title]?.[0];
const albumArtist = properties[Tags.AlbumArtist]?.[0];

// Write properties with constants
file.setProperties({
  [Tags.Title]: ["My Song"],
  [Tags.AlbumArtist]: ["Various Artists"],
  [Tags.Bpm]: ["120"],
});
```

## Platform Examples

### Node.js

```typescript
import { TagLib } from "taglib-wasm";
import { readFile, writeFile } from "fs/promises";

const taglib = await TagLib.initialize();
const audioData = await readFile("input.mp3");
using file = await taglib.open(new Uint8Array(audioData));

file.setTitle("Node.js Title");
file.save();

// Get updated buffer after saving
const updatedData = file.getFileBuffer();
await writeFile("output.mp3", updatedData);
```

### Browser

```typescript
import { TagLib } from "taglib-wasm";

// From file input
const fileInput = document.querySelector('input[type="file"]');
const audioFile = fileInput.files[0];
const audioData = new Uint8Array(await audioFile.arrayBuffer());

const taglib = await TagLib.initialize();
using file = await taglib.open(audioData);

// Display metadata
document.getElementById("title").textContent = file.tag().title;
document.getElementById("artist").textContent = file.tag().artist;
```

### Cloudflare Workers

```typescript
import { TagLib } from "taglib-wasm";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const taglib = await TagLib.initialize();

      const audioData = new Uint8Array(await request.arrayBuffer());
      using file = await taglib.open(audioData);

      const metadata = {
        title: file.tag().title,
        artist: file.tag().artist,
        duration: file.audioProperties().length,
      };

      return Response.json({ success: true, metadata });
    }

    return new Response("Send POST with audio file", { status: 400 });
  },
};
```

## Error Handling

Always handle potential errors:

```typescript
try {
  using file = taglib.openFile(audioData);

  if (!file.isValid()) {
    throw new Error("Invalid audio file format");
  }

  // Process file...
} catch (error) {
  console.error("Error processing audio file:", error);
}
```

## Next Steps

- Explore [Tag Name Constants](/api/tag-constants) for format-agnostic
  metadata handling
- Learn about [Runtime Compatibility](/concepts/runtime-compatibility) for your
  platform
- Check the [API Reference](/api/) for all available methods
