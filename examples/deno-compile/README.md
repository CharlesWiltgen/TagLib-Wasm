# Deno Compile Example

This example shows how to use TagLib-Wasm with `deno compile`.

## Quick Start

### Recommended: CDN Loading with Streaming

The simplest approach that leverages WebAssembly streaming compilation:

```bash
# Compile the example
./compile-simple.sh

# Run the compiled binary
./taglib-simple                    # Test with demo data
./taglib-simple song.mp3           # Read tags from file  
./taglib-simple *.mp3              # Read tags from multiple files
```

This approach:

- ✅ Uses WebAssembly streaming compilation for optimal performance
- ✅ Simple to implement and maintain
- ✅ Always gets the latest WASM optimizations
- ⚠️ Requires internet connection on first run

### Alternative: Embedded WASM (Complex)

For offline-only scenarios, see `app.ts` for a more complex example that
attempts to embed the WASM. Note that this approach:

- ❌ Doesn't benefit from streaming compilation
- ❌ Creates larger binaries (+500KB)
- ❌ More complex to maintain
- ✅ Works completely offline

## Simple Example

See `simple-app.ts` for a clean example that uses CDN loading:

```typescript
import { readTags, TagLib } from "../../mod.ts";

// Initialize with CDN URL (uses streaming compilation)
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Read tags from a file
const tags = await readTags("song.mp3");
console.log("Title:", tags.title);
console.log("Artist:", tags.artist);
```

## Trade-offs

| Approach      | Pros                          | Cons                        |
| ------------- | ----------------------------- | --------------------------- |
| Embedded WASM | Works offline, single binary  | Larger binary size (+500KB) |
| CDN Loading   | Smaller binary, always latest | Requires network access     |

## Tips

- For production apps, consider hosting the WASM on your own CDN
- The embedded approach is best for CLI tools that need offline support
- Use environment variables to switch between embedded and CDN loading
