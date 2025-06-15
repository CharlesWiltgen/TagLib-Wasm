# Cloudflare Workers Example

This example demonstrates how to use `taglib-wasm` in Cloudflare Workers for
serverless audio metadata processing.

## Files

- `audio-processor.ts` - Main Worker that processes audio file metadata
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Node.js dependencies for development

## Features

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

**Request**: Binary audio file in request body **Response**:

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

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build WASM Module

```bash
# Build the taglib-wasm module
npm run build:wasm
```

### 3. Configure wrangler.toml

```toml
name = "taglib-audio-processor"
main = "audio-processor.ts"
compatibility_date = "2023-12-01"

# Upload WASM binary to KV storage
[[kv_namespaces]]
binding = "TAGLIB_WASM_KV"
id = "your-kv-namespace-id"

# Or use R2 for asset storage
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "your-assets-bucket"
```

### 4. Upload WASM Binary

#### Option A: Using KV Storage

```bash
# Upload WASM to KV
wrangler kv:key put --binding=TAGLIB_WASM_KV "taglib.wasm" --path="../../build/taglib.wasm"
```

#### Option B: Using R2 Storage

```bash
# Upload WASM to R2
wrangler r2 object put your-assets-bucket/taglib.wasm --file="../../build/taglib.wasm"
```

#### Option C: Bundle with Worker (Recommended)

Add to `wrangler.toml`:

```toml
[build]
command = "npm run build"

# Bundle WASM files
[[rules]]
type = "Data"
globs = ["**/*.wasm"]
fallthrough = true
```

### 5. Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

## Usage Examples

### cURL Examples

```bash
# Get service info
curl https://your-worker.workers.dev/

# Upload audio file
curl -X POST https://your-worker.workers.dev/metadata \\
  --data-binary @song.mp3 \\
  --header "Content-Type: application/octet-stream"

# Batch processing
curl -X POST https://your-worker.workers.dev/metadata/batch \\
  --header "Content-Type: application/json" \\
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
const response = await fetch("/metadata", {
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

const batchResponse = await fetch("/metadata/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(batchData),
});
const batchResult = await batchResponse.json();
```

## Supported Audio Formats

The Worker supports all formats that TagLib supports:

- MP3 (with ID3v1 and ID3v2 tags)
- MP4/M4A (with iTunes-style metadata)
- FLAC (with Vorbis comments)
- Ogg Vorbis/Opus (with Vorbis comments)
- WAV (with INFO tags)

## Performance Considerations

- **Memory Limits**: Workers have 128MB memory limit, reduced WASM heap
  accordingly
- **CPU Time**: 50ms for free tier, 30 seconds for paid plans
- **File Size**: Recommend limiting uploads to 10MB or less
- **Concurrent Processing**: Workers handle multiple requests efficiently

## Error Handling

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

## Development

```bash
# Local development
wrangler dev

# Test with local file
curl -X POST http://localhost:8787/metadata \\
  --data-binary @test.mp3
```

## Security Considerations

- Validate file sizes before processing
- Implement rate limiting for production use
- Sanitize file metadata in responses
- Use HTTPS for all requests
- Consider authentication for batch endpoints
