# Runtime Compatibility

`taglib-wasm` is designed to work seamlessly across all major JavaScript
runtimes. This document outlines the specific features and considerations for
each runtime.

## 🟢 Supported Runtimes

### ✅ Deno 2.0+

- **Status**: Fully supported via npm specifier
- **Installation**: `import { TagLib } from "npm:taglib-wasm"`
- **Features**:
  - Native TypeScript support
  - Built-in Web APIs
  - Excellent Wasm performance
  - Security sandbox
- **File Loading**: `Deno.readFile()`

```typescript
import { TagLib } from "npm:taglib-wasm";

const taglib = await TagLib.initialize();
const audioData = await Deno.readFile("song.mp3");
using file = taglib.openFile(audioData);
```

### ✅ Bun 1.0+

- **Status**: Fully supported
- **Installation**: `bun add taglib-wasm`
- **Features**:
  - Native TypeScript support
  - Fast startup and execution
  - Excellent Wasm performance
  - Node.js compatibility
- **File Loading**: `Bun.file().arrayBuffer()`

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
const audioData = await Bun.file("song.mp3").arrayBuffer();
using file = taglib.openFile(new Uint8Array(audioData));
```

### ✅ Node.js 22.6.0+

- **Status**: Fully supported
- **Installation**: `npm install taglib-wasm`
- **Features**:
  - Mature ecosystem
  - Extensive package support
  - Good Wasm performance
- **File Loading**: `fs.readFile()` or `fs.promises.readFile()`

```typescript
import { TagLib } from "taglib-wasm";
import { readFile } from "fs/promises";

const taglib = await TagLib.initialize();
const audioData = await readFile("song.mp3");
using file = taglib.openFile(audioData);
```

### ✅ Browsers (Chrome 57+, Firefox 52+, Safari 11+)

- **Status**: Fully supported
- **Installation**: Via CDN or bundler
- **Features**:
  - Wide compatibility
  - Web APIs
  - Service Worker support
- **File Loading**: `File API`, `fetch()`, or `FileReader`

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();

// From file input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const audioData = new Uint8Array(await file.arrayBuffer());
using tagFile = taglib.openFile(audioData);

// From fetch
const response = await fetch("song.mp3");
const audioData = new Uint8Array(await response.arrayBuffer());
using tagFile = taglib.openFile(audioData);
```

### ✅ Cloudflare Workers

- **Status**: Fully supported
- **Installation**: `npm install taglib-wasm`
- **Features**:
  - Edge computing
  - Automatic scaling
  - Global deployment
  - KV/R2/D1 integration
- **File Loading**: Request body or fetch from storage
- **Documentation**: See
  [Cloudflare Workers Guide](/advanced/cloudflare-workers)

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const taglib = await TagLib.initialize();
    const audioData = new Uint8Array(await request.arrayBuffer());
    using file = taglib.openFile(audioData);

    // Process metadata...

    return new Response(JSON.stringify(metadata));
  },
};
```

## 🔄 WebAssembly Runtime Selection

TagLib-Wasm includes two WebAssembly implementations and automatically selects
the optimal one for your environment:

| Environment            | Implementation | Reason                                                    |
| ---------------------- | -------------- | --------------------------------------------------------- |
| **Deno**               | WASI           | Native filesystem, best performance                       |
| **Bun**                | WASI           | Native filesystem via node:fs provider                    |
| **Node.js 22+**        | WASI           | Native filesystem (requires `--experimental-wasm-exnref`) |
| **Browsers**           | Emscripten     | Required for web compatibility                            |
| **Cloudflare Workers** | Emscripten     | WASI not available                                        |

### Checking the Active Implementation

```typescript
const taglib = await TagLib.initialize();

console.log(taglib.isWasi); // true for Deno/Node.js
console.log(taglib.isEmscripten); // true for browsers/Workers
```

### Performance Benefits

WASI mode provides:

- **10x faster serialization** via MessagePack (vs JSON in Emscripten)
- **Native memory management** with RAII patterns
- **Smaller binary size** (~28KB vs ~2MB)

### Advanced: Manual Override

In rare cases, you may want to force a specific implementation:

```typescript
// Force Emscripten buffer mode (in-memory I/O, works everywhere)
const taglib = await TagLib.initialize({ forceBufferMode: true });

// Force a specific Wasm backend
const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

// For Simple API, set buffer mode globally
import { setBufferMode } from "taglib-wasm";
setBufferMode(true); // All subsequent Simple API calls use Emscripten
```

`forceBufferMode` forces Emscripten-based in-memory I/O regardless of
environment. `forceWasmType` lets you choose the specific Wasm backend (`"wasi"`
or `"emscripten"`).

::: tip Most users never need to configure this. The automatic selection
provides optimal performance for each environment. :::

## 🔧 Runtime-Specific Features

### Memory Management

All runtimes use the same memory management approach:

- Emscripten's `allocate()` for JS/Wasm data transfer
- Automatic garbage collection for JavaScript objects
- Use `using` statements for automatic C++ object disposal (or `dispose()` as
  fallback)

### File System Access

Each runtime has different file system capabilities:

| Runtime     | File System                 | Security | Best For                  |
| ----------- | --------------------------- | -------- | ------------------------- |
| **Deno**    | Sandboxed, permission-based | High     | Server-side, CLI tools    |
| **Bun**     | Full access                 | Medium   | Server-side, build tools  |
| **Node.js** | Full access                 | Medium   | Server-side, classic apps |
| **Browser** | Limited (File API only)     | High     | Client-side, web apps     |
| **Workers** | None (Request/KV/R2 only)   | High     | Edge computing, APIs      |

### Performance Characteristics

| Runtime     | Startup   | Wasm Performance | Memory Usage | TypeScript |
| ----------- | --------- | ---------------- | ------------ | ---------- |
| **Bun**     | Very Fast | Excellent        | Low          | Native     |
| **Deno**    | Fast      | Excellent        | Medium       | Native     |
| **Workers** | Very Fast | Excellent        | Low          | Native     |
| **Node.js** | Medium    | Good             | Medium       | Via loader |
| **Browser** | Fast      | Good             | Medium       | Via build  |

## 📦 Installation Matrix

| Runtime     | Package Manager | Command                                    |
| ----------- | --------------- | ------------------------------------------ |
| **Deno**    | npm specifier   | `import { TagLib } from "npm:taglib-wasm"` |
| **Bun**     | bun             | `bun add taglib-wasm`                      |
| **Node.js** | npm             | `npm install taglib-wasm`                  |
| **Node.js** | yarn            | `yarn add taglib-wasm`                     |
| **Node.js** | pnpm            | `pnpm add taglib-wasm`                     |
| **Workers** | npm             | `npm install taglib-wasm`                  |
| **Browser** | CDN             | `<script type="module" src="...">`         |

## 🧪 Testing Across Runtimes

The project includes comprehensive tests that run on all supported runtimes:

```bash
# Test with Deno (recommended)
deno run --allow-read test-systematic.ts

# Test with Bun
bun run test-systematic.ts

# Test with Node.js  
npm test

# Test in browser
# Open examples/browser/index.html
```

## 🚧 Known Limitations

### General Limitations

- **File Writing**: Changes only affect in-memory representation
- **Large Files**: Memory usage scales with file size
- **Thread Safety**: Single-threaded execution (JavaScript limitation)

### Runtime-Specific Limitations

#### Deno

- Requires `--allow-read` permission for file access
- Some Node.js modules may not be compatible
- **Offline Support**: Compiled binaries can embed WASM for offline usage (see
  [Deno Compile Guide](#deno-compiled-binaries))

#### Bun

- Relatively new runtime, ecosystem still developing
- Some npm packages may have compatibility issues

#### Node.js

- Requires `--experimental-wasm-exnref` flag for Wasm exception handling
- Requires TypeScript loader for direct .ts execution
- Requires Node.js 22.6.0 or higher

#### Browser

- No direct file system access (security limitation)
- Wasm files must be served with correct MIME type
- May require additional build configuration

#### Cloudflare Workers

- 128MB memory limit per request
- 50ms CPU time (free tier) or 30s (paid tier)
- No file system access
- Request/response size limited to 100MB

## 🎯 Deno Compiled Binaries

TagLib-Wasm includes special support for creating offline-capable Deno compiled
binaries:

### Automatic Offline Support

```typescript
import { initializeForDenoCompile } from "taglib-wasm";

// Automatically uses embedded WASM in compiled binaries
// Falls back to network fetch in development
const taglib = await initializeForDenoCompile();
```

### Manual WASM Embedding

1. **Prepare the WASM file:**
   ```typescript
   import { prepareWasmForEmbedding } from "taglib-wasm";
   await prepareWasmForEmbedding("./taglib.wasm");
   ```

2. **Initialize with embedded WASM:**
   ```typescript
   import { TagLib } from "taglib-wasm";

   const wasmBinary = await Deno.readFile("./taglib.wasm");
   const taglib = await TagLib.initialize({ wasmBinary });
   ```

3. **Compile with embedded assets:**
   ```bash
   deno compile --allow-read --include taglib.wasm your-app.ts
   ```

### Benefits

- ✅ No network access required
- ✅ Single executable file
- ✅ Faster startup (no WASM fetch)
- ✅ Works in air-gapped environments

### Example

See the complete example in
[`examples/deno/offline-compile.ts`](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/deno/offline-compile.ts).

## 💡 Best Practices

### Universal Code

Write code that works across all runtimes:

```typescript
// Good: Runtime-agnostic
import { TagLib } from "taglib-wasm";
const taglib = await TagLib.initialize();

// Avoid: Runtime-specific APIs in shared code
// const audioData = await Deno.readFile("file.mp3"); // Deno only
// const audioData = await Bun.file("file.mp3").arrayBuffer(); // Bun only
```

### Error Handling

Account for different runtime capabilities:

```typescript
async function loadAudioFile(path: string): Promise<Uint8Array> {
  // Runtime detection
  if (typeof Deno !== "undefined") {
    return await Deno.readFile(path);
  } else if (typeof Bun !== "undefined") {
    return new Uint8Array(await Bun.file(path).arrayBuffer());
  } else {
    // Node.js or browser
    const fs = await import("fs/promises");
    return await fs.readFile(path);
  }
}
```

### Configuration

Use runtime-appropriate configuration:

```typescript
const config = {
  memory: {
    // Adjust based on runtime capabilities
    initial: typeof Bun !== "undefined" ? 32 * 1024 * 1024 : 16 * 1024 * 1024,
    maximum: 256 * 1024 * 1024,
  },
  debug: process.env.NODE_ENV === "development",
};

const taglib = await TagLib.initialize(config);
```

## 📚 Additional Resources

- [Deno Manual](https://deno.land/manual)
- [Bun Documentation](https://bun.sh/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)

---

This universal compatibility ensures `taglib-wasm` can be used in any modern
JavaScript environment, from servers to browsers to edge computing platforms.
