# WASI Direct Filesystem Access Design

**Date:** 2026-01-05
**Status:** Approved
**Goal:** Enable WASI to read/write files directly, eliminating host filesystem round-trips

## Problem Statement

Current architecture requires the host (JavaScript) to read files and pass buffers to WASM:

```
Host reads file → Uint8Array → WASM processes → Result
```

This negates WASI's core advantage: direct filesystem access. The WASI runtime currently uses stub implementations that don't perform real I/O.

## Solution: Transparent Optimization

Keep the unified `readTags(input)` API unchanged. Internally optimize based on input type and runtime capabilities.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript API Layer                      │
│  readTags(input) → detects type + runtime → routes call     │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────────┐
│   Buffer Path       │       │      WASI Path              │
│   (Current)         │       │      (New)                  │
├─────────────────────┤       ├─────────────────────────────┤
│ • Host reads file   │       │ • WASM reads file directly  │
│ • Pass buffer→WASM  │       │ • Preopened directories     │
│ • Works everywhere  │       │ • Deno/Node/Bun only        │
└─────────────────────┘       └─────────────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    C/C++ TagLib Core                         │
│  tl_read_tags(buf, len)  |  tl_read_tags_path(path)         │
└─────────────────────────────────────────────────────────────┘
```

### Routing Logic

```typescript
if (typeof input === "string" && runtime.supportsWasiFilesystem) {
  return wasiModule.readTagsFromPath(input);
} else {
  const buffer = await readFileData(input);
  return emscriptenModule.readTagsFromBuffer(buffer);
}
```

## Implementation Layers

### Layer 1: C API Extensions

New path-based functions alongside existing buffer-based ones:

```c
// Existing buffer-based API
int tl_read_tags(const uint8_t* buf, size_t len, uint8_t** out, size_t* out_size);
int tl_write_tags(const uint8_t* buf, size_t len, const uint8_t* tags,
                  size_t tags_size, uint8_t** out, size_t* out_size);

// New path-based API
int tl_read_tags_path(const char* path, uint8_t** out, size_t* out_size);
int tl_write_tags_path(const char* path, const uint8_t* tags, size_t tags_size);
```

**Implementation uses TagLib's native file handling:**

```cpp
int tl_read_tags_path(const char* path, uint8_t** out, size_t* out_size) {
    TagLib::FileRef file(path);  // TagLib opens via WASI syscalls
    if (file.isNull()) {
        tl_set_error(TL_ERROR_FILE_NOT_FOUND, "Cannot open file");
        return -1;
    }
    // Pack tags to MessagePack (same as buffer version)
}
```

| Aspect         | Buffer API                   | Path API                     |
| -------------- | ---------------------------- | ---------------------------- |
| Input          | `ByteVectorStream`           | `TagLib::FileRef(path)`      |
| File I/O       | None (already in memory)     | WASI `fd_open`, `fd_read`    |
| Write behavior | Returns modified buffer      | Writes directly to file      |
| Use case       | Browsers, pre-loaded buffers | Server-side batch processing |

### Layer 2: WASI Runtime - Real Filesystem

Replace stub implementations with Wasmer SDK's built-in WASI support:

```typescript
import { Wasix } from "@wasmer/sdk";

export async function loadWasmerWasi(
  config: WasmerLoaderConfig,
): Promise<WasiModule> {
  const wasmBytes = await loadWasmBinary(config.wasmPath);

  const wasi = new Wasix({
    args: config.args ?? [],
    env: config.env ?? {},
    preopens: {
      "/": config.rootDir ?? "/",
      "/music": config.musicDir,
    },
  });

  const instance = await wasi.instantiate(wasmBytes);
  return createWasiModule(instance);
}
```

**Preopened directories:**

| WASI Path         | Host Path                       | Purpose          |
| ----------------- | ------------------------------- | ---------------- |
| `/music/song.mp3` | `/Users/charles/Music/song.mp3` | Sandboxed access |
| `/tmp`            | System temp dir                 | Scratch space    |

**Security model:** WASI can only access preopened paths - cannot escape sandbox.

**User configuration:**

```typescript
const taglib = await TagLib.initialize({
  wasiPreopens: { "/": "/" }  // Full filesystem (Electron)
  // OR
  wasiPreopens: { "/music": "/Users/me/Music" }  // Restricted (safer)
});
```

### Layer 3: TypeScript Unified API

Enhanced routing in existing `simple.ts` functions:

```typescript
export async function readTags(file: AudioFileInput): Promise<Tag> {
  if (useWorkerPool && workerPoolInstance) {
    return workerPoolInstance.readTags(file);
  }

  const taglib = await getTagLib();

  // Path-based WASI optimization
  if (typeof file === "string" && taglib.supportsDirectFilesystem()) {
    return taglib.readTagsFromPath(file);
  }

  // Existing buffer-based path
  const audioFile = await taglib.open(file);
  try {
    return audioFile.tag();
  } finally {
    audioFile.dispose();
  }
}
```

**Write operations get the biggest improvement:**

```typescript
// Current: 3 steps (host read → WASM modify → host write)
// New with WASI: 1 step (WASM does everything)

export async function updateTags(
  path: string,
  tags: Partial<Tag>,
): Promise<void> {
  const taglib = await getTagLib();

  if (typeof path === "string" && taglib.supportsDirectFilesystem()) {
    return taglib.writeTagsToPath(path, tags);
  }

  // Fallback to current behavior
  const buffer = await readFileData(path);
  const modified = await applyTags(buffer, tags);
  await writeFileData(path, modified);
}
```

## Error Handling

New error type for WASI filesystem operations:

```typescript
export class WasiFilesystemError extends TagLibError {
  readonly code = "WASI_FILESYSTEM_ERROR" as const;
  constructor(
    public readonly path: string,
    public readonly operation: "open" | "read" | "write",
    message: string,
    cause?: unknown,
  ) {
    super(`${operation} failed for ${path}: ${message}`, { cause });
  }
}
```

**WASI error code mapping:**

| WASI Error | User-Facing Message                                  |
| ---------- | ---------------------------------------------------- |
| `ENOENT`   | File not found: `/path/to/file.mp3`                  |
| `EACCES`   | Permission denied: Path not in preopened directories |
| `ENOTDIR`  | Invalid path: Parent is not a directory              |

## Testing Strategy

### Unit Tests

```typescript
describe("WASI direct filesystem", () => {
  it("reads tags from path when WASI available", async () => {
    const taglib = await TagLib.initialize({
      wasiPreopens: { "/test": "./tests/test-files" },
    });

    const tags = await readTags("/test/mp3/kiss-snippet.mp3");
    assertEquals(tags.title, "Expected Title");
  });

  it("falls back to buffer when path outside preopens", async () => {
    const tags = await readTags("/outside/preopens/song.mp3");
  });

  it("writes tags directly via WASI", async () => {
    await withTempFile("test.mp3", testBuffer, async (path) => {
      await updateTags(path, { title: "New Title" });
      const tags = await readTags(path);
      assertEquals(tags.title, "New Title");
    });
  });
});
```

### Benchmark Tests

```typescript
Deno.bench("readTags - buffer path (Emscripten)", async () => {
  const buffer = await Deno.readFile(TEST_FILE);
  await readTags(buffer);
});

Deno.bench("readTags - direct path (WASI)", async () => {
  await readTags(TEST_FILE);
});
```

## Expected Performance Impact

| Operation  | Current (1000 files) | With WASI Direct |
| ---------- | -------------------- | ---------------- |
| Read tags  | ~3s                  | ~1.5s (est.)     |
| Write tags | ~8s                  | ~3s (est.)       |

Write operations see larger improvement due to eliminating two host filesystem round-trips per file.

## DX Benefits

1. **Zero code changes** for existing users
2. **Automatic optimization** - Electron/Deno/Node get WASI speed, browsers work as before
3. **No cognitive load** - developers don't need to learn two APIs
4. **Matches Sharp's pattern** - proven at scale

## Implementation Phases

1. **Phase 1:** Add C API path-based functions
2. **Phase 2:** Replace WASI stubs with real Wasmer SDK filesystem
3. **Phase 3:** Add TypeScript routing logic
4. **Phase 4:** Benchmark tests and documentation
