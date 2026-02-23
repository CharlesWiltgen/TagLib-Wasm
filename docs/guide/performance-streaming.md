# WebAssembly Streaming Compilation

TagLib-Wasm automatically leverages WebAssembly streaming APIs for optimal
performance when loading from network sources.

## How It Works

When you initialize TagLib-Wasm with a URL:

```typescript
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
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
// Recommended: Load from CDN with streaming
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Also good: Use your own CDN
const taglib = await TagLib.initialize({
  wasmUrl: "https://your-cdn.com/assets/taglib.wasm",
});
```

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
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});
console.timeEnd("TagLib initialization");
// Typical: 200-400ms with streaming, 400-800ms without
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

| Loading Method  | Typical Time | Memory Peak | Streaming Used |
| --------------- | ------------ | ----------- | -------------- |
| CDN URL         | 200-400ms    | ~5MB        | ✅ Yes         |
| Local File      | 100-200ms    | ~10MB       | ❌ No          |
| Embedded Binary | 150-250ms    | ~10MB       | ❌ No          |
| ArrayBuffer     | 300-500ms    | ~10MB       | ❌ No          |

_Times measured on modern hardware with fast internet connection_

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

This means you get streaming benefits automatically without any configuration
needed!
