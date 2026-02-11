# Using taglib-wasm with Deno Compile

This comprehensive guide explains how to use taglib-wasm in compiled Deno
binaries, with multiple approaches for different use cases.

## Overview

taglib-wasm provides built-in support for Deno compiled binaries through two
helper functions:

- `initializeForDenoCompile()` - Automatic initialization with offline support
- `prepareWasmForEmbedding()` - Copies WASM file for embedding

## Method 1: Simple CDN Loading (Recommended)

The simplest approach that leverages WebAssembly streaming compilation:

```typescript
import { TagLib } from "@charlesw/taglib-wasm";

// Works in both development and compiled binaries
const taglib = await TagLib.initialize({
  wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
});

// Use the library
using file = await taglib.open("audio.mp3");
console.log(file.tag().title);
```

**Compile command:**

```bash
deno compile --allow-read --allow-net myapp.ts
```

**Pros:**

- ✅ Simple implementation
- ✅ Uses WebAssembly streaming compilation for optimal performance
- ✅ Always gets latest WASM optimizations
- ✅ Small binary size

**Cons:**

- ❌ Requires internet connection on first run

## Method 2: Automatic Offline Support

Use the built-in helper functions for seamless offline support:

```typescript
import { initializeForDenoCompile } from "@charlesw/taglib-wasm";
import { readTags } from "@charlesw/taglib-wasm/simple";

async function main() {
  // Automatically handles offline/online scenarios
  const taglib = await initializeForDenoCompile();

  // Process files
  for (const filePath of Deno.args) {
    const tags = await readTags(filePath);
    console.log(`${filePath}:`, tags);
  }
}

if (import.meta.main) {
  await main();
}
```

### Build Process

**Step 1: Prepare WASM file (run once during build)**

```typescript
// prepare-offline.ts
import { prepareWasmForEmbedding } from "@charlesw/taglib-wasm";

await prepareWasmForEmbedding("./taglib.wasm");
```

```bash
deno run --allow-read --allow-write prepare-offline.ts
```

**Step 2: Compile with embedded WASM**

```bash
deno compile --allow-read --include taglib.wasm myapp.ts
```

**Step 3: Run offline**

```bash
./myapp audio.mp3
```

### How It Works

The `initializeForDenoCompile()` function:

1. Detects if running as compiled binary using `Deno.mainModule`
2. Attempts to load embedded WASM from `./taglib.wasm`
3. Falls back to network fetch if not found (for development)

## Method 3: Manual Control (Advanced)

For full control over the loading strategy:

```typescript
import { TagLib } from "@charlesw/taglib-wasm";

async function initializeTagLib(): Promise<TagLib> {
  // Detect if running as compiled binary
  const isCompiled = Deno.mainModule.includes("deno-compile://");

  if (isCompiled) {
    try {
      // Try to load embedded WASM
      const wasmPath = new URL("./taglib.wasm", import.meta.url);
      const wasmBinary = await Deno.readFile(wasmPath);
      return await TagLib.initialize({ wasmBinary });
    } catch (error) {
      console.warn("Embedded WASM not found, falling back to CDN");
    }
  }

  // Development or fallback
  return await TagLib.initialize({
    wasmUrl: "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm",
  });
}

// Usage
const taglib = await initializeTagLib();
```

## Complete Production Example

Here's a production-ready implementation with error handling:

```typescript
#!/usr/bin/env -S deno run --allow-read --allow-net

import { initializeForDenoCompile } from "@charlesw/taglib-wasm";
import { readTags, updateTags } from "@charlesw/taglib-wasm/simple";

async function processAudioFile(filePath: string) {
  try {
    // Read existing tags
    const tags = await readTags(filePath);
    console.log(`\n📄 File: ${filePath}`);
    console.log(`  Title: ${tags.title || "(none)"}`);
    console.log(`  Artist: ${tags.artist || "(none)"}`);
    console.log(`  Album: ${tags.album || "(none)"}`);

    // Modify tags if needed
    if (!tags.comment?.includes("Processed")) {
      await updateTags(filePath, {
        ...tags,
        comment: `${tags.comment || ""} - Processed by taglib-wasm`,
      });
      console.log("  ✅ Updated comment tag");
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

async function main() {
  if (Deno.args.length === 0) {
    console.log("Usage: audio-processor <files...>");
    console.log("Example: audio-processor *.mp3");
    Deno.exit(1);
  }

  console.log("🎵 Audio Metadata Processor");
  console.log("Initializing taglib-wasm...");

  try {
    // Initialize with automatic offline support
    const taglib = await initializeForDenoCompile();
    console.log("✅ Ready to process files\n");

    // Process all files
    for (const filePath of Deno.args) {
      await processAudioFile(filePath);
    }

    console.log("\n✅ All files processed!");
  } catch (error) {
    console.error("Fatal error:", error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
```

## Key Implementation Details

### 1. Detection of Compiled Binaries

```typescript
const isCompiled = Deno.mainModule.includes("deno-compile://");
```

### 2. Embedding WASM Files

Use the `--include` flag when compiling:

```bash
deno compile --allow-read --include taglib.wasm myapp.ts
```

### 3. Path Resolution

Use URL constructor for relative paths:

```typescript
const wasmPath = new URL("./taglib.wasm", import.meta.url);
```

### 4. Environment Configuration

Support runtime configuration:

```typescript
const WASM_URL = Deno.env.get("TAGLIB_WASM_URL") ||
  "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm";
```

## Comparison Table

| Method         | Offline Support | Binary Size | Implementation Complexity | Best For                   |
| -------------- | --------------- | ----------- | ------------------------- | -------------------------- |
| CDN Loading    | ❌              | Small       | Simple                    | Online tools, web services |
| Auto Embedding | ✅              | +500KB      | Medium                    | CLI tools, offline apps    |
| Manual Control | ✅              | +500KB      | Complex                   | Custom requirements        |

## Best Practices

1. **Use TypeScript**: Leverage type safety for better development experience
2. **Handle Errors**: Always wrap initialization in try-catch blocks
3. **Provide Feedback**: Show loading status to users
4. **Test Both Modes**: Ensure your app works in both development and compiled
   modes
5. **Document Dependencies**: Make it clear if your tool requires internet
   access

## Common Issues and Solutions

### Issue: "Module not found" in compiled binary

**Solution**: Ensure you used `--include taglib.wasm` when compiling

### Issue: Large binary size

**Solution**: Use CDN loading if offline support isn't required

### Issue: Slow initialization

**Solution**: Use CDN with streaming compilation for faster startup

### Issue: Network errors

**Solution**: Implement retry logic or provide offline fallback

## Example Projects

Complete working examples are available in the repository:

- `examples/deno-compile/simple-app.ts` - CDN loading example
- `examples/deno-compile/app.ts` - Advanced embedding example
- `examples/deno/offline-compile.ts` - Using helper functions

## Tips for Production

- **Cache WASM locally**: For frequently used tools, cache the WASM file locally
- **Use your own CDN**: Host the WASM file on your infrastructure for
  reliability
- **Version pinning**: Use specific versions instead of `@latest` for stability
- **Progress indicators**: Show download progress when fetching from CDN
- **Graceful degradation**: Provide meaningful error messages when
  initialization fails
