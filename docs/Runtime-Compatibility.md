# Runtime Compatibility

`taglib-wasm` is designed to work seamlessly across all major JavaScript runtimes. This document outlines the specific features and considerations for each runtime.

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
const file = taglib.openFile(audioData);
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
const file = taglib.openFile(new Uint8Array(audioData));
```

### ✅ Node.js 18+

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
const file = taglib.openFile(audioData);
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
const tagFile = taglib.openFile(audioData);

// From fetch
const response = await fetch("song.mp3");
const audioData = new Uint8Array(await response.arrayBuffer());
const tagFile = taglib.openFile(audioData);
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
- **Documentation**: See [Cloudflare Workers Guide](/Cloudflare-Workers.md)

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const taglib = await TagLib.initialize();
    const audioData = new Uint8Array(await request.arrayBuffer());
    const file = taglib.openFile(audioData);
    
    // Process metadata...
    
    file.dispose();
    return new Response(JSON.stringify(metadata));
  },
};
```

## 🔧 Runtime-Specific Features

### Memory Management

All runtimes use the same memory management approach:

- Emscripten's `allocate()` for JS↔Wasm data transfer
- Automatic garbage collection for JavaScript objects
- Manual disposal required for C++ objects: `file.dispose()`

### File System Access

Each runtime has different file system capabilities:

| Runtime     | File System                 | Security | Best For                      |
| ----------- | --------------------------- | -------- | ----------------------------- |
| **Deno**    | Sandboxed, permission-based | High     | Server-side, CLI tools        |
| **Bun**     | Full access                 | Medium   | Server-side, build tools      |
| **Node.js** | Full access                 | Medium   | Server-side, classic apps     |
| **Browser** | Limited (File API only)     | High     | Client-side, web apps         |
| **Workers** | None (Request/KV/R2 only)   | High     | Edge computing, APIs          |

### Performance Characteristics

| Runtime     | Startup   | Wasm Performance | Memory Usage | TypeScript |
| ----------- | --------- | ---------------- | ------------ | ---------- |
| **Bun**     | Very Fast | Excellent        | Low          | Native     |
| **Deno**    | Fast      | Excellent        | Medium       | Native     |
| **Workers** | Very Fast | Excellent        | Low          | Native     |
| **Node.js** | Medium    | Good             | Medium       | Via loader |
| **Browser** | Fast      | Good             | Medium       | Via build  |

## 📦 Installation Matrix

| Runtime     | Package Manager | Command                                                    |
| ----------- | --------------- | ---------------------------------------------------------- |
| **Deno**    | npm specifier   | `import { TagLib } from "npm:taglib-wasm"` |
| **Bun**     | bun             | `bun add taglib-wasm`                                      |
| **Node.js** | npm             | `npm install taglib-wasm`                                  |
| **Node.js** | yarn            | `yarn add taglib-wasm`                                     |
| **Node.js** | pnpm            | `pnpm add taglib-wasm`                                     |
| **Workers** | npm             | `npm install taglib-wasm`                                  |
| **Browser** | CDN             | `<script type="module" src="...">`                         |

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

#### Bun

- Relatively new runtime, ecosystem still developing
- Some npm packages may have compatibility issues

#### Node.js

- Requires TypeScript loader for direct .ts execution
- Older versions (<18) may have limited Wasm support

#### Browser

- No direct file system access (security limitation)
- Wasm files must be served with correct MIME type
- May require additional build configuration

#### Cloudflare Workers

- 128MB memory limit per request
- 50ms CPU time (free tier) or 30s (paid tier)
- No file system access
- Request/response size limited to 100MB

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

This universal compatibility ensures `taglib-wasm` can be used in any modern JavaScript environment, from servers to browsers to edge computing platforms.
