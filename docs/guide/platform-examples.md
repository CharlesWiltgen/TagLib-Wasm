# Platform-Specific Examples

This guide shows how to use taglib-wasm in different JavaScript runtime
environments. Each platform has slightly different requirements and best
practices.

## Deno

Deno has native TypeScript support and uses the npm: specifier for npm packages:

```typescript
import { TagLib } from "npm:taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
using file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: using file = await taglib.open(await Deno.readFile("song.mp3"));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Container: ${props.containerFormat}`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());
```

### Deno-Specific Tips

- Use `Deno.readFile()` for reading files as Uint8Array
- Use `Deno.writeFile()` for saving modified buffers
- Permissions: `--allow-read` and `--allow-write` are required for file
  operations

## Node.js

Node.js requires the TypeScript loader (tsx) or native TypeScript support
(Node.js 22.6+):

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
using file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: using file = await taglib.open(await readFile("song.mp3"));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Container: ${props.containerFormat}`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());
```

### Node.js-Specific Tips

- Use `fs.promises` for async file operations
- For Node.js < 22.6, use tsx: `npx tsx script.ts`
- For Node.js 22.6+: `node --experimental-strip-types script.ts`
- For Node.js 23.6+: `node script.ts` (no flag needed)

## Bun

Bun has native TypeScript support and optimized file APIs:

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file (can pass file path or buffer)
using file = await taglib.open("song.mp3"); // Direct file path (simpler)
// Or from buffer: using file = await taglib.open(new Uint8Array(await Bun.file("song.mp3").arrayBuffer()));

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Container: ${props.containerFormat}`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());
```

### Bun-Specific Tips

- Use `Bun.file()` for optimized file operations
- Use `Bun.write()` for saving files
- Bun's performance is excellent for processing many files

## Browser

Browsers require loading files via File API or fetch:

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load from file input or fetch
const fileInput = document.querySelector('input[type="file"]');
const audioFile = fileInput.files[0];
const audioData = new Uint8Array(await audioFile.arrayBuffer());
using file = await taglib.open(audioData); // Browser requires buffer

// Read metadata
const tags = file.tag();
const props = file.audioProperties();

console.log(`Title: ${tags.title}`);
console.log(`Artist: ${tags.artist}`);
console.log(`Duration: ${props.length}s`);
console.log(`Bitrate: ${props.bitrate} kbps`);
console.log(`Container: ${props.containerFormat}`);
console.log(`Codec: ${props.codec}`);
console.log(`Lossless: ${props.isLossless}`);

// Write metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");
tag.setAlbum("New Album");

// Save changes
file.save();

console.log("Updated tags:", file.tag());
```

### Browser-Specific Tips

- Always load from ArrayBuffer/Uint8Array (no file path support)
- Use FileReader API for file inputs
- Use fetch() for remote files
- Consider using a bundler (Vite, Webpack, Parcel)
- For downloads, create a Blob and use URL.createObjectURL()

### Example: Complete Browser Application

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Audio Metadata Editor</title>
  </head>
  <body>
    <input type="file" id="fileInput" accept="audio/*">
    <div id="metadata"></div>

    <script type="module">
      import { TagLib } from "taglib-wasm";

      const fileInput = document.getElementById("fileInput");
      const metadataDiv = document.getElementById("metadata");

      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const taglib = await TagLib.initialize();
        const audioData = new Uint8Array(await file.arrayBuffer());
        using audioFile = await taglib.open(audioData);

        const tags = audioFile.tag();
        const props = audioFile.audioProperties();

        metadataDiv.innerHTML = `
                <h3>Metadata:</h3>
                <p>Title: ${tags.title || "Unknown"}</p>
                <p>Artist: ${tags.artist || "Unknown"}</p>
                <p>Album: ${tags.album || "Unknown"}</p>
                <p>Duration: ${props.length}s</p>
                <p>Bitrate: ${props.bitrate} kbps</p>
            `;
      });
    </script>
  </body>
</html>
```

## Cloudflare Workers

Workers require the special workers import and memory configuration:

```typescript
import { TagLib } from "taglib-wasm/workers";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      try {
        // Initialize taglib-wasm with Workers-specific configuration
        // See docs/Cloudflare-Workers.md for memory configuration details
        const taglib = await TagLib.initialize({
          memory: { initial: 8 * 1024 * 1024 }, // 8MB for Workers
        });

        // Get audio data from request
        const audioData = new Uint8Array(await request.arrayBuffer());
        using file = await taglib.open(audioData); // Workers require buffer

        // Read metadata
        const tags = file.tag();
        const props = file.audioProperties();

        // Extract metadata
        const metadata = {
          title: tags.title,
          artist: tags.artist,
          album: tags.album,
          year: tags.year,
          genre: tags.genre,
          duration: props.length,
          bitrate: props.bitrate,
          format: file.getFormat(),
        };

        return Response.json({
          success: true,
          metadata,
          fileSize: audioData.length,
        });
      } catch (error) {
        return Response.json({
          error: "Failed to process audio file",
          message: (error as Error).message,
        }, { status: 500 });
      }
    }

    return new Response("Send POST request with audio file", { status: 400 });
  },
};
```

### Workers-Specific Tips

- Use the `/workers` import path for optimized Workers build
- Configure memory limits (Workers have 128MB limit)
- Always load from ArrayBuffer (no file system)
- Consider using Durable Objects for caching
- See [Cloudflare Workers Guide](../advanced/cloudflare-workers.md) for detailed
  configuration

## Electron

Electron supports both main and renderer processes:

### Main Process

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

async function getMetadata(filePath: string) {
  const taglib = await TagLib.initialize();
  using file = await taglib.open(filePath);

  const tags = file.tag();
  const props = file.audioProperties();

  return {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    duration: props.length,
    bitrate: props.bitrate,
  };
}

// IPC handler
ipcMain.handle("get-metadata", async (event, filePath) => {
  return await getMetadata(filePath);
});
```

### Renderer Process

```typescript
// With nodeIntegration: true
const { TagLib } = require("taglib-wasm");

// Or with preload script
const metadata = await window.api.getMetadata(filePath);
```

### Electron-Specific Tips

- Works in both main and renderer processes
- Use IPC for secure file operations
- Consider preload scripts for security
- Bundle size matters less in Electron apps

## Performance Tips by Platform

| Platform     | Best Practice               | Notes                            |
| ------------ | --------------------------- | -------------------------------- |
| **Deno**     | Use file paths directly     | Fastest file I/O                 |
| **Node.js**  | Use streams for large files | Good for batch processing        |
| **Bun**      | Use Bun.file() API          | Optimized native performance     |
| **Browser**  | Process in Web Workers      | Prevents UI blocking             |
| **Workers**  | Minimize memory usage       | 128MB limit per request          |
| **Electron** | Use main process for I/O    | Better performance than renderer |

## Common Patterns

### Batch Processing (Node.js/Deno/Bun)

```typescript
import { glob } from "glob";
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
const files = await glob("music/**/*.mp3");

for (const filePath of files) {
  using file = await taglib.open(filePath);
  const tags = file.tag();

  console.log(`${filePath}: ${tags.artist} - ${tags.title}`);
}
```

### Progress Tracking (Browser)

```typescript
async function processFiles(
  files: FileList,
  onProgress: (percent: number) => void,
) {
  const taglib = await TagLib.initialize();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const audioData = new Uint8Array(await file.arrayBuffer());
    using audioFile = await taglib.open(audioData);

    // Process file...
    onProgress((i + 1) / files.length * 100);
  }
}
```

## Next Steps

- Check out the [Examples](./examples.md) for more code samples
- Read the [API Reference](/api/) for detailed documentation
- See [Runtime Compatibility](../concepts/runtime-compatibility.md) for
  platform-specific details
