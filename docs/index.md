---
layout: home

hero:
  name: TagLib-Wasm
  text: Universal Audio Metadata
  tagline: TagLib compiled to WebAssembly with TypeScript bindings for universal audio metadata handling
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: API Reference
      link: /api/

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
---

## Quick Example

```typescript
import { readTags, writeTagsToFile } from "taglib-wasm/simple";

// Read tags - just one function call!
const tags = await readTags("song.mp3");
console.log(tags.title, tags.artist, tags.album);

// Update tags in-place - even simpler!
await writeTagsToFile("song.mp3", {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});
```

## Installation

::: code-group

```typescript [Deno]
import { TagLib } from "npm:taglib-wasm";
```

```bash [Node.js]
npm install taglib-wasm
```

```bash [Bun]
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
