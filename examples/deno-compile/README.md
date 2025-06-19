# Deno Compile Example

This example shows how to use taglib-wasm with `deno compile`.

## Quick Start

### Option 1: Embed WASM (Recommended for offline use)

1. Generate the embedded WASM module:
   ```bash
   deno run --allow-read --allow-write ../../scripts/bundle-wasm-base64.ts
   ```

2. Use in your app:
   ```typescript
   import { TagLib } from "taglib-wasm";
   import { wasmBinary } from "./taglib-wasm-embedded.ts";

   const taglib = await TagLib.initialize({ wasmBinary });
   ```

3. Compile:
   ```bash
   deno compile --allow-read app.ts
   ```

### Option 2: Load from CDN (Requires network)

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm"
});
```

## Complete Example

See `app.ts` for a working example that handles both scenarios.

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Embedded WASM | Works offline, single binary | Larger binary size (+500KB) |
| CDN Loading | Smaller binary, always latest | Requires network access |

## Tips

- For production apps, consider hosting the WASM on your own CDN
- The embedded approach is best for CLI tools that need offline support
- Use environment variables to switch between embedded and CDN loading