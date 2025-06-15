# taglib-wasm Examples

This directory contains examples demonstrating how to use taglib-wasm across different JavaScript runtimes and use cases.

## Directory Structure

- **`common/`** - Runtime-agnostic examples that work across all environments
  - `basic-usage.ts` - Basic tag reading and writing operations
  - `simple-api.ts` - Using the simplified high-level API
  - `automatic-tag-mapping.ts` - Format-agnostic metadata handling
  - `replaygain-soundcheck.ts` - Volume normalization metadata
  - `tag-constants.ts` - Using type-safe tag constants
  - `embind-example.ts` - Direct usage of the Embind-based low-level API

- **`browser/`** - Browser-specific examples
- **`node/`** - Node.js-specific examples  
- **`bun/`** - Bun runtime examples
- **`deno/`** - Deno runtime examples
- **`workers/`** - Cloudflare Workers examples

## Running Examples

### Common Examples
The examples in `common/` can be run in any runtime. Just adjust the import paths if needed:

```bash
# Deno
deno run --allow-read examples/common/basic-usage.ts

# Node.js (requires building first)
node examples/common/basic-usage.js

# Bun
bun examples/common/basic-usage.ts
```

### Runtime-Specific Examples
See the README files in each runtime-specific directory for instructions.

## Import Paths

Examples use relative imports to the library source. When using taglib-wasm in your own project, replace these with:

```typescript
// From NPM
import { TagLib } from 'taglib-wasm';

// From Deno
import { TagLib } from 'npm:taglib-wasm';
```