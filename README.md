# TagLib-Wasm

[![Tests](https://github.com/CharlesWiltgen/taglib-wasm/actions/workflows/test.yml/badge.svg)](https://github.com/CharlesWiltgen/taglib-wasm/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/taglib-wasm.svg?logo=nodedotjs&logoColor=f5f5f5)](https://www.npmjs.com/package/taglib-wasm)
[![npm downloads](https://img.shields.io/npm/dm/taglib-wasm.svg)](https://www.npmjs.com/package/taglib-wasm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/CharlesWiltgen/taglib-wasm/blob/main/LICENSE)
<br>[![Built with](https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=f5f5f5)](https://www.typescriptlang.org/)
[![Built with Emscripten](https://img.shields.io/badge/Built%20with-Emscripten-4B9BFF.svg)](https://emscripten.org/)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654ff0.svg?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Built with TagLib](https://img.shields.io/badge/Built%20with-TagLib-brightgreen.svg)](https://taglib.org/)
<br>[![Deno](https://img.shields.io/badge/Deno-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Browsers](https://img.shields.io/badge/Browsers-E34C26?logo=html5&logoColor=white)](https://html.spec.whatwg.org/multipage/)

TagLib-Wasm is the **universal tagging library for TypeScript/JavaScript**
(TS|JS) platforms: **Deno**, **Node.js**, **Bun**, **Cloudflare Workers**,
**Electron**, and **browsers**.

This project exists because the TS|JS ecosystem had no battle-tested audio
tagging library that supports reading and writing music metadata to all popular
audio formats. It aspires to be a universal solution for all TS|JS-capable
platforms — Deno, Node.js, Bun, Electron, Cloudflare Workers, and browsers.

TagLib-Wasm stands on the shoulders of giants, including
[TagLib](https://taglib.org/) itself, [Emscripten](https://emscripten.org/), and
[Wasm](https://webassembly.org/) ([WebAssembly](https://webassembly.org/)).
TagLib itself is legendary, and a core dependency of many music apps.

## 🎯 Features

- **✅ Full audio format support** – Supports all audio formats supported by
  TagLib
- **✅ TypeScript first** – Complete type definitions and modern API
- **✅ Wide TS/JS runtime support** – Deno, Node.js, Bun, Electron, Cloudflare
  Workers, and browsers
- **✅ Format abstraction** – Handles container format details automagically
  when possible
- **✅ Zero dependencies** – Self-contained Wasm bundle
- **✅ Production ready** – Growing test suite helps ensure safety and
  reliability
- **✅ Two API styles** – Use the “Simple” API (3 functions), or the full “Core”
  API for more advanced applications

## 📦 Installation

### Deno

```typescript
import { TagLib } from "npm:taglib-wasm";
```

### Node.js

```bash
npm install taglib-wasm
```

> **Note:** Requires Node.js v22.6.0 or higher. If you want to use the
> TypeScript version with Node.js, see the
> [installation guide](https://charleswiltgen.github.io/taglib-wasm/guide/installation.html).

### Bun

```bash
bun add taglib-wasm
```

### Electron

```bash
npm install taglib-wasm
```

Works in both main and renderer processes:

```typescript
// Main process
import { TagLib } from "taglib-wasm";

// Renderer process (with nodeIntegration: true)
const { TagLib } = require("taglib-wasm");
```

## 🚀 Quick Start

### Simple API

```typescript
import { applyTags, readTags, updateTags } from "taglib-wasm/simple";

// Read tags - just one function call!
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Apply tags and get modified buffer (in-memory)
const modifiedBuffer = await applyTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});

// Or update tags on disk (requires file path)
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
});
```

### Core API

The full Core API might be a better choice for apps and utilities focused on
advanced metadata management.

```typescript
import { TagLib } from "taglib-wasm";

// Initialize taglib-wasm
const taglib = await TagLib.initialize();

// Load audio file
const file = await taglib.open("song.mp3");

// Read and update metadata
const tag = file.tag();
tag.setTitle("New Title");
tag.setArtist("New Artist");

// Save changes
file.save();

// Clean up
file.dispose();
```

### Working with Cover Art

```typescript
import { getCoverArt, setCoverArt } from "taglib-wasm/simple";

// Extract cover art
const coverData = await getCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set new cover art
const imageData = await Deno.readFile("new-cover.jpg");
const modifiedBuffer = await setCoverArt("song.mp3", imageData, "image/jpeg");
// Save modifiedBuffer to file if needed
```

## 📚 Documentation

**[📖 View Full Documentation](https://charleswiltgen.github.io/taglib-wasm/)**

### Getting Started

- [Installation Guide](https://charleswiltgen.github.io/taglib-wasm/guide/installation.html)
- [Quick Start Tutorial](https://charleswiltgen.github.io/taglib-wasm/guide/quick-start.html)
- [All Examples](https://charleswiltgen.github.io/taglib-wasm/guide/examples.html)

### Guides

- [API Reference](https://charleswiltgen.github.io/taglib-wasm/API.html)
- [Platform Examples](https://charleswiltgen.github.io/taglib-wasm/guide/platform-examples.html)
- [Working with Cover Art](https://charleswiltgen.github.io/taglib-wasm/guide/cover-art.html)
- [Cloudflare Workers Setup](https://charleswiltgen.github.io/taglib-wasm/guide/workers-setup.html)
- [Error Handling](https://charleswiltgen.github.io/taglib-wasm/Error-Handling.html)

### Development

- [Testing Guide](https://charleswiltgen.github.io/taglib-wasm/development/testing.html)
- [Future Improvements](https://charleswiltgen.github.io/taglib-wasm/development/improvements.html)
- [Contributing](https://charleswiltgen.github.io/taglib-wasm/CONTRIBUTING.html)

## 📋 Supported Formats

`taglib-wasm` is designed to support all formats supported by TagLib:

- ✅ **.mp3** – ID3v2 and ID3v1 tags
- ✅ **.m4a/.mp4** – MPEG-4/AAC metadata for AAC and Apple Lossless audio
- ✅ **.flac** – Vorbis comments and audio properties
- ✅ **.ogg** – Ogg Vorbis format with full metadata support
- ✅ **.wav** – INFO chunk metadata
- ✅ **Additional formats** – Opus, APE, MPC, WavPack, TrueAudio, AIFF, WMA, and
  more

## 🎯 Key Features

### Extended Metadata Support

Beyond basic tags, taglib-wasm supports extended metadata:

```typescript
import { Tags } from "taglib-wasm";

// AcoustID fingerprints
file.setProperty(
  Tags.AcoustidFingerprint,
  "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...",
);

// MusicBrainz IDs
file.setProperty(
  Tags.MusicBrainzTrackId,
  "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
);

// ReplayGain volume normalization
file.setProperty(Tags.TrackGain, "-6.54 dB");
file.setProperty(Tags.TrackPeak, "0.987654");
```

[View all supported tag constants →](https://charleswiltgen.github.io/taglib-wasm/Tag-Name-Constants.html)

## 🏗️ Development

### Build from Source

```bash
# Prerequisites: Emscripten SDK
# Install via: https://emscripten.org/docs/getting_started/downloads.html

# Clone and build
git clone https://github.com/CharlesWiltgen/taglib-wasm.git
cd taglib-wasm

# Build Wasm module
npm run build:wasm

# Run tests
npm test
```

[View full development guide →](CONTRIBUTING.md)

## 🌐 Runtime Compatibility

`taglib-wasm` works across all major JavaScript runtimes:

| Runtime                | Status  | Installation              | Notes                     |
| ---------------------- | ------- | ------------------------- | ------------------------- |
| **Deno**               | ✅ Full | `npm:taglib-wasm`         | Native TypeScript         |
| **Node.js**            | ✅ Full | `npm install taglib-wasm` | TypeScript via tsx        |
| **Bun**                | ✅ Full | `bun add taglib-wasm`     | Native TypeScript         |
| **Browser**            | ✅ Full | Via bundler               | Full API support          |
| **Cloudflare Workers** | ✅ Full | `taglib-wasm/workers`     | Memory-optimized build    |
| **Electron**           | ✅ Full | `npm install taglib-wasm` | Main & renderer processes |

## 🚧 Known Limitations

- **Memory Usage** – Entire file must be loaded into memory (may be an issue for
  very large files)
- **Concurrent Access** – Not thread-safe (JavaScript single-threaded nature
  mitigates this)
- **Cloudflare Workers** – Limited to 128MB memory per request; files larger
  than ~100MB may fail

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md)
for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project uses dual licensing:

- **TypeScript/JavaScript code** – MIT License (see [LICENSE](LICENSE))
- **WebAssembly binary (taglib.wasm)** – LGPL-2.1-or-later (inherited from
  TagLib)

The TagLib library is dual-licensed under LGPL/MPL. When compiled to
WebAssembly, the resulting binary must comply with LGPL requirements. This
means:

- You can use taglib-wasm in commercial projects
- If you modify the TagLib C++ code, you must share those changes
- You must provide a way for users to relink with a modified TagLib

For details, see [lib/taglib/COPYING.LGPL](lib/taglib/COPYING.LGPL)

## 🙏 Acknowledgments

- [TagLib](https://taglib.org/) – Excellent audio metadata library
- [Emscripten](https://emscripten.org/) – WebAssembly compilation toolchain
