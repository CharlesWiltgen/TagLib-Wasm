---
home: true
heroText: TagLib-Wasm
tagline: TagLib compiled to WebAssembly with TypeScript bindings for universal audio metadata handling
actions:
  - text: Get Started
    link: /guide/
    type: primary
  - text: API Reference
    link: /api/
    type: secondary
features:
  - title: Universal Compatibility
    details: Works seamlessly with Deno, Node.js, Bun, web browsers, and Cloudflare Workers
  - title: TypeScript First
    details: Complete type definitions and modern async API for excellent developer experience
  - title: All Audio Formats
    details: Supports MP3, FLAC, MP4/M4A, OGG, WAV and many more formats via TagLib
  - title: Format Abstraction
    details: Automatic tag mapping handles format-specific differences transparently
  - title: Zero Dependencies
    details: Self-contained Wasm bundle with no external dependencies
  - title: Battle-Tested
    details: Built on TagLib, the de-facto standard for audio metadata since 2002
footer: MIT Licensed | Copyright © 2024 Charles Wiltgen
---

## Quick Example

```typescript
import { readTags, updateTags } from "taglib-wasm/simple";

// Read tags - just one function call!
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Update tags in-place - even simpler!
await updateTags("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});
```

## Installation

::: code-tabs @tab Deno

```typescript
import { TagLib } from "npm:taglib-wasm";
```

@tab Node.js

```bash
npm install taglib-wasm
```

@tab Bun

```bash
bun add taglib-wasm
```

:::

## Why TagLib-Wasm?

The JavaScript/TypeScript ecosystem lacked a robust, universal solution for
reading and writing audio metadata across all popular formats. Existing
solutions were either:

- **Limited to specific formats** (e.g., MP3-only)
- **Platform-specific** (requiring native dependencies)
- **Incomplete** (missing write support or advanced features)
- **Unmaintained** (dormant projects)

TagLib-Wasm solves these problems by bringing the power of TagLib – the
industry-standard C++ audio metadata library – to JavaScript via WebAssembly.
