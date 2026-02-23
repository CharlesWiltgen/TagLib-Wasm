# Cloudflare Workers Setup

This guide explains how to deploy TagLib-Wasm on Cloudflare Workers for
serverless audio metadata processing.

## Overview

Cloudflare Workers provide a serverless execution environment that runs at the
edge. With TagLib-Wasm, you can process audio metadata without managing servers,
scaling automatically to handle any load.

## Example Worker

A complete example is available in the
[examples/workers](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/workers)
directory.

### Features

- **Single file processing**: POST audio files to extract metadata
- **Batch processing**: Process multiple files in one request
- **CORS support**: Works with browser uploads
- **Error handling**: Comprehensive error responses
- **Memory optimization**: Reduced memory limits for Workers environment

## API Endpoints

### `GET /`

Returns service information and available endpoints.

### `POST /metadata`

Upload an audio file and get its metadata.

**Request**: Binary audio file in request body

**Response**:

```json
{
  "success": true,
  "metadata": {
    "tag": {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "year": 2023,
      "track": 1
    },
    "audioProperties": {
      "length": 240,
      "bitrate": 320,
      "sampleRate": 44100,
      "channels": 2,
      "format": "MP3"
    },
    "format": "MP3"
  },
  "fileSize": 1024000,
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

### `POST /metadata/batch`

Process multiple audio files in one request.

**Request**:

```json
[
  {
    "filename": "song1.mp3",
    "data": "base64-encoded-audio-data"
  },
  {
    "filename": "song2.flac",
    "data": "base64-encoded-audio-data"
  }
]
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd examples/workers
npm install
```

### 2. Configure wrangler.toml

Create a `wrangler.toml` file:

```toml
name = "taglib-audio-processor"
main = "audio-processor.ts"
compatibility_date = "2023-12-01"

[build]
command = "npm run build"

# Bundle WASM files
[[rules]]
type = "Data"
globs = ["**/*.wasm"]
fallthrough = true
```

### 3. Deploy Options

#### Option A: Bundle with Worker (Recommended)

The WASM file is bundled directly with your Worker code. This is the simplest
approach:

```bash
# Build and deploy
wrangler deploy
```

#### Option B: Using KV Storage

For larger deployments, store the WASM in KV:

```toml
[[kv_namespaces]]
binding = "TAGLIB_WASM_KV"
id = "your-kv-namespace-id"
```

```bash
# Create KV namespace
wrangler kv:namespace create "TAGLIB_WASM_KV"

# Upload WASM to KV
wrangler kv:key put --binding=TAGLIB_WASM_KV "taglib.wasm" --path="../../build/taglib.wasm"
```

#### Option C: Using R2 Storage

For best performance with large files:

```toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "your-assets-bucket"
```

```bash
# Create R2 bucket
wrangler r2 bucket create your-assets-bucket

# Upload WASM to R2
wrangler r2 object put your-assets-bucket/taglib.wasm --file="../../build/taglib.wasm"
```

### 4. Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# View logs
wrangler tail
```

## Usage Examples

### cURL Examples

```bash
# Get service info
curl https://your-worker.workers.dev/

# Upload audio file
curl -X POST https://your-worker.workers.dev/metadata \
  --data-binary @song.mp3 \
  --header "Content-Type: application/octet-stream"

# Batch processing
curl -X POST https://your-worker.workers.dev/metadata/batch \
  --header "Content-Type: application/json" \
  --data '[
    {
      "filename": "song1.mp3",
      "data": "base64AudioData1..."
    },
    {
      "filename": "song2.flac",
      "data": "base64AudioData2..."
    }
  ]'
```

### JavaScript Client

```javascript
// Single file upload
const file = document.getElementById("audioFile").files[0];
const response = await fetch("https://your-worker.workers.dev/metadata", {
  method: "POST",
  body: file,
});
const result = await response.json();
console.log(result.metadata);

// Batch upload
const files = Array.from(document.getElementById("audioFiles").files);
const batchData = await Promise.all(
  files.map(async (file) => ({
    filename: file.name,
    data: btoa(
      String.fromCharCode(...new Uint8Array(await file.arrayBuffer())),
    ),
  })),
);

const batchResponse = await fetch(
  "https://your-worker.workers.dev/metadata/batch",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchData),
  },
);
const batchResult = await batchResponse.json();
```

## Performance Considerations

### Memory Limits

- Workers have a 128MB memory limit
- Reduce WASM heap size accordingly in your initialization
- Consider streaming for very large files

### CPU Time

- 50ms CPU time for free tier
- 30 seconds for paid plans
- Batch operations count towards single invocation limit

### File Size Recommendations

- Limit uploads to 10MB or less for best performance
- Use R2 for storing processed results if needed
- Consider chunking for larger files

## Security Considerations

1. **Input Validation**
   - Validate file sizes before processing
   - Check file headers to ensure valid audio formats
   - Sanitize metadata in responses

2. **Rate Limiting**
   - Implement rate limiting for production use
   - Use Cloudflare's built-in DDoS protection
   - Consider authentication for batch endpoints

3. **CORS Configuration**
   - Configure CORS headers appropriately
   - Limit allowed origins in production
   - Use preflight checks for complex requests

## Development Tips

### Local Development

```bash
# Run locally with hot reload
wrangler dev

# Test with local file
curl -X POST http://localhost:8787/metadata \
  --data-binary @test.mp3
```

### Debugging

```typescript
// Add debug logging (remove in production)
console.log("Processing file:", filename);

// Use wrangler tail to view logs
wrangler tail
```

### Error Handling

The Worker provides detailed error responses:

```json
{
  "error": "Failed to process audio file",
  "message": "Failed to open audio file - invalid format or corrupted data"
}
```

Common errors:

- Invalid audio format
- Corrupted file data
- Memory allocation failures
- WASM module loading issues

## Production Checklist

- [ ] Remove debug logging
- [ ] Implement rate limiting
- [ ] Configure CORS properly
- [ ] Add monitoring/alerting
- [ ] Set up error tracking
- [ ] Document API endpoints
- [ ] Add authentication if needed
- [ ] Test with various file sizes
- [ ] Optimize WASM heap size
- [ ] Enable Cloudflare caching where appropriate

## Next Steps

- Explore the
  [complete example](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/workers)
- Read about
  [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Learn about
  [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) for
  metadata caching
- Consider
  [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
  for stateful processing
