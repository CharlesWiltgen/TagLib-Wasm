# taglib-wasm Usage Guide for AI Assistants

This guide helps AI assistants understand how to use the taglib-wasm library
effectively when writing code that consumes this package.

## Quick Start

```typescript
// Deno
import { TagLib } from "npm:taglib-wasm";

// Node.js/Bun
import { TagLib } from "taglib-wasm";

// Initialize the library
const taglib = await TagLib.initialize();

// Read tags from an audio file buffer
const audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

console.log({
  title: tag.title,
  artist: tag.artist,
  album: tag.album,
  year: tag.year,
});

// IMPORTANT: Always clean up
audioFile.dispose();
```

## Key Concepts

### 1. Initialization

- **Always call `TagLib.initialize()` once** before using any functionality
- This returns a TagLib instance that you use for all operations
- Store this instance and reuse it throughout your application

### 2. Memory Management

- **CRITICAL**: Always call `dispose()` on AudioFile instances when done
- Forgetting to dispose causes memory leaks as C++ objects aren't garbage
  collected
- Use try/finally blocks to ensure cleanup:

```typescript
const taglib = await TagLib.initialize();
let audioFile;
try {
  audioFile = await taglib.open(buffer);
  // ... work with file
} finally {
  audioFile?.dispose();
}
```

### 3. File Loading

- The `open` method accepts multiple input types:
  `string | ArrayBuffer | Uint8Array | File`
- For file paths (Node.js/Deno/Bun): pass the path as a string
- For buffers: pass ArrayBuffer or Uint8Array directly
- For browser File objects: pass the File directly

```typescript
const taglib = await TagLib.initialize();

// From file path (Node.js/Deno/Bun)
const audioFile1 = await taglib.open("path/to/song.mp3");

// From buffer (all environments)
// Node.js example:
import { readFile } from "fs/promises";
const buffer = await readFile("song.mp3");
const audioFile2 = await taglib.open(buffer);

// From browser File object
const audioFile3 = await taglib.open(fileFromInput);
```

## Common Patterns

### Reading Basic Tags

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

// Tags are accessed as properties, not methods
const metadata = {
  title: tag.title, // string
  artist: tag.artist, // string
  album: tag.album, // string
  year: tag.year, // number
  track: tag.track, // number
  genre: tag.genre, // string
  comment: tag.comment, // string
};

audioFile.dispose();
```

### Writing Tags

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const tag = audioFile.tag();

// Set individual tags using setter methods
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");
tag.setYear(2024);
tag.setTrack(5);

// Save changes (returns boolean)
const success = audioFile.save();

if (success) {
  // Get the modified buffer
  const modifiedBuffer = audioFile.getFileBuffer();

  // Write back to storage
  await fs.writeFile("modified.mp3", modifiedBuffer);
}

audioFile.dispose();
```

### Audio Properties

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const props = audioFile.audioProperties();

// Properties are accessed directly, not via methods
const audioInfo = {
  duration: props.length, // Duration in seconds
  bitrate: props.bitrate, // Bitrate in kb/s
  sampleRate: props.sampleRate, // Sample rate in Hz
  channels: props.channels, // Number of channels
};

audioFile.dispose();
```

### Using the Simple API

For basic operations without manual memory management:

```typescript
// Deno
import { applyTags, readTags, updateTags } from "npm:taglib-wasm/simple";

// Node.js/Bun
import { applyTags, readTags, updateTags } from "taglib-wasm/simple";

// Read tags - no need to manage AudioFile instances
const tags = await readTags("song.mp3");
console.log(tags); // { title, artist, album, year, ... }

// Apply tags to get modified buffer
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});

// Update tags in-place (file path only)
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### Advanced Metadata (PropertyMap)

```typescript
const taglib = await TagLib.initialize();
const audioFile = await taglib.open(buffer);
const propMap = audioFile.properties();

// Read all properties
const allProps = propMap.properties();

// Read specific advanced properties
const musicBrainzId = propMap.get("MUSICBRAINZ_TRACKID");
const replayGain = propMap.get("REPLAYGAIN_TRACK_GAIN");
const acoustId = propMap.get("ACOUSTID_ID");

// Write advanced properties
propMap.set("MUSICBRAINZ_ALBUMID", "some-uuid");
propMap.set("REPLAYGAIN_TRACK_GAIN", "-3.5 dB");

// Multiple values for a property
propMap.set("ARTIST", ["Main Artist", "Featured Artist"]);

// Save and get modified buffer
const success = audioFile.save();
if (success) {
  const modifiedBuffer = audioFile.getFileBuffer();
}
audioFile.dispose();
```

## Supported Formats

All formats are automatically detected from file content:

- **MP3** - ID3v1, ID3v2.3, ID3v2.4
- **MP4/M4A** - iTunes-style tags
- **FLAC** - Vorbis comments
- **OGG Vorbis** - Vorbis comments
- **WAV** - RIFF INFO chunks

## Error Handling

The library throws descriptive errors for common issues:

```typescript
const taglib = await TagLib.initialize();
try {
  const audioFile = await taglib.open(buffer);
  // ... use audioFile
  audioFile.dispose();
} catch (error) {
  if (error.message.includes("Module not initialized")) {
    // TagLib.initialize() failed
  } else if (error.message.includes("Invalid audio file format")) {
    // Unsupported or corrupted file
  } else if (error.message.includes("at least 1KB")) {
    // File too small
  }
}
```

## Platform-Specific Notes

### Node.js / Bun

- Use `fs.readFile()` or `fs.promises.readFile()` to load files
- Full filesystem access available

### Browsers

- Use `fetch()` or FileReader API to load files
- No filesystem access; work with buffers in memory

### Deno

- Import using `npm:` specifier: `import { TagLib } from 'npm:taglib-wasm'`
- Use `Deno.readFile()` to load files
- Remember to grant file permissions with `--allow-read`
- Full example:

```typescript
import { applyTags, readTags } from "npm:taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.artist);

// Modify tags (returns buffer)
const modified = await applyTags("song.mp3", {
  artist: "New Artist",
  album: "New Album",
});

// Write back to file
await Deno.writeFile("song-modified.mp3", modified);
```

### Deno Compiled Utilities

When building Deno applications that will be distributed as compiled binaries
using `deno compile`, you have three options for including the Wasm module:

#### Option 1: Embed Wasm in the Binary (Recommended)

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Read the Wasm file at compile time
const wasmBytes = await Deno.readFile(
  new URL(import.meta.resolve("npm:taglib-wasm/dist/taglib.wasm")),
);

// Initialize with embedded Wasm
const taglib = await TagLib.initialize({ wasmBinary: wasmBytes });

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Compile with:

```bash
deno compile --allow-read music-tagger.ts
```

#### Option 2: Bundle Wasm File Separately

If you prefer to keep the Wasm file external (e.g., for smaller binary size):

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Load Wasm from a file path relative to the executable
const taglib = await TagLib.initialize({
  wasmUrl: new URL("./taglib.wasm", import.meta.url).href,
});

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Then distribute both the compiled binary and the Wasm file:

```bash
# Compile the binary
deno compile --allow-read music-tagger.ts

# Copy the Wasm file
cp node_modules/taglib-wasm/dist/taglib.wasm ./

# Both files must be distributed together
# - music-tagger (or music-tagger.exe)
# - taglib.wasm
```

#### Option 3: CDN Loading with Streaming (Simplest)

For applications that have internet access, you can use CDN loading which
provides optimal performance through WebAssembly streaming compilation:

```typescript
// music-tagger.ts
import { TagLib } from "npm:taglib-wasm";

// Initialize with CDN URL for streaming compilation
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Your application logic
if (import.meta.main) {
  const [filePath] = Deno.args;
  const audioFile = await taglib.open(filePath);
  const tag = audioFile.tag();
  console.log(`Title: ${tag.title}`);
  console.log(`Artist: ${tag.artist}`);
  audioFile.dispose();
}
```

Compile with:

```bash
deno compile --allow-read --allow-net music-tagger.ts
```

#### Performance Considerations

- **CDN Loading**: Smallest binary, uses streaming compilation, requires network
  on first run
- **Embedded Wasm**: Larger binary size (~800KB) but self-contained and works
  offline
- **External Wasm**: Medium binary size but requires distributing two files
- CDN loading provides fastest initial compilation through WebAssembly streaming
- All approaches have identical memory usage and performance after
  initialization

#### Choosing the Right Approach

- **CDN Loading**: Best for utilities that typically have internet access
- **Embedded Wasm**: Best for offline-first CLI tools and air-gapped
  environments
- **External Wasm**: Best when you need small binaries but can manage multiple
  files

### Cloudflare Workers

- Import from 'taglib-wasm/workers' for compatibility
- Use `fetch()` to load files from URLs or R2 storage
- Memory limits apply; be mindful of file sizes

## Performance Tips

1. **Reuse the TagLib instance**: Call `TagLib.initialize()` once and reuse the
   instance
2. **Dispose promptly**: Free memory as soon as you're done with a file
3. **Batch operations**: If modifying multiple tags, do them all before calling
   `save()`
4. **Use Simple API for reading**: When only reading tags, `readTags()` is more
   efficient
5. **Handle large files carefully**: The entire file is loaded into memory

## Common Mistakes to Avoid

1. **Forgetting to dispose**: Always call `audioFile.dispose()`
2. **Not initializing**: Remember to call `TagLib.initialize()` first
3. **Using static methods**: `open` is an instance method, not static
4. **Assuming synchronous**: All main operations are async
5. **Modifying after dispose**: Can't use an AudioFile after calling `dispose()`
6. **Wrong save pattern**: Use `save()` then `getFileBuffer()` to get modified
   data

## Type Definitions

Key interfaces to reference:

```typescript
interface Tag {
  // Properties (read)
  title: string;
  artist: string;
  album: string;
  year: number;
  track: number;
  genre: string;
  comment: string;

  // Methods (write)
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
  setGenre(value: string): void;
  setComment(value: string): void;
}

interface AudioProperties {
  length: number; // Duration in seconds
  bitrate: number; // Bitrate in kb/s
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of channels
}

interface PropertyMap {
  get(key: string): string | string[] | undefined;
  set(key: string, value: string | string[]): boolean;
  properties(): Record<string, string[]>;
}
```

## Example: Complete Music Library Scanner

### Node.js/Bun Version

```typescript
import { TagLib } from "taglib-wasm";
import { readdir, readFile } from "fs/promises";
import { extname, join } from "path";

async function scanMusicLibrary(directory: string) {
  const taglib = await TagLib.initialize();

  const files = await readdir(directory, { recursive: true });
  const musicFiles = files.filter((f) =>
    [".mp3", ".flac", ".m4a", ".ogg"].includes(extname(f).toLowerCase())
  );

  const library = [];

  for (const file of musicFiles) {
    try {
      const path = join(directory, file);
      const buffer = await readFile(path);
      const audioFile = await taglib.open(buffer);

      const tag = audioFile.tag();
      const props = audioFile.audioProperties();

      library.push({
        path,
        title: tag.title,
        artist: tag.artist,
        album: tag.album,
        duration: props.length,
        bitrate: props.bitrate,
      });

      audioFile.dispose();
    } catch (error) {
      console.error(`Failed to read ${file}:`, error.message);
    }
  }

  return library;
}
```

### Deno Version

```typescript
import { TagLib } from "npm:taglib-wasm";

async function scanMusicLibrary(directory: string) {
  const taglib = await TagLib.initialize();
  const library = [];

  for await (const entry of Deno.readDir(directory)) {
    if (
      entry.isFile &&
      [".mp3", ".flac", ".m4a", ".ogg"].some((ext) =>
        entry.name.toLowerCase().endsWith(ext)
      )
    ) {
      try {
        const path = `${directory}/${entry.name}`;
        const buffer = await Deno.readFile(path);
        const audioFile = await taglib.open(buffer);

        const tag = audioFile.tag();
        const props = audioFile.audioProperties();

        library.push({
          path,
          title: tag.title,
          artist: tag.artist,
          album: tag.album,
          duration: props.length,
          bitrate: props.bitrate,
        });

        audioFile.dispose();
      } catch (error) {
        console.error(`Failed to read ${entry.name}:`, error.message);
      }
    }
  }

  return library;
}
```

## Additional Resources

- **API Documentation**: See the project's docs/API.md
- **PropertyMap Keys**: See docs/PropertyMap-API.md for all supported metadata
  keys
- **Memory Management**: See docs/Memory-Management.md for detailed guidance
- **Examples**: Check the examples/ directory for runtime-specific code
