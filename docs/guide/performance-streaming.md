# WebAssembly Streaming Compilation

TagLib-Wasm uses WebAssembly streaming APIs when it loads a network source.

## How It Works

When you initialize TagLib-Wasm with a URL:

```typescript
const taglib = await TagLib.initialize({
  wasmUrl:
    "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib-web.wasm",
});
```

The library automatically uses `WebAssembly.instantiateStreaming()` when
available, which provides:

1. **Parallel Download & Compilation**: The WebAssembly module is compiled while
   it's being downloaded
2. **Lower Memory Usage**: No need to buffer the entire WASM file before
   compilation
3. **Faster Startup**: Compilation begins as soon as the first bytes arrive

## Browser Support

Streaming compilation is supported in:

- Chrome 61+
- Firefox 58+
- Safari 15+
- Edge 79+
- Deno (when loading from URLs)

## Fallback Behavior

If streaming is not available or fails, TagLib-Wasm automatically falls back to
standard ArrayBuffer instantiation:

```
wasm streaming compile failed: TypeError: Failed to fetch
falling back to ArrayBuffer instantiation
```

This ensures compatibility across all environments.

## Best Practices

### 1. Use CDN URLs for Web Apps

```typescript
import { TagLib } from "taglib-wasm";

// Recommended: Load from CDN with streaming
const taglib = await TagLib.initialize({
  wasmUrl:
    "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib-web.wasm",
});

// Also good: Use your own CDN
const ownCdnTaglib = await TagLib.initialize({
  wasmUrl: "https://your-cdn.com/assets/taglib.wasm",
});
```

> **Production:** pin an exact version (`taglib-wasm@2.2.3`) rather than
> `@latest`, so a new release can't swap the Wasm under a running deployment.
> See [Deno Compile → Tips for Production](./deno-compile.md#tips-for-production).

### 2. Ensure Proper Server Headers

For optimal streaming, ensure your server returns:

```
Content-Type: application/wasm
Access-Control-Allow-Origin: * (or specific origin)
Cache-Control: public, max-age=31536000
```

### 3. Monitor Loading Performance

```typescript
console.time("TagLib initialization");
const taglib = await TagLib.initialize({
  wasmUrl:
    "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib-web.wasm",
});
console.timeEnd("TagLib initialization");
// The first call includes the Wasm download; the second is served from cache.
// Compare cold with warm on your own machine and network — see the note below.
```

## When Streaming Isn't Used

Streaming compilation is NOT used when:

1. **Loading from ArrayBuffer**: When you provide `wasmBinary` directly
2. **File System Access**: When loading from disk in Node.js
3. **Embedded WASM**: In Deno compiled binaries
4. **Unsupported Environments**: Older browsers or restricted environments

In these cases, the standard instantiation path is used, which is still
performant but requires the full WASM binary in memory before compilation
begins.

## Performance Comparison

| Loading Method  | Source     | Streaming Used | What streaming buys                                  |
| --------------- | ---------- | -------------- | ---------------------------------------------------- |
| CDN URL         | network    | ✅ Yes         | the ~700 KB download is compiled as it arrives       |
| Local File      | filesystem | ❌ No          | nothing — the file is read, then compiled            |
| Embedded Binary | app binary | ❌ No          | nothing — the bytes are in the binary, then compiled |
| ArrayBuffer     | caller     | ❌ No          | nothing — you already hold the bytes                 |

Startup time depends on the machine, the ~700 KB Wasm download, and network
latency, so measure instead of extrapolating: run the `console.time` block above
twice, once cold (empty HTTP cache) and once warm, on your target hardware and
connection.

## Technical Details

The Emscripten-generated runtime in TagLib-Wasm includes this streaming logic:

```javascript
if (!binary && typeof WebAssembly.instantiateStreaming == "function") {
  try {
    var response = fetch(binaryFile, { credentials: "same-origin" });
    var instantiationResult = await WebAssembly.instantiateStreaming(
      response,
      imports,
    );
    return instantiationResult;
  } catch (reason) {
    // Falls back to ArrayBuffer instantiation
  }
}
```

This means streaming happens automatically, with no configuration.

## Next Steps

- [Memory Management](../concepts/memory-management.md) — how the Wasm heap is
  sized, and when `using` or `dispose()` releases a file's memory
- [Performance Guide](../concepts/performance.md) — tuning beyond startup
