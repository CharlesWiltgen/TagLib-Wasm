# Platform Guide

TagLib-Wasm works across all major JavaScript runtimes. The API is the same
everywhere — the only meaningful difference is how your platform accesses files.

## Filesystem vs. Buffer Platforms

| Platform               | File paths               | Buffers | Install                                                            |
| ---------------------- | ------------------------ | ------- | ------------------------------------------------------------------ |
| **Deno**               | Yes                      | Yes     | `import from "@charlesw/taglib-wasm"` (JSR) or `"npm:taglib-wasm"` |
| **Node.js**            | Yes                      | Yes     | `npm install taglib-wasm`                                          |
| **Bun**                | Yes                      | Yes     | `bun add taglib-wasm`                                              |
| **Browser**            | No                       | Yes     | Use a bundler (Vite, Webpack, Parcel)                              |
| **Cloudflare Workers** | No                       | Yes     | `npm install taglib-wasm`                                          |
| **Electron**           | Main: Yes / Renderer: No | Yes     | `npm install taglib-wasm`                                          |

**Filesystem platforms** (Deno, Node.js, Bun) can pass file paths directly.
Changes save to disk without extra steps:

```typescript
// Read from path
const tags = await readTags("song.mp3");

// Write to disk (path in, void out)
await updateTags("song.mp3", { title: "New Title" });

// edit() with a path saves to disk and returns void
await taglib.edit("song.mp3", (file) => {
  file.tag().setTitle("New Title");
});
```

**Buffer platforms** (Browser, Cloudflare Workers) must provide audio data as a
`Uint8Array` or `ArrayBuffer`. Write operations return a modified buffer that
you handle yourself:

```typescript
// Read from buffer
const tags = await readTags(audioData);

// Write returns a new buffer (buffer in, buffer out)
const modified = await applyTags(audioData, { title: "New Title" });

// edit() with a buffer returns the modified Uint8Array
const modified = await taglib.edit(audioData, (file) => {
  file.tag().setTitle("New Title");
});
```

::: tip Both modes work everywhere
Filesystem platforms can also accept buffers. This is useful for processing
in-memory data on Node.js/Deno/Bun without touching disk.
:::

## Deno

```typescript
import { readTags, updateTags } from "@charlesw/taglib-wasm/simple";

// Read tags from file path
const tags = await readTags("song.mp3");

// Update tags on disk
await updateTags("song.mp3", { title: "New Title", artist: "New Artist" });
```

Run with: `deno run --allow-read --allow-write script.ts`

Deno requires explicit permissions: `--allow-read` for reading files,
`--allow-write` for `updateTags` or any operation that saves to disk.

### Deno Compile

TagLib-Wasm supports `deno compile` for building standalone executables.
See [Deno Compile](./deno-compile.md) for details on embedding the Wasm binary.

## Node.js

```typescript
import { readTags, updateTags } from "taglib-wasm/simple";

const tags = await readTags("song.mp3");
await updateTags("song.mp3", { title: "New Title", artist: "New Artist" });
```

**Requirements:** Node.js v22.6.0 or higher.

| Node.js version | TypeScript support                          |
| --------------- | ------------------------------------------- |
| 23.6+           | Native (`node script.ts`)                   |
| 22.6+           | `node --experimental-strip-types script.ts` |
| Older           | `npx tsx script.ts`                         |

## Bun

```typescript
import { readTags, updateTags } from "taglib-wasm/simple";

const tags = await readTags("song.mp3");
await updateTags("song.mp3", { title: "New Title", artist: "New Artist" });
```

Run with: `bun run script.ts`

Bun has native TypeScript support with no additional configuration.

## Browser

Browsers have no filesystem access. Audio data comes from the
[File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API),
`fetch()`, or drag-and-drop — always as an `ArrayBuffer` or `Uint8Array`.

```typescript
import { applyTags, readTags } from "taglib-wasm/simple";

// Get audio data from a file input
const input = document.querySelector('input[type="file"]');
const audioData = new Uint8Array(await input.files[0].arrayBuffer());

// Read
const tags = await readTags(audioData);

// Write — returns modified buffer (you decide what to do with it)
const modified = await applyTags(audioData, { title: "New Title" });
```

Use `applyTags` (not `updateTags`) since there's no file path to write back to.
To let the user save the result:

```typescript
const blob = new Blob([modified], { type: "audio/mpeg" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "modified.mp3";
a.click();
URL.revokeObjectURL(url);
```

::: tip Bundler required
TagLib-Wasm uses ES modules. Use Vite, Webpack, Parcel, or another bundler
that can resolve `taglib-wasm` and serve the `.wasm` file.
:::

## Cloudflare Workers

Workers are buffer-only with constrained memory. Use the same unified API import
as every other platform:

```typescript
import { TagLib } from "taglib-wasm";

export default {
  async fetch(request: Request): Promise<Response> {
    const taglib = await TagLib.initialize();

    const audioData = new Uint8Array(await request.arrayBuffer());
    using file = await taglib.open(audioData);

    return Response.json({
      title: file.tag().title,
      artist: file.tag().artist,
      duration: file.audioProperties()?.length,
    });
  },
};
```

Key differences from other platforms:

- **Memory limit**: 128MB per request
- **No filesystem**: Buffer-only

See [Cloudflare Workers Guide](../advanced/cloudflare-workers.md) for detailed
configuration.

## Electron

> **Note:** Electron's main process is Node.js. TagLib-Wasm works via the
> Node.js WASI path — there is no Electron-specific runtime detection or
> testing. Keep TagLib-Wasm in the main process and expose metadata through IPC.

Electron spans both categories. The **main process** has filesystem access; the
**renderer process** does not (unless `nodeIntegration` is enabled, which is
discouraged for security).

### Main Process (filesystem)

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();

ipcMain.handle("get-metadata", async (_event, filePath: string) => {
  using file = await taglib.open(filePath);
  return {
    title: file.tag().title,
    artist: file.tag().artist,
    duration: file.audioProperties().length,
  };
});

ipcMain.handle("update-tags", async (_event, filePath: string, tags) => {
  await taglib.edit(filePath, (file) => {
    const tag = file.tag();
    if (tags.title) tag.setTitle(tags.title);
    if (tags.artist) tag.setArtist(tags.artist);
  });
});
```

### Renderer Process (via IPC)

```typescript
const metadata = await window.api.getMetadata("/path/to/song.mp3");
await window.api.updateTags("/path/to/song.mp3", { title: "New Title" });
```

Keep TagLib-Wasm in the main process and expose it through IPC handlers.
This avoids bundling Wasm into the renderer and keeps file access secure.

## Cross-Platform Code

The `edit()` method is designed for code that runs on both filesystem and buffer
platforms. The mutation callback is identical — only the call site differs:

```typescript
const taglib = await TagLib.initialize();

function setMetadata(file: AudioFile) {
  file.tag().setTitle("Title").setArtist("Artist").setYear(2026);
}

// Filesystem platform — saves to disk, returns void
await taglib.edit("/path/to/song.mp3", setMetadata);

// Buffer platform — returns modified Uint8Array
const modified = await taglib.edit(audioData, setMetadata);
```

## Next Steps

- [Quick Start](./quick-start.md) for a full walkthrough
- [API Reference](/api/) for all available methods
- [Runtime Compatibility](../concepts/runtime-compatibility.md) for detailed
  platform support matrix
