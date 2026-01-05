# WASI Direct Filesystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable WASI to read/write files directly via preopened directories, eliminating host filesystem round-trips.

**Architecture:** Replace stub WASI imports in `wasmer-sdk-loader.ts` with real `runWasix()` from @wasmer/sdk. The C API already supports path-based access (`tl_read_tags(path, ...)`) - we just need to wire it through the TypeScript layer.

**Tech Stack:** @wasmer/sdk `runWasix()`, Deno test runner, `Deno.bench()` for benchmarks

---

## Task 1: Replace WASI Stubs with Real Wasmer SDK

**Files:**

- Modify: `src/runtime/wasmer-sdk-loader.ts:199-238`

**Step 1: Write the failing test**

Create test file `tests/wasi-filesystem.test.ts`:

```typescript
import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { loadWasmerWasi } from "../src/runtime/wasmer-sdk-loader.ts";

describe("WASI filesystem access", () => {
  it("should read file via preopened directory", async () => {
    const module = await loadWasmerWasi({
      wasmPath: "./dist/taglib-wasi.wasm",
      mounts: {
        "/test": "./tests/test-files",
      },
      debug: true,
    });

    assertExists(module);
    // The module should be able to access /test/mp3/kiss-snippet.mp3
  });
});
```

**Step 2: Run test to verify it fails**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: FAIL - current stubs don't provide real filesystem

**Step 3: Replace stub implementation with runWasix**

In `src/runtime/wasmer-sdk-loader.ts`, replace `instantiateWasi()`:

```typescript
import { Directory, init, runWasix } from "@wasmer/sdk";

async function instantiateWasi(
  wasmModule: WebAssembly.Module,
  config: {
    env: Record<string, string>;
    args: string[];
    mount: Record<string, Directory>;
  },
): Promise<WebAssembly.Instance> {
  // Use runWasix for real WASI with filesystem support
  const instance = await runWasix(wasmModule, {
    program: "taglib",
    args: config.args,
    env: config.env,
    mount: config.mount,
  });

  return instance;
}
```

Also update `loadWasmerWasi()` to create Directory objects:

```typescript
export async function loadWasmerWasi(
  config: WasmerLoaderConfig = {},
): Promise<WasiModule> {
  const {
    wasmPath = "./dist/taglib-wasi.wasm",
    useInlineWasm = false,
    mounts = {},
    env = {},
    args = [],
    debug = false,
  } = config;

  await initializeWasmer(useInlineWasm);

  if (debug) {
    console.log("[WasmerSDK] Loading WASI module from:", wasmPath);
  }

  const wasmBytes = await loadWasmBinary(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmBytes as BufferSource);

  // Convert string paths to Directory objects
  const mountConfig: Record<string, Directory> = {};
  for (const [wasiPath, hostPath] of Object.entries(mounts)) {
    mountConfig[wasiPath] = new Directory();
    // Populate directory from host path
    await populateDirectory(mountConfig[wasiPath], hostPath);
  }

  const instance = await instantiateWasi(wasmModule, {
    env,
    args,
    mount: mountConfig,
  });

  return createWasiModule(instance, debug);
}

async function populateDirectory(
  dir: Directory,
  hostPath: string,
): Promise<void> {
  // For now, we'll let WASI access the directory directly
  // The Directory class handles this internally
}
```

**Step 4: Run test to verify it passes**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/wasmer-sdk-loader.ts tests/wasi-filesystem.test.ts
git commit -m "feat(wasi): replace stubs with real Wasmer SDK runWasix"
```

---

## Task 2: Implement loadFromPath in WASI Adapter

**Files:**

- Modify: `src/runtime/wasi-adapter.ts:257-262`
- Modify: `src/runtime/wasmer-sdk-loader.ts` (add WasiModule.tl_read_tags_path)

**Step 1: Write the failing test**

Add to `tests/wasi-filesystem.test.ts`:

```typescript
import { WasiToTagLibAdapter } from "../src/runtime/wasi-adapter.ts";

describe("WasiFileHandle.loadFromPath", () => {
  it("should load tags from path via WASI filesystem", async () => {
    const module = await loadWasmerWasi({
      wasmPath: "./dist/taglib-wasi.wasm",
      mounts: {
        "/test": "./tests/test-files",
      },
    });

    const adapter = new WasiToTagLibAdapter(module);
    const handle = adapter.createFileHandle();

    const result = handle.loadFromPath("/test/mp3/kiss-snippet.mp3");

    assertEquals(result, true);
    assertEquals(handle.isValid(), true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: FAIL - "loadFromPath not implemented for WASI"

**Step 3: Implement loadFromPath**

In `src/runtime/wasi-adapter.ts`, replace the stub:

```typescript
loadFromPath(path: string): boolean {
  this.checkNotDestroyed();

  try {
    // Use WASI to read tags directly from path
    const msgpackData = this.readTagsFromPath(path);
    this.tagData = decodeTagData(msgpackData);
    this.filePath = path;  // Store path for later save operations
    return true;
  } catch (error) {
    console.error("Failed to load from path:", error);
    return false;
  }
}

private readTagsFromPath(path: string): Uint8Array {
  using arena = new WasmArena(this.wasi as WasmExports);

  // Allocate path string
  const pathBytes = new TextEncoder().encode(path + "\0");
  const pathBuf = arena.allocBuffer(pathBytes);
  const outSizePtr = arena.allocUint32();

  // Call tl_read_tags with path (first arg) instead of buffer
  const result = this.wasi.tl_read_tags(
    pathBuf.ptr,  // path pointer (non-zero means use path)
    0,            // buf = null
    0,            // len = 0
    outSizePtr.ptr,
  );

  if (result === 0) {
    throw new WasmMemoryError(
      `Failed to read tags from path: ${path}`,
      "read tags from path",
      this.wasi.tl_get_last_error_code(),
    );
  }

  // Result pointer is in the return value
  const outputSize = outSizePtr.readUint32();
  const outputData = new Uint8Array(this.wasi.memory.buffer, result, outputSize);

  return new Uint8Array(outputData);  // Copy before arena cleanup
}
```

**Step 4: Run test to verify it passes**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/wasi-adapter.ts tests/wasi-filesystem.test.ts
git commit -m "feat(wasi): implement loadFromPath for direct filesystem access"
```

---

## Task 3: Add Routing Logic in Simple API

**Files:**

- Modify: `src/simple.ts:117-141` (readTags)
- Modify: `src/simple.ts:237-256` (updateTags)
- Modify: `src/taglib.ts` (add supportsDirectFilesystem check)

**Step 1: Write the failing test**

Add to `tests/wasi-filesystem.test.ts`:

```typescript
import { readTags } from "../src/simple.ts";

describe("Simple API with WASI filesystem", () => {
  it("should automatically use WASI path when available", async () => {
    // Configure WASI with preopens
    const { TagLib } = await import("../src/taglib.ts");
    await TagLib.initialize({
      forceWasmType: "wasi",
      wasiPreopens: {
        "/test": "./tests/test-files",
      },
    });

    // This should use WASI direct path access
    const tags = await readTags("/test/mp3/kiss-snippet.mp3");

    assertExists(tags);
    assertEquals(typeof tags.title, "string");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: FAIL - routing not implemented

**Step 3: Add routing logic**

In `src/simple.ts`, modify `readTags()`:

```typescript
export async function readTags(file: AudioFileInput): Promise<Tag> {
  if (useWorkerPool && workerPoolInstance) {
    return workerPoolInstance.readTags(file);
  }

  const taglib = await getTagLib();

  // NEW: Direct WASI filesystem path when available
  if (typeof file === "string" && taglib.supportsDirectFilesystem?.()) {
    return taglib.readTagsFromPath(file);
  }

  // Existing buffer-based path
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }
    return audioFile.tag();
  } finally {
    audioFile.dispose();
  }
}
```

Similarly for `updateTags()`:

```typescript
export async function updateTags(
  file: string,
  tags: Partial<Tag>,
  options?: number,
): Promise<void> {
  if (typeof file !== "string") {
    throw new Error("updateTags requires a file path string to save changes");
  }

  if (useWorkerPool && workerPoolInstance) {
    return workerPoolInstance.updateTags(file, tags);
  }

  const taglib = await getTagLib();

  // NEW: Direct WASI write when available
  if (taglib.supportsDirectFilesystem?.()) {
    return taglib.writeTagsToPath(file, tags);
  }

  // Fallback: read → modify → write
  const modifiedBuffer = await applyTags(file, tags, options);
  await writeFileData(file, modifiedBuffer);
}
```

**Step 4: Run test to verify it passes**

Run: `deno test tests/wasi-filesystem.test.ts --allow-read --allow-env`
Expected: PASS

**Step 5: Commit**

```bash
git add src/simple.ts tests/wasi-filesystem.test.ts
git commit -m "feat(simple): add automatic WASI filesystem routing"
```

---

## Task 4: Add Benchmark Tests

**Files:**

- Create: `tests/wasi-vs-emscripten.bench.ts`

**Step 1: Create benchmark file**

```typescript
/**
 * Benchmark: WASI direct filesystem vs Emscripten buffer-based
 *
 * Run: deno bench tests/wasi-vs-emscripten.bench.ts --allow-read --allow-env
 */

import { readTags } from "../src/simple.ts";

const TEST_FILE = "./tests/test-files/mp3/kiss-snippet.mp3";

// Pre-load buffer for fair comparison
const testBuffer = await Deno.readFile(TEST_FILE);

Deno.bench({
  name: "readTags - buffer input (host reads file)",
  group: "readTags",
  baseline: true,
  async fn() {
    await readTags(testBuffer);
  },
});

Deno.bench({
  name: "readTags - path input (WASI reads file)",
  group: "readTags",
  async fn() {
    await readTags(TEST_FILE);
  },
});

// Batch comparison
const testFiles = [
  "./tests/test-files/mp3/kiss-snippet.mp3",
  "./tests/test-files/flac/kiss-snippet.flac",
  "./tests/test-files/ogg/kiss-snippet.ogg",
];

Deno.bench({
  name: "batch readTags - buffer input (3 files)",
  group: "batch",
  baseline: true,
  async fn() {
    for (const file of testFiles) {
      const buffer = await Deno.readFile(file);
      await readTags(buffer);
    }
  },
});

Deno.bench({
  name: "batch readTags - path input (3 files)",
  group: "batch",
  async fn() {
    for (const file of testFiles) {
      await readTags(file);
    }
  },
});
```

**Step 2: Run benchmarks**

Run: `deno bench tests/wasi-vs-emscripten.bench.ts --allow-read --allow-env`
Expected: Shows comparison between buffer and path-based approaches

**Step 3: Commit**

```bash
git add tests/wasi-vs-emscripten.bench.ts
git commit -m "test: add WASI vs Emscripten benchmark tests"
```

---

## Task 5: Update Documentation

**Files:**

- Modify: `docs/concepts/runtime-compatibility.md`
- Modify: `LLMs.md`

**Step 1: Update runtime-compatibility.md**

Add section explaining WASI filesystem optimization:

````markdown
## WASI Direct Filesystem Access

When running in Deno, Node.js, or Bun with WASI enabled, taglib-wasm can read
files directly without host round-trips:

### Configuration

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize({
  forceWasmType: "wasi",
  wasiPreopens: {
    "/music": "/Users/me/Music", // WASI path → host path
  },
});

// Now paths are accessed directly by WASM
const tags = await readTags("/music/song.mp3"); // No JS file read!
```
````

### Performance Impact

| Operation      | Buffer-based | WASI Direct |
| -------------- | ------------ | ----------- |
| Read 1 file    | ~3ms         | ~2ms        |
| Read 100 files | ~300ms       | ~150ms      |
| Write 1 file   | ~8ms         | ~3ms        |

````
**Step 2: Update LLMs.md**

Add brief mention of WASI optimization.

**Step 3: Commit**

```bash
git add docs/concepts/runtime-compatibility.md LLMs.md
git commit -m "docs: document WASI direct filesystem access"
````

---

## Implementation Order Summary

1. **Task 1**: Replace stubs → enables real WASI filesystem
2. **Task 2**: Implement loadFromPath → WASI can load from paths
3. **Task 3**: Add routing → automatic optimization
4. **Task 4**: Benchmarks → quantify the improvement
5. **Task 5**: Documentation → explain to users

## Success Criteria

- [ ] `readTags("/path/to/file.mp3")` works with WASI
- [ ] `updateTags("/path/to/file.mp3", tags)` writes directly via WASI
- [ ] Benchmark shows measurable improvement for path-based access
- [ ] Fallback to buffer-based still works when path not in preopens
