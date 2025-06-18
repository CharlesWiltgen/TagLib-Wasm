# taglib-wasm Usage Guide for AI Assistants

This guide helps AI assistants understand how to use the taglib-wasm library effectively when writing code that consumes this package.

## Quick Start

```typescript
import { TagLib } from 'taglib-wasm';

// Initialize the library
await TagLib.loadModule();

// Read tags from an audio file
const audioFile = await TagLib.openFile(buffer, 'audio.mp3');
const tags = audioFile.tags();

console.log({
  title: tags.title(),
  artist: tags.artist(),
  album: tags.album(),
  year: tags.year()
});

// IMPORTANT: Always clean up
audioFile.dispose();
```

## Key Concepts

### 1. Initialization
- **Always call `TagLib.loadModule()` once** before using any functionality
- This loads the WebAssembly module asynchronously
- In browsers, this happens automatically on import

### 2. Memory Management
- **CRITICAL**: Always call `dispose()` on AudioFile instances when done
- Forgetting to dispose causes memory leaks as C++ objects aren't garbage collected
- Use try/finally blocks to ensure cleanup:

```typescript
let audioFile;
try {
  audioFile = await TagLib.openFile(buffer, filename);
  // ... work with file
} finally {
  audioFile?.dispose();
}
```

### 3. File Loading
- Files must be loaded as `Uint8Array` buffers
- Minimum file size: 1KB (files smaller than this will throw an error)
- The filename parameter is used only for format detection (e.g., '.mp3', '.flac')

```typescript
// Node.js/Bun
const buffer = await fs.readFile('song.mp3');

// Browser
const response = await fetch('song.mp3');
const buffer = new Uint8Array(await response.arrayBuffer());

// Open the file
const audioFile = await TagLib.openFile(buffer, 'song.mp3');
```

## Common Patterns

### Reading Basic Tags

```typescript
const audioFile = await TagLib.openFile(buffer, filename);
const tags = audioFile.tags();

// All tag methods return strings (empty string if not set)
const metadata = {
  title: tags.title(),
  artist: tags.artist(),
  album: tags.album(),
  year: tags.year(),        // Returns number
  track: tags.track(),      // Returns number
  genre: tags.genre(),
  comment: tags.comment()
};

audioFile.dispose();
```

### Writing Tags

```typescript
const audioFile = await TagLib.openFile(buffer, filename);
const tags = audioFile.tags();

// Set individual tags
tags.setTitle('New Title');
tags.setArtist('New Artist');
tags.setAlbum('New Album');
tags.setYear(2024);
tags.setTrack(5);

// Save changes and get modified buffer
const modifiedBuffer = audioFile.save();

audioFile.dispose();

// Write the modified buffer back to storage
await fs.writeFile('modified.mp3', modifiedBuffer);
```

### Audio Properties

```typescript
const audioFile = await TagLib.openFile(buffer, filename);
const properties = audioFile.audioProperties();

const audioInfo = {
  duration: properties.length(),      // Duration in seconds
  bitrate: properties.bitrate(),      // Bitrate in kb/s
  sampleRate: properties.sampleRate(), // Sample rate in Hz
  channels: properties.channels()      // Number of channels
};

audioFile.dispose();
```

### Using the Simple API

For basic read-only operations, use the Simple API:

```typescript
import { readTags } from 'taglib-wasm';

// No need to manage AudioFile instances
const tags = await readTags(buffer, filename);
console.log(tags); // { title, artist, album, year, ... }
```

### Advanced Metadata (PropertyMap)

```typescript
const audioFile = await TagLib.openFile(buffer, filename);
const propMap = audioFile.propertyMap();

// Read all properties
const allProps = propMap.properties();

// Read specific advanced properties
const musicBrainzId = propMap.get('MUSICBRAINZ_TRACKID');
const replayGain = propMap.get('REPLAYGAIN_TRACK_GAIN');
const acoustId = propMap.get('ACOUSTID_ID');

// Write advanced properties
propMap.set('MUSICBRAINZ_ALBUMID', 'some-uuid');
propMap.set('REPLAYGAIN_TRACK_GAIN', '-3.5 dB');

// Multiple values for a property
propMap.set('ARTIST', ['Main Artist', 'Featured Artist']);

const modifiedBuffer = audioFile.save();
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
try {
  const audioFile = await TagLib.openFile(buffer, filename);
  // ... use audioFile
  audioFile.dispose();
} catch (error) {
  if (error.message.includes('Module not initialized')) {
    // Need to call TagLib.loadModule() first
  } else if (error.message.includes('Invalid audio file format')) {
    // Unsupported or corrupted file
  } else if (error.message.includes('at least 1KB')) {
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
- Use `Deno.readFile()` to load files
- Remember to grant file permissions with `--allow-read`

### Cloudflare Workers
- Import from 'taglib-wasm/workers' for compatibility
- Use `fetch()` to load files from URLs or R2 storage
- Memory limits apply; be mindful of file sizes

## Performance Tips

1. **Reuse the module**: Call `loadModule()` once and reuse for all operations
2. **Dispose promptly**: Free memory as soon as you're done with a file
3. **Batch operations**: If modifying multiple tags, do them all before calling `save()`
4. **Use Simple API for reading**: When only reading tags, `readTags()` is more efficient
5. **Handle large files carefully**: The entire file is loaded into memory

## Common Mistakes to Avoid

1. **Forgetting to dispose**: Always call `audioFile.dispose()`
2. **Not initializing**: Remember to call `TagLib.loadModule()` first
3. **Wrong filename**: The filename parameter must include the extension
4. **Assuming synchronous**: All main operations are async
5. **Modifying after dispose**: Can't use an AudioFile after calling `dispose()`

## Type Definitions

Key interfaces to reference:

```typescript
interface Tags {
  title(): string;
  artist(): string;
  album(): string;
  year(): number;
  track(): number;
  genre(): string;
  comment(): string;
  
  setTitle(value: string): void;
  setArtist(value: string): void;
  // ... etc
}

interface AudioProperties {
  length(): number;    // seconds
  bitrate(): number;   // kb/s
  sampleRate(): number; // Hz
  channels(): number;
}

interface PropertyMap {
  get(key: string): string | string[] | undefined;
  set(key: string, value: string | string[]): boolean;
  properties(): Record<string, string[]>;
}
```

## Example: Complete Music Library Scanner

```typescript
import { TagLib } from 'taglib-wasm';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

async function scanMusicLibrary(directory: string) {
  await TagLib.loadModule();
  
  const files = await readdir(directory, { recursive: true });
  const musicFiles = files.filter(f => 
    ['.mp3', '.flac', '.m4a', '.ogg'].includes(extname(f).toLowerCase())
  );
  
  const library = [];
  
  for (const file of musicFiles) {
    try {
      const path = join(directory, file);
      const buffer = await readFile(path);
      const audioFile = await TagLib.openFile(buffer, file);
      
      const tags = audioFile.tags();
      const props = audioFile.audioProperties();
      
      library.push({
        path,
        title: tags.title(),
        artist: tags.artist(),
        album: tags.album(),
        duration: props.length(),
        bitrate: props.bitrate()
      });
      
      audioFile.dispose();
    } catch (error) {
      console.error(`Failed to read ${file}:`, error.message);
    }
  }
  
  return library;
}
```

## Additional Resources

- **API Documentation**: See the project's docs/API.md
- **PropertyMap Keys**: See docs/PropertyMap-API.md for all supported metadata keys
- **Memory Management**: See docs/Memory-Management.md for detailed guidance
- **Examples**: Check the examples/ directory for runtime-specific code