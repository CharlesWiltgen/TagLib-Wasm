# Using taglib-wasm with Deno Compile

This guide explains how to use taglib-wasm in compiled Deno binaries.

## The Challenge

`deno compile` creates standalone executables, but taglib-wasm's WebAssembly
module requires special handling since dynamic imports aren't included in the
compiled binary.

## Quick Start

See the complete example in `examples/deno-compile/` for a production-ready
setup.

## Solution 1: Embed WASM (Recommended)

For offline-capable binaries, embed the WASM module:

### Step 1: Generate Embedded Module

```bash
deno run --allow-read --allow-write scripts/bundle-wasm-base64.ts
```

This creates `taglib-wasm-embedded.ts` with the WASM encoded as base64.

### Step 2: Use in Your App

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm@latest";
import { wasmBinary } from "./taglib-wasm-embedded.ts";

const taglib = await TagLib.initialize({ wasmBinary });
const file = await taglib.open("audio.mp3");
console.log(file.tag().title);
file.dispose();
```

### Step 3: Compile

```bash
deno compile --allow-read your-app.ts
```

## Solution 2: Load from CDN

For smaller binaries that require network access:

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm@latest";

const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});
```

## Production Pattern

Here's a robust pattern that works in development and production:

```typescript
import { TagLib } from "jsr:@charlesw/taglib-wasm@latest";

async function initializeTagLib(): Promise<TagLib> {
  // Try embedded WASM first
  try {
    const { wasmBinary } = await import("./taglib-wasm-embedded.ts");
    return await TagLib.initialize({ wasmBinary });
  } catch {
    // Fall back to CDN
    return await TagLib.initialize({
      wasmUrl:
        "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
    });
  }
}
```

## Complete Example

```bash
# Clone the example
cd examples/deno-compile

# Option 1: Compile with embedded WASM (offline support)
./compile.sh --embed
./taglib-tool-embedded song.mp3

# Option 2: Compile with CDN loading (smaller size)
./compile.sh
./taglib-tool song.mp3
```

## Trade-offs

| Approach      | Binary Size | Network Required | Startup Time       |
| ------------- | ----------- | ---------------- | ------------------ |
| Embedded WASM | +500KB      | No               | Fast               |
| CDN Loading   | Minimal     | Yes              | Depends on network |

## Best Practices

1. **Use JSR specifier**: Import from `jsr:@charlesw/taglib-wasm@latest` since
   JSR properly supports Wasm files
2. **Environment variables**: Use `WASM_URL` to configure CDN location
3. **Error handling**: Always provide fallback loading strategies
4. **Test offline**: Ensure embedded binaries work without network

## Tips

- The embedded approach adds ~500KB to your binary
- Consider hosting WASM on your own CDN for production
- Use `--allow-net` only if loading from CDN
- The WASM module is already optimized and compressed
