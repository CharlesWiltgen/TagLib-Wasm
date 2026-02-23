# Examples

This guide provides an overview of all TagLib-Wasm examples and how to run them
across different JavaScript runtimes.

## Example Categories

### Common Examples

The `examples/common/` directory contains runtime-agnostic examples that
demonstrate core functionality:

- **[basic-usage.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/basic-usage.ts)** -
  Basic tag reading and writing operations
- **[simple-api.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/simple-api.ts)** -
  Using the simplified high-level API
- **[automatic-tag-mapping.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/automatic-tag-mapping.ts)** -
  Format-agnostic metadata handling
- **[replaygain-soundcheck.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/replaygain-soundcheck.ts)** -
  Volume normalization metadata
- **[tag-constants.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/tag-constants.ts)** -
  Using type-safe tag constants
- **[embind-example.ts](https://github.com/CharlesWiltgen/TagLib-Wasm/blob/main/examples/common/embind-example.ts)** -
  Direct usage of the Embind-based low-level API

### Runtime-Specific Examples

- **[browser/](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/browser)** -
  Browser-specific implementations
- **[node/](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/node)** -
  Node.js-specific patterns
- **[bun/](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/bun)** -
  Bun runtime examples
- **[deno/](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/deno)** -
  Deno runtime examples
- **[workers/](https://github.com/CharlesWiltgen/TagLib-Wasm/tree/main/examples/workers)** -
  Cloudflare Workers serverless deployment

## Running Examples

### Prerequisites

First, ensure you have TagLib-Wasm installed:

```bash
# NPM/Node.js/Bun
npm install taglib-wasm

# Deno
import { TagLib } from "npm:taglib-wasm";
```

### Running Common Examples

The examples in `common/` can be run in any runtime. When running locally, you
may need to build the project first:

```bash
# Build the project (if running from source)
npm run build
```

#### Deno

```bash
deno run --allow-read examples/common/basic-usage.ts
```

#### Node.js

```bash
# TypeScript files need to be compiled first
npm run build:ts
node dist/examples/common/basic-usage.js

# Or use tsx for direct execution
npx tsx examples/common/basic-usage.ts
```

#### Bun

```bash
bun examples/common/basic-usage.ts
```

### Platform-Specific Examples

See the [Platform Examples](./platform-examples.md) guide for detailed
instructions on running examples in specific environments.

## Example Highlights

### Basic Tag Operations

The `basic-usage.ts` example shows fundamental operations:

```typescript
import { TagLib } from "taglib-wasm";

// Initialize the library
const taglib = await TagLib.load();

// Read an audio file
using audioFile = taglib.openFile(audioBuffer);

// Read tags
const tag = audioFile.getTag();
console.log(`Title: ${tag.title()}`);
console.log(`Artist: ${tag.artist()}`);

// Modify tags
tag.setTitle("New Title");
tag.setArtist("New Artist");

// Save changes
audioFile.save();
const modifiedBuffer = audioFile.getFileBuffer();
```

### Simple API

The `simple-api.ts` example demonstrates the high-level API:

```typescript
import { applyTags, readTags } from "taglib-wasm/simple";

// Read tags
const metadata = await readTags(audioBuffer);
console.log(metadata);

// Write tags
const modifiedBuffer = await applyTags(audioBuffer, {
  title: "New Title",
  artist: "New Artist",
  album: "New Album",
});
```

### Format-Agnostic Metadata

The `automatic-tag-mapping.ts` example shows how TagLib-Wasm handles metadata
across different formats:

```typescript
// Works the same for MP3, FLAC, M4A, etc.
const tags = {
  MUSICBRAINZ_TRACKID: "550e8400-e29b-41d4-a716-446655440000",
  REPLAYGAIN_TRACK_GAIN: "-6.5 dB",
  ACOUSTID_ID: "12345678-1234-1234-1234-123456789012",
};

// TagLib automatically maps to the correct format-specific fields
const modifiedBuffer = await applyTags(audioBuffer, tags);
```

## Import Paths

When using TagLib-Wasm in your own project, replace the example import paths:

```typescript
// Examples use relative imports (for development)
import { TagLib } from "../../src/taglib.js";

// Your project should use package imports
import { TagLib } from "taglib-wasm"; // NPM
import { TagLib } from "npm:taglib-wasm"; // Deno
```

## Next Steps

- Check out the [Platform Examples](./platform-examples.md) for runtime-specific
  patterns
- See the [Cloudflare Workers Setup](./workers-setup.md) for serverless
  deployment
- Read the [API Reference](/api/) for detailed documentation
- Explore [Cover Art handling](./cover-art.md) for working with embedded images
