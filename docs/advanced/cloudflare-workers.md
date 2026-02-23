# Cloudflare Workers

`taglib-wasm` works on Cloudflare Workers using the same unified API as every
other platform. No separate import path or limited API is needed.

## Overview

Cloudflare Workers provide a serverless execution environment on Cloudflare's
global edge network. With TagLib-Wasm, you can process audio metadata without
managing servers.

## Installation

```bash
npm install taglib-wasm
```

## Basic Setup

### 1. Create a Worker

```typescript
// src/index.ts
import { TagLib } from "taglib-wasm";

let taglib: Awaited<ReturnType<typeof TagLib.initialize>> | null = null;

export default {
  async fetch(request: Request): Promise<Response> {
    if (!taglib) {
      taglib = await TagLib.initialize();
    }

    const url = new URL(request.url);

    if (url.pathname === "/metadata" && request.method === "POST") {
      return handleMetadata(request);
    }

    return new Response("Audio Metadata Service", {
      headers: { "content-type": "text/plain" },
    });
  },
};

async function handleMetadata(request: Request): Promise<Response> {
  try {
    const audioData = new Uint8Array(await request.arrayBuffer());

    using file = await taglib!.open(audioData);
    const tag = file.tag();
    const props = file.audioProperties();

    return Response.json({
      title: tag.title,
      artist: tag.artist,
      album: tag.album,
      duration: props?.length,
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
```

### 2. Configure wrangler.toml

```toml
name = "audio-metadata-service"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[[rules]]
type = "Data"
globs = ["**/*.wasm"]
fallthrough = true
```

### 3. Deploy

```bash
wrangler deploy

# Test locally
wrangler dev
```

## Writing Tags

```typescript
async function handleEdit(request: Request): Promise<Response> {
  const audioData = new Uint8Array(await request.arrayBuffer());

  const modified = await taglib!.edit(audioData, (file) => {
    file.tag().setTitle("New Title");
    file.tag().setArtist("New Artist");
  });

  return new Response(modified, {
    headers: { "content-type": "application/octet-stream" },
  });
}
```

## Batch Processing

Process multiple files in a single request:

```typescript
interface BatchRequest {
  files: Array<{
    name: string;
    data: string; // base64 encoded
  }>;
}

async function handleBatch(request: Request): Promise<Response> {
  const { files } = await request.json<BatchRequest>();

  const results = await Promise.all(files.map(async (file) => {
    try {
      const audioData = Uint8Array.from(
        atob(file.data),
        (c) => c.charCodeAt(0),
      );
      using audioFile = await taglib!.open(audioData);
      const tag = audioFile.tag();
      const props = audioFile.audioProperties();
      return {
        name: file.name,
        title: tag.title,
        artist: tag.artist,
        duration: props?.length,
      };
    } catch (error) {
      return { name: file.name, error: (error as Error).message };
    }
  }));

  return Response.json(results);
}
```

## Workers Environment Limits

- **Memory**: 128MB limit per request
- **CPU Time**: 50ms (free) or 30s (paid) per request
- **Request Size**: 100MB maximum

## Testing

```bash
# Start local dev server
wrangler dev

# Test with curl
curl -X POST http://localhost:8787/metadata \
  --data-binary @test.mp3 \
  --header "Content-Type: application/octet-stream"
```

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/cli-wrangler/)
