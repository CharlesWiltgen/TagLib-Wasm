# Cloudflare Workers

`taglib-wasm` supports Cloudflare Workers for serverless audio metadata
processing at the edge. This guide covers setup, deployment, and best practices.

## Workers API Limitations

The `taglib-wasm/workers` path uses C-style Emscripten bindings with a reduced
feature set compared to the standard API:

| Feature                                                  | Standard API | Workers API         |
| -------------------------------------------------------- | ------------ | ------------------- |
| Basic tags (title, artist, album, etc.)                  | Full         | Full                |
| Extended tags (albumArtist, MusicBrainz, ReplayGain)     | Full         | Not available       |
| Audio properties (length, bitrate, sampleRate, channels) | Full         | Full                |
| Audio properties (codec, bitsPerSample, containerFormat) | Full         | Returns stub values |
| Cover art / pictures                                     | Full         | Not available       |
| Ratings                                                  | Full         | Not available       |
| File buffer export (getFileBuffer)                       | Full         | Not available       |
| PropertyMap access                                       | Full         | Not available       |

## Overview

Cloudflare Workers provide a serverless execution environment that runs on
Cloudflare's global edge network. With TagLib-Wasm, you can process audio
metadata without managing servers, scaling automatically to handle millions of
requests.

### Key Benefits

- **Global Edge Deployment**: Process audio files close to your users
- **Automatic Scaling**: Handle traffic spikes without configuration
- **Cost Effective**: Pay only for what you use
- **No Cold Starts**: Workers stay warm for instant response times
- **Built-in Security**: HTTPS, DDoS protection, and rate limiting

## Installation

In your Workers project:

```bash
npm install taglib-wasm
```

## Basic Setup

### 1. Create a Worker

```typescript
// src/index.ts
import { TagLibWorkers } from "taglib-wasm/workers";
import wasmBinary from "../build/taglib.wasm";

export default {
  async fetch(request: Request): Promise<Response> {
    // Initialize TagLib — wasmBinary is required
    const taglib = await TagLibWorkers.initialize(wasmBinary, {
      memory: {
        initial: 16 * 1024 * 1024, // 16MB
        maximum: 128 * 1024 * 1024, // 128MB
      },
    });

    // Handle different routes
    const url = new URL(request.url);

    if (url.pathname === "/metadata" && request.method === "POST") {
      return handleMetadata(request, taglib);
    }

    return new Response("Audio Metadata Service", {
      headers: { "content-type": "text/plain" },
    });
  },
};

async function handleMetadata(
  request: Request,
  taglib: TagLibWorkers,
): Promise<Response> {
  try {
    // Get audio data from request
    const audioData = new Uint8Array(await request.arrayBuffer());

    // Open and process file — automatically disposed when out of scope
    using file = taglib.open(audioData);

    // Extract metadata
    const tag = file.tag();
    const props = file.audioProperties();
    const metadata = {
      tag: {
        title: tag.title,
        artist: tag.artist,
        album: tag.album,
        year: tag.year,
        track: tag.track,
        genre: tag.genre,
        comment: tag.comment,
      },
      audioProperties: {
        length: props?.length,
        bitrate: props?.bitrate,
        sampleRate: props?.sampleRate,
        channels: props?.channels,
      },
      format: file.format(),
    };

    return new Response(JSON.stringify(metadata), {
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
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

# Optional: Bundle Wasm files
[[rules]]
type = "Data"
globs = ["**/*.wasm"]
fallthrough = true
```

### 3. Deploy

```bash
# Deploy to Cloudflare
wrangler deploy

# Test locally
wrangler dev
```

## Advanced Features

### Batch Processing

Process multiple files in a single request:

```typescript
interface BatchRequest {
  files: Array<{
    name: string;
    data: string; // base64 encoded
  }>;
}

async function handleBatch(
  request: Request,
  taglib: TagLibWorkers,
): Promise<Response> {
  const { files } = await request.json<BatchRequest>();

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const audioData = Uint8Array.from(
          atob(file.data),
          (c) => c.charCodeAt(0),
        );
        using tagFile = taglib.open(audioData);
        const tag = tagFile.tag();
        const props = tagFile.audioProperties();

        return {
          name: file.name,
          title: tag.title,
          artist: tag.artist,
          duration: props?.length,
        };
      } catch (error) {
        return { name: file.name, error: error.message };
      }
    }),
  );

  return new Response(JSON.stringify(results), {
    headers: { "content-type": "application/json" },
  });
}
```

### Using Workers KV for Caching

Cache processed metadata to reduce processing time:

```typescript
import { TagLibWorkers } from "taglib-wasm/workers";
import wasmBinary from "../build/taglib.wasm";

interface Env {
  METADATA_CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const taglib = await TagLibWorkers.initialize(wasmBinary, {
      memory: { initial: 16 * 1024 * 1024, maximum: 64 * 1024 * 1024 },
    });

    // Generate cache key from file content
    const audioData = new Uint8Array(await request.arrayBuffer());
    const hashBuffer = await crypto.subtle.digest("SHA-256", audioData);
    const cacheKey = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Check cache
    const cached = await env.METADATA_CACHE.get(cacheKey, "json");
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { "content-type": "application/json", "x-cache": "hit" },
      });
    }

    // Process file
    using file = taglib.open(audioData);
    const tag = file.tag();
    const metadata = { title: tag.title, artist: tag.artist };

    // Cache for 1 hour
    await env.METADATA_CACHE.put(cacheKey, JSON.stringify(metadata), {
      expirationTtl: 3600,
    });

    return new Response(JSON.stringify(metadata), {
      headers: { "content-type": "application/json", "x-cache": "miss" },
    });
  },
};
```

### Durable Objects Integration

Use Durable Objects for stateful processing:

```typescript
import { TagLibWorkers } from "taglib-wasm/workers";
import wasmBinary from "../build/taglib.wasm";

export class AudioProcessor {
  private taglib: TagLibWorkers | null = null;

  async fetch(request: Request): Promise<Response> {
    // Initialize once per Durable Object instance
    if (!this.taglib) {
      this.taglib = await TagLibWorkers.initialize(wasmBinary, {
        memory: { initial: 16 * 1024 * 1024, maximum: 128 * 1024 * 1024 },
      });
    }

    // Process request with persistent TagLib instance
    const audioData = new Uint8Array(await request.arrayBuffer());
    using file = this.taglib.open(audioData);

    // ... process file ...

    return new Response(JSON.stringify(metadata));
  }
}
```

## Memory Configuration

Cloudflare Workers have specific memory constraints that differ from other
JavaScript runtimes. The `TagLibConfig` interface allows you to customize memory
allocation for optimal performance in the Workers environment.

### Configuration Options

```typescript
interface TagLibConfig {
  memory?: {
    initial?: number; // Initial memory size in bytes (default: 16MB)
    maximum?: number; // Maximum memory size in bytes (default: 256MB)
  };
  debug?: boolean; // Enable debug output (default: false)
}
```

### When to Adjust Memory Settings

The default configuration works well for most use cases, but you may need to
adjust memory settings when:

1. **Processing Large Files**: Increase memory for files over 10MB
2. **High Concurrency**: Reduce memory to handle more concurrent requests
3. **Memory Pressure**: Workers approaching the 128MB limit
4. **Batch Processing**: Optimize for multiple files in sequence

### Configuration Examples

#### Small Files / High Concurrency

```typescript
// Optimize for many small files (< 5MB each)
const taglib = await TagLibWorkers.initialize(wasmBinary, {
  memory: {
    initial: 8 * 1024 * 1024, // 8MB initial
    maximum: 32 * 1024 * 1024, // 32MB maximum
  },
});
```

#### Large Files / Low Concurrency

```typescript
// Optimize for large files (10-50MB)
const taglib = await TagLibWorkers.initialize(wasmBinary, {
  memory: {
    initial: 32 * 1024 * 1024, // 32MB initial
    maximum: 128 * 1024 * 1024, // 128MB maximum (Workers limit)
  },
});
```

#### Debug Mode

```typescript
// Enable debug output for troubleshooting
const taglib = await TagLibWorkers.initialize(wasmBinary, {
  memory: {
    initial: 16 * 1024 * 1024,
    maximum: 64 * 1024 * 1024,
  },
  debug: true, // Logs initialization and memory usage
});
```

### Memory Usage Guidelines

| File Size | Recommended Initial | Recommended Maximum | Notes                  |
| --------- | ------------------- | ------------------- | ---------------------- |
| < 1MB     | 4MB                 | 16MB                | Minimal overhead       |
| 1-5MB     | 8MB                 | 32MB                | Default for most APIs  |
| 5-10MB    | 16MB                | 64MB                | Standard configuration |
| 10-25MB   | 32MB                | 96MB                | Large file handling    |
| 25-50MB   | 48MB                | 128MB               | Maximum for Workers    |

### Important Considerations

1. **Workers Memory Limit**: Cloudflare Workers have a hard limit of 128MB per
   request
2. **Memory Growth**: WebAssembly memory can grow but cannot shrink during
   execution
3. **Initialization Cost**: Higher initial memory means slower first-time
   initialization
4. **Concurrent Requests**: Each request gets its own memory allocation

### Best Practices

1. **Start Small**: Begin with lower memory settings and increase if needed
2. **Monitor Usage**: Use the debug flag to understand actual memory consumption
3. **Cache Instances**: Reuse TagLib instances across requests when possible
4. **Profile First**: Test with your actual file sizes before optimizing

```typescript
// Production configuration with error handling
export async function initializeTagLib(
  wasmBinary: Uint8Array,
  fileSize?: number,
) {
  // Dynamic configuration based on file size
  const config: TagLibConfig = {
    memory: {
      initial: Math.min(
        fileSize ? fileSize * 2 : 16 * 1024 * 1024,
        32 * 1024 * 1024,
      ),
      maximum: Math.min(
        fileSize ? fileSize * 4 : 64 * 1024 * 1024,
        128 * 1024 * 1024,
      ),
    },
    debug: process.env.NODE_ENV === "development",
  };

  try {
    return await TagLibWorkers.initialize(wasmBinary, config);
  } catch (error) {
    console.error("Failed to initialize TagLib:", error);
    // Fallback to minimal configuration
    return await TagLibWorkers.initialize(wasmBinary, {
      memory: { initial: 8 * 1024 * 1024, maximum: 32 * 1024 * 1024 },
    });
  }
}
```

## Performance Optimization

### Batch Processing

Process multiple files efficiently in Workers:

```typescript
import { TagLibWorkers } from "taglib-wasm/workers";
import wasmBinary from "../build/taglib.wasm";

// Process files in chunks to manage memory
async function processBatch(files: File[]): Promise<any[]> {
  const taglib = await TagLibWorkers.initialize(wasmBinary, {
    memory: { initial: 16 * 1024 * 1024, maximum: 64 * 1024 * 1024 },
  });

  const CHUNK_SIZE = 10;
  const results = [];

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((file) => processFile(file, taglib)),
    );
    results.push(...chunkResults);

    // Optional: Force garbage collection between chunks
    if (global.gc) global.gc();
  }

  return results;
}
```

### Request Size Limits

Workers have request size limits. Handle large files appropriately:

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default {
  async fetch(request: Request): Promise<Response> {
    // Check Content-Length header
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return new Response("File too large", { status: 413 });
    }

    // Process file
    // ...
  },
};
```

## Error Handling

Implement comprehensive error handling:

```typescript
import { TagLibWorkers } from "taglib-wasm/workers";
import wasmBinary from "../build/taglib.wasm";

class AudioMetadataError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "AudioMetadataError";
  }
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    const taglib = await TagLibWorkers.initialize(wasmBinary, {
      memory: { initial: 16 * 1024 * 1024, maximum: 64 * 1024 * 1024 },
    });

    // Validate request
    if (request.method !== "POST") {
      throw new AudioMetadataError("Method not allowed", 405);
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/octet-stream")) {
      throw new AudioMetadataError("Invalid content type", 400);
    }

    // Process audio — open() throws InvalidFormatError on bad input
    const audioData = new Uint8Array(await request.arrayBuffer());
    using file = taglib.open(audioData);
    const tag = file.tag();

    const metadata = { title: tag.title, artist: tag.artist };

    return new Response(JSON.stringify(metadata), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof AudioMetadataError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.statusCode },
      );
    }

    // Log unexpected errors
    console.error("Unexpected error:", error);

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 },
    );
  }
}
```

## Security Best Practices

### Input Validation

Always validate and sanitize inputs:

```typescript
function validateAudioData(data: Uint8Array): void {
  // Check minimum size
  if (data.length < 100) {
    throw new Error("File too small to be valid audio");
  }

  // Check maximum size
  if (data.length > 50 * 1024 * 1024) { // 50MB
    throw new Error("File too large");
  }

  // Optional: Check file signatures
  const signatures = {
    mp3: [0xFF, 0xFB], // MP3
    flac: [0x66, 0x4C, 0x61, 0x43], // fLaC
    ogg: [0x4F, 0x67, 0x67, 0x53], // OggS
  };

  // Validate against known signatures
  // ...
}
```

### Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
interface Env {
  RATE_LIMITER: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get client identifier
    const clientId = request.headers.get("cf-connecting-ip") || "unknown";

    // Check rate limit
    const limiterId = env.RATE_LIMITER.idFromName(clientId);
    const limiter = env.RATE_LIMITER.get(limiterId);

    const allowed = await limiter.fetch(request).then((r) => r.json());
    if (!allowed) {
      return new Response("Rate limit exceeded", { status: 429 });
    }

    // Process request
    // ...
  },
};
```

### CORS Configuration

Configure CORS for browser access:

```typescript
function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });

  // Optional: Restrict to specific origins
  const origin = request.headers.get("Origin");
  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}
```

## Testing

### Local Development

```bash
# Start local dev server
wrangler dev

# Test with curl
curl -X POST http://localhost:8787/metadata \
  --data-binary @test.mp3 \
  --header "Content-Type: application/octet-stream"
```

### Unit Testing

```typescript
// test/worker.test.ts
import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

describe("Audio Metadata Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should extract metadata from MP3", async () => {
    const audioData = await fs.readFile("test.mp3");
    const response = await worker.fetch("/metadata", {
      method: "POST",
      body: audioData,
    });

    const metadata = await response.json();
    expect(metadata.format).toBe("MP3");
    expect(metadata.tag.title).toBeDefined();
  });
});
```

## Deployment

### Production Checklist

- [ ] Configure custom domain
- [ ] Set up monitoring and alerts
- [ ] Implement rate limiting
- [ ] Enable caching where appropriate
- [ ] Configure error logging
- [ ] Set up CI/CD pipeline
- [ ] Test with production-like data

### Environment Variables

```toml
# wrangler.toml
[vars]
MAX_FILE_SIZE = "10485760" # 10MB in bytes
CACHE_TTL = "3600" # 1 hour in seconds

[env.production]
[env.production.vars]
DEBUG = "false"
ALLOWED_ORIGINS = "https://example.com,https://app.example.com"

[env.staging]
[env.staging.vars]
DEBUG = "true"
ALLOWED_ORIGINS = "*"
```

## Examples

Complete working examples are available in the
[examples/workers](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/workers)
directory:

- `audio-processor.ts` - Full-featured metadata extraction service
- `wrangler.toml` - Production-ready configuration
- `README.md` - Detailed setup instructions

## Limitations

### Workers Environment

- **Memory**: 128MB limit per request
- **CPU Time**: 50ms (free) or 30s (paid) per request
- **Request Size**: 100MB maximum
- **Response Size**: 100MB maximum
- **Subrequests**: 50 per request

### TagLib-Wasm Specific

- Files must be fully loaded into memory
- No streaming support (Workers limitation)
- Single-threaded execution
- No persistent storage (use KV/R2/D1)

## Troubleshooting

### Common Issues

**Wasm module fails to load**

```typescript
// Ensure Wasm is properly bundled
import wasmModule from "taglib-wasm/taglib.wasm";

// Or fetch from KV/R2 if stored separately
const wasmBinary = await env.KV.get("taglib.wasm", "arrayBuffer");
```

**Memory allocation errors**

```typescript
// Reduce initial memory allocation
const taglib = await TagLibWorkers.initialize(wasmBinary, {
  memory: { initial: 8 * 1024 * 1024 }, // 8MB
});
```

**Timeout errors**

```typescript
// Process smaller batches
// Implement pagination for large requests
// Use Durable Objects for long-running tasks
```

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/cli-wrangler/)
- [Workers Examples](https://github.com/cloudflare/workers-sdk/tree/main/templates)
- [TagLib-Wasm Repository](https://github.com/CharlesWiltgen/TagLib-Wasm)
