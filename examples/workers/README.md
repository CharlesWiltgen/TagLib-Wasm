# Cloudflare Workers Example

Example deployment of TagLib-Wasm on Cloudflare Workers for serverless audio
metadata processing.

📚
**[View the full Workers Setup Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/workers-setup.html)**
in our documentation for detailed deployment instructions.

## Quick Start

```bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
wrangler deploy

# Test the deployment
curl https://your-worker.workers.dev/
```

## Files

- `audio-processor.ts` - Main Worker implementation
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Dependencies
