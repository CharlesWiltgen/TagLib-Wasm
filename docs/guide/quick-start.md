# Quick Start

This guide will get you reading and writing audio metadata in minutes.

## Simple API (Recommended)

The Simple API provides the easiest way to work with audio metadata:

### Reading Tags

```typescript
import { readTags, readProperties } from "taglib-wasm/simple";

// Read basic tags
const tags = await readTags("song.mp3");
console.log(tags);
// Output: { title: "My Song", artist: "Artist Name", album: "Album Name", ... }

// Read audio properties
const props = await readProperties("song.mp3");
console.log(props);
// Output: { length: 180, bitrate: 320, sampleRate: 44100, channels: 2 }
```

### Writing Tags

```typescript
import { writeTags } from "taglib-wasm/simple";

// Update specific tags
await writeTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
  year: 2024,
  genre: "Electronic"
});
```

### Working with File Buffers

```typescript
import { readFile, writeFile } from "fs/promises";
import { readTags, writeTags } from "taglib-wasm/simple";

// Read from buffer
const buffer = await readFile("song.mp3");
const tags = await readTags(buffer);

// Write to buffer
const updatedBuffer = await writeTags(buffer, {
  title: "Updated Title"
});
await writeFile("song-updated.mp3", updatedBuffer);
```

## Core API (Advanced)

For more control, use the Core API:

### Basic Usage

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

// Initialize TagLib
const taglib = await TagLib.initialize();

// Load audio file
const audioData = await readFile("song.mp3");
const file = taglib.openFile(new Uint8Array(audioData));

// Check if file is valid
if (!file.isValid()) {
  console.error("Invalid audio file");
  file.dispose();
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

// Update metadata
file.setTitle("New Title");
file.setArtist("New Artist");

// Save changes (returns updated buffer)
const success = file.save();
if (success) {
  console.log("Tags saved successfully");
}

// Clean up
file.dispose();
```

### Advanced Metadata

```typescript
// MusicBrainz integration
file.setMusicBrainzTrackId("12345678-90ab-cdef-1234-567890abcdef");
file.setMusicBrainzReleaseId("abcdef12-3456-7890-abcd-ef1234567890");

// AcoustID fingerprinting
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");

// ReplayGain volume normalization
file.setReplayGainTrackGain("-6.54 dB");
file.setReplayGainTrackPeak("0.987654");
```

### Using Tag Constants

For better type safety and IDE autocomplete, use the `Tags` constants:

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
  [Tags.Bpm]: ["120"]
});
```

## Platform Examples

### Node.js

```typescript
import { TagLib } from "taglib-wasm";
import { readFile, writeFile } from "fs/promises";

const taglib = await TagLib.initialize();
const audioData = await readFile("input.mp3");
const file = taglib.openFile(new Uint8Array(audioData));

file.setTitle("Node.js Title");
file.save();

// Save to file if needed
const updatedData = file.getFileData();
await writeFile("output.mp3", updatedData);

file.dispose();
```

### Browser

```typescript
import { TagLib } from "taglib-wasm";

// From file input
const fileInput = document.querySelector('input[type="file"]');
const audioFile = fileInput.files[0];
const audioData = new Uint8Array(await audioFile.arrayBuffer());

const taglib = await TagLib.initialize();
const file = taglib.openFile(audioData);

// Display metadata
document.getElementById('title').textContent = file.tag().title;
document.getElementById('artist').textContent = file.tag().artist;

file.dispose();
```

### Cloudflare Workers

```typescript
import { TagLib } from "taglib-wasm/workers";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const taglib = await TagLib.initialize({
        memory: { initial: 8 * 1024 * 1024 }
      });
      
      const audioData = new Uint8Array(await request.arrayBuffer());
      const file = taglib.openFile(audioData);
      
      const metadata = {
        title: file.tag().title,
        artist: file.tag().artist,
        duration: file.audioProperties().length
      };
      
      file.dispose();
      
      return Response.json({ success: true, metadata });
    }
    
    return new Response("Send POST with audio file", { status: 400 });
  }
};
```

## Error Handling

Always handle potential errors:

```typescript
try {
  const file = taglib.openFile(audioData);
  
  if (!file.isValid()) {
    throw new Error("Invalid audio file format");
  }
  
  // Process file...
  
  file.dispose();
} catch (error) {
  console.error("Error processing audio file:", error);
}
```

## Next Steps

- Explore [Automatic Tag Mapping](/Automatic-Tag-Mapping.md) for format-agnostic metadata
- Learn about [Runtime Compatibility](/Runtime-Compatibility.md) for your platform
- Check the [API Reference](/API.md) for all available methods