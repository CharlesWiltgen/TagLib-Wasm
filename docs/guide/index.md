# Introduction

TagLib-Wasm brings the power of [TagLib](https://taglib.org/), the
industry-standard audio metadata library, to JavaScript and TypeScript through
WebAssembly.

## What is TagLib-Wasm?

TagLib-Wasm is a WebAssembly port of TagLib that enables you to:

- **Read and write** audio metadata tags (title, artist, album, etc.)
- **Support all major formats** including MP3, FLAC, MP4/M4A, OGG, and WAV
- **Work everywhere** – Deno, Node.js, Bun, browsers, and Cloudflare Workers
- **Use modern APIs** with TypeScript-first design and async/await support
- **Handle advanced metadata** like MusicBrainz IDs, AcoustID, and ReplayGain

## Key Features

### 🎯 Format Abstraction

Write once, work with any format:

```typescript
// Same API works for MP3, FLAC, MP4, OGG, WAV...
file.setTitle("My Song");
file.setAcoustidId("12345678-90ab-cdef");
```

### 🚀 Two API Styles

Choose the API that fits your needs:

**Simple API** - For quick tasks:

```typescript
const tags = await readTags("song.mp3");
await writeTagsToFile("song.mp3", { title: "New Title" });
```

**Full API** - For full control:

```typescript
const taglib = await TagLib.initialize();
using file = taglib.openFile(audioData);
file.setTitle("New Title");
file.save();
```

### 🌐 Universal Runtime Support

| Runtime            | Support   | Package                   |
| ------------------ | --------- | ------------------------- |
| Deno               | ✅ Native | `npm:taglib-wasm`         |
| Node.js            | ✅ Full   | `npm install taglib-wasm` |
| Bun                | ✅ Native | `bun add taglib-wasm`     |
| Browsers           | ✅ Full   | CDN or bundler            |
| Cloudflare Workers | ✅ Full   | `npm install taglib-wasm` |

## When to Use TagLib-Wasm

TagLib-Wasm is ideal when you need to:

- Build music library managers or media players
- Process audio files in batch operations
- Extract metadata for music databases
- Implement audio file organization tools
- Add tagging features to web applications
- Process audio metadata in serverless functions

## Next Steps

- [Installation Guide](./installation.md) - Get started with your runtime
- [Quick Start](./quick-start.md) - Write your first metadata handler
- [API Reference](/api/) - Explore the full API
