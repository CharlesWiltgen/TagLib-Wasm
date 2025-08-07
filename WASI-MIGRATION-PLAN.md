# TagLib-WASM Clean-Slate WASI Architecture Plan

## Executive Summary

This document outlines a **clean-slate** phased approach to implement dual-build (Emscripten + WASI) architecture for taglib-wasm. By assuming **zero existing consumers**, we can drop all migration/compatibility steps and build an optimal architecture from scratch. Initial focus is on **Deno with @wasmer/wasi for near-native filesystem performance**.

## Architecture Goals

- **Single C API:** One minimal C facade for both WASI and Emscripten
- **No Embind:** Remove complexity, use simple C ABI + JSON
- **Dual Build:** Separate optimized builds for browser and server/CLI
- **KISS Principle:** Minimal surface area, maximum simplicity
- **Deno Priority:** Initial optimization for Deno + @wasmer/wasi filesystem performance

---

## Phase 0: Research & Validation

**Duration:** 1 week\
**Risk:** Low\
**Dependencies:** None

### Tasks

- [ ] Validate WASI SDK installation and setup
- [ ] Test @wasmer/wasi performance in Deno with large files
- [ ] Verify TagLib compilation with both emcc and wasi-sdk
- [ ] Benchmark JSON serialization overhead vs Embind
- [ ] Test filesystem operations: native Deno vs @wasmer/wasi vs Emscripten VFS

**Deliverables:**

- WASI SDK setup documentation
- Performance baseline measurements
- Go/no-go decision on architecture

---

## Phase 1: Project Setup & CI

**Duration:** 3 days\
**Risk:** Low\
**Dependencies:** Phase 0

### Tasks

- [ ] Create new project structure (remove old build system)
- [ ] Set up dual-build CI pipeline (GitHub Actions)
- [ ] Configure build matrix for testing
- [ ] Set up artifact storage for WASM binaries
- [ ] Create development environment setup script

**Deliverables:**

- Clean project structure
- Working CI/CD pipeline
- Developer setup documentation

---

## Phase 2: Minimal C Facade & TagLib Build

**Duration:** 1 week\
**Risk:** Low\
**Dependencies:** Phase 1

> **Goal:** Remove Embind entirely and expose a single, flat C ABI that works for both WASI and Emscripten builds.

### 2.1 Create C API Header

```c
// src/capi/taglib_api.h
#ifdef __cplusplus
extern "C" {
#endif
  // If `path` is non-NULL use the host FS; otherwise read from buffer.
  // Returns malloc'd UTF-8 JSON; caller frees with tl_free().
  char *tl_read_tags(const char *path,
                     const uint8_t *buf, size_t len);
  
  // Write tags (returns 0 on success, -1 on error)
  int tl_write_tags(const char *path,
                    const uint8_t *buf, size_t len,
                    const char *json_tags);
  
  // Memory management
  void tl_free(char *p);
  
  // Version info
  const char *tl_version(void);
  
#ifdef __cplusplus
}
#endif
```

### 2.2 Implement C++ Backend

```cpp
// src/capi/taglib_api.cpp
#include "taglib_api.h"
#include <taglib/fileref.h>
#include <taglib/tiostream.h>
#include <nlohmann/json.hpp>

extern "C" {

char *tl_read_tags(const char *path, const uint8_t *buf, size_t len) {
    TagLib::FileRef file;
    
    if (path) {
        // Direct filesystem access (WASI optimized path)
        file = TagLib::FileRef(path);
    } else if (buf && len > 0) {
        // Memory buffer access
        TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
        auto stream = new TagLib::ByteVectorStream(data);
        file = TagLib::FileRef(stream);
    }
    
    if (file.isNull() || !file.tag()) {
        return nullptr;
    }
    
    // Serialize to JSON
    nlohmann::json j;
    j["title"] = file.tag()->title().toCString(true);
    j["artist"] = file.tag()->artist().toCString(true);
    j["album"] = file.tag()->album().toCString(true);
    j["year"] = file.tag()->year();
    j["track"] = file.tag()->track();
    j["genre"] = file.tag()->genre().toCString(true);
    
    if (file.audioProperties()) {
        j["bitrate"] = file.audioProperties()->bitrate();
        j["sampleRate"] = file.audioProperties()->sampleRate();
        j["length"] = file.audioProperties()->length();
    }
    
    std::string json_str = j.dump();
    char *result = (char*)malloc(json_str.length() + 1);
    strcpy(result, json_str.c_str());
    return result;
}

void tl_free(char *p) {
    free(p);
}

} // extern "C"
```

### 2.3 CMake Configuration

```cmake
# cmake/common.cmake
set(CMAKE_CXX_STANDARD 17)
set(BUILD_SHARED_LIBS OFF)
set(ENABLE_STATIC ON)
set(WITH_MP4 ON)
set(WITH_ASF ON)
set(BUILD_EXAMPLES OFF)
set(BUILD_TESTS OFF)
set(BUILD_BINDINGS OFF)

# Add nlohmann/json
FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)
```

**Deliverables:**

- Complete C API implementation
- Working TagLib build with both toolchains
- JSON serialization tested

---

## Phase 3: Dual Build Scripts

**Duration:** 1 week\
**Risk:** Low\
**Dependencies:** Phase 2

### 3.1 Build Output Structure

| Build          | Toolchain  | Script                      | Output                                     |
| -------------- | ---------- | --------------------------- | ------------------------------------------ |
| **Browser**    | `emcc`     | `build/build-emscripten.sh` | `dist/browser/taglib_emscripten.{js,wasm}` |
| **Server/CLI** | `wasi-sdk` | `build/build-wasi.sh`       | `dist/wasi/taglib_wasi.wasm`               |

### 3.2 Emscripten Build Script

```bash
#!/bin/bash
# build/build-emscripten.sh

# Configure with Emscripten
emcmake cmake -B build-emscripten \
  -DCMAKE_BUILD_TYPE=Release \
  -C cmake/common.cmake

# Build TagLib
emmake make -C build-emscripten -j$(nproc)

# Link final WASM module
emcc -o dist/browser/taglib_emscripten.js \
  src/capi/taglib_api.cpp \
  build-emscripten/libtag.a \
  -I lib/taglib/taglib \
  -lnlohmann_json \
  -sEXPORT_ES6=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME="createTagLibModule" \
  -sENVIRONMENT='web,worker,node' \
  -sEXPORTED_FUNCTIONS='["_tl_read_tags","_tl_write_tags","_tl_free","_tl_version"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","allocate","ALLOC_NORMAL"]' \
  -sALLOW_MEMORY_GROWTH=1 \
  -O3
```

### 3.3 WASI Build Script

```bash
#!/bin/bash
# build/build-wasi.sh

# Configure with WASI SDK
cmake -B build-wasi \
  -DCMAKE_TOOLCHAIN_FILE=$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake \
  -DCMAKE_BUILD_TYPE=Release \
  -C cmake/common.cmake

# Build TagLib
make -C build-wasi -j$(nproc)

# Link final WASM module
$WASI_SDK_PATH/bin/clang++ -o dist/wasi/taglib_wasi.wasm \
  src/capi/taglib_api.cpp \
  build-wasi/libtag.a \
  -I lib/taglib/taglib \
  -lnlohmann_json \
  --target=wasm32-wasi \
  -Wl,--export=tl_read_tags \
  -Wl,--export=tl_write_tags \
  -Wl,--export=tl_free \
  -Wl,--export=tl_version \
  -Oz

# Optimize and strip
wasm-opt -Oz dist/wasi/taglib_wasi.wasm -o dist/wasi/taglib_wasi.wasm
wasm-strip dist/wasi/taglib_wasi.wasm
```

### 3.4 CI Integration

```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Emscripten
        uses: mymindstorm/setup-emsdk@v12

      - name: Setup WASI SDK
        run: |
          wget https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-20/wasi-sdk-20.0-linux.tar.gz
          tar xf wasi-sdk-20.0-linux.tar.gz
          echo "WASI_SDK_PATH=$PWD/wasi-sdk-20.0" >> $GITHUB_ENV

      - name: Build Emscripten
        run: ./build/build-emscripten.sh

      - name: Build WASI
        run: ./build/build-wasi.sh

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: wasm-builds
          path: dist/
```

**Deliverables:**

- Working build scripts for both toolchains
- CI/CD pipeline producing artifacts
- Optimized WASM binaries (~300KB for WASI)

---

## Phase 4: TypeScript Runtime Loader & Unified API

**Duration:** 1 week\
**Risk:** Medium\
**Dependencies:** Phase 3

### 4.1 Runtime Detection & Loader

```typescript
// src/loader.ts
import { init as initWasmer, WASI } from "@wasmer/wasi";

export type WasmExports = {
  tl_read_tags: (path: number, buf: number, len: number) => number;
  tl_write_tags: (
    path: number,
    buf: number,
    len: number,
    json: number,
  ) => number;
  tl_free: (ptr: number) => void;
  tl_version: () => number;
  memory: WebAssembly.Memory;
};

async function loadWASI(): Promise<WasmExports> {
  // Deno with @wasmer/wasi
  if (typeof Deno !== "undefined") {
    await initWasmer();

    const wasi = new WASI({
      env: {},
      args: [],
      preopens: {
        "/": Deno.cwd(), // Direct filesystem access
      },
    });

    const wasmBytes = await Deno.readFile("./dist/wasi/taglib_wasi.wasm");
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    wasi.start(instance);
    return instance.exports as WasmExports;
  }

  // Future: Node.js with node:wasi
  // Future: Cloudflare Workers

  throw new Error("WASI not supported in this environment");
}

async function loadEmscripten(): Promise<WasmExports> {
  const createModule = await import("./dist/browser/taglib_emscripten.js");
  const module = await createModule.default();

  return {
    tl_read_tags: module.cwrap("tl_read_tags", "number", [
      "number",
      "number",
      "number",
    ]),
    tl_write_tags: module.cwrap("tl_write_tags", "number", [
      "number",
      "number",
      "number",
      "number",
    ]),
    tl_free: module.cwrap("tl_free", null, ["number"]),
    tl_version: module.cwrap("tl_version", "number", []),
    memory: module.HEAP8.buffer,
  };
}

export async function instantiate(): Promise<WasmExports> {
  // Browser or worker environment
  if (
    typeof window !== "undefined" || typeof WorkerGlobalScope !== "undefined"
  ) {
    return loadEmscripten();
  }

  // Try WASI first (Deno priority)
  try {
    return await loadWASI();
  } catch {
    // Fallback to Emscripten
    return loadEmscripten();
  }
}
```

### 4.2 Public API

```typescript
// src/index.ts
import { instantiate, type WasmExports } from "./loader";
import type { TagRecord } from "./types";

let _lib: WasmExports | undefined;

function stringToPtr(lib: WasmExports, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const ptr = lib.malloc(bytes.length + 1);
  const heap = new Uint8Array(lib.memory.buffer);
  heap.set(bytes, ptr);
  heap[ptr + bytes.length] = 0; // null terminator
  return ptr;
}

function ptrToString(lib: WasmExports, ptr: number): string {
  if (!ptr) return "";
  const heap = new Uint8Array(lib.memory.buffer);
  let len = 0;
  while (heap[ptr + len] !== 0) len++;
  const decoder = new TextDecoder();
  return decoder.decode(heap.subarray(ptr, ptr + len));
}

export async function readTags(
  source: string | Uint8Array | File,
): Promise<TagRecord> {
  _lib ??= await instantiate();

  let jsonPtr: number;

  if (typeof source === "string") {
    // File path (optimized for WASI)
    const pathPtr = stringToPtr(_lib, source);
    jsonPtr = _lib.tl_read_tags(pathPtr, 0, 0);
    _lib.tl_free(pathPtr);
  } else {
    // Buffer or File
    const buffer = source instanceof File
      ? new Uint8Array(await source.arrayBuffer())
      : source;

    const bufPtr = _lib.malloc(buffer.length);
    const heap = new Uint8Array(_lib.memory.buffer);
    heap.set(buffer, bufPtr);

    jsonPtr = _lib.tl_read_tags(0, bufPtr, buffer.length);
    _lib.tl_free(bufPtr);
  }

  if (!jsonPtr) {
    throw new Error("Failed to read tags");
  }

  const jsonStr = ptrToString(_lib, jsonPtr);
  _lib.tl_free(jsonPtr);

  return JSON.parse(jsonStr);
}

export async function writeTags(
  source: string | Uint8Array,
  tags: TagRecord,
): Promise<void> {
  _lib ??= await instantiate();

  const jsonStr = JSON.stringify(tags);
  const jsonPtr = stringToPtr(_lib, jsonStr);

  let result: number;

  if (typeof source === "string") {
    const pathPtr = stringToPtr(_lib, source);
    result = _lib.tl_write_tags(pathPtr, 0, 0, jsonPtr);
    _lib.tl_free(pathPtr);
  } else {
    const bufPtr = _lib.malloc(source.length);
    const heap = new Uint8Array(_lib.memory.buffer);
    heap.set(source, bufPtr);

    result = _lib.tl_write_tags(0, bufPtr, source.length, jsonPtr);
    _lib.tl_free(bufPtr);
  }

  _lib.tl_free(jsonPtr);

  if (result !== 0) {
    throw new Error("Failed to write tags");
  }
}
```

### 4.3 Type Definitions

```typescript
// src/types.ts
export interface TagRecord {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
  comment?: string;
  albumArtist?: string;
  composer?: string;
  disc?: number;
  bitrate?: number;
  sampleRate?: number;
  length?: number; // in seconds
  picture?: {
    mime: string;
    type: string;
    description: string;
    data: Uint8Array;
  };
}

export type AudioFileInput = string | Uint8Array | File;
```

**Deliverables:**

- Complete TypeScript loader with runtime detection
- Public API matching existing interface
- Type definitions for all tag fields

---

## Phase 5: Testing Across Runtimes

**Duration:** 1 week\
**Risk:** Low\
**Dependencies:** Phase 4

### 5.1 Test Structure

```
test/
  fixtures/
    sample.mp3
    sample.flac
    sample.m4a
  unit/
    taglib.test.ts    # Core functionality
  integration/
    node.test.ts      # Node.js specific
    deno.test.ts      # Deno specific
    browser.test.ts   # Browser specific
  performance/
    benchmark.ts      # Performance tests
```

### 5.2 Unit Tests

```typescript
// test/unit/taglib.test.ts
import { describe, expect, it } from "vitest";
import { readTags, writeTags } from "../../src/index";
import { readFile } from "fs/promises";

describe("TagLib Core", () => {
  it("reads tags from file path (WASI optimized)", async () => {
    const tags = await readTags("./test/fixtures/sample.mp3");
    expect(tags.title).toBe("Test Title");
    expect(tags.artist).toBe("Test Artist");
  });

  it("reads tags from buffer", async () => {
    const buffer = await readFile("./test/fixtures/sample.mp3");
    const tags = await readTags(new Uint8Array(buffer));
    expect(tags.title).toBe("Test Title");
  });

  it("handles large files efficiently", async () => {
    const start = performance.now();
    const tags = await readTags("./test/fixtures/large-file.flac");
    const elapsed = performance.now() - start;

    expect(tags).toBeDefined();
    expect(elapsed).toBeLessThan(100); // Should be fast with WASI
  });
});
```

### 5.3 Deno-Specific Tests

```typescript
// test/integration/deno.test.ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { readTags } from "../../src/index.ts";

Deno.test("Direct filesystem access via WASI", async () => {
  const tags = await readTags("./test/fixtures/sample.mp3");
  assertEquals(tags.title, "Test Title");
});

Deno.test("Performance: WASI vs Buffer", async () => {
  // Test file path (WASI optimized)
  const wasiStart = performance.now();
  await readTags("./test/fixtures/large-file.flac");
  const wasiTime = performance.now() - wasiStart;

  // Test buffer (fallback path)
  const buffer = await Deno.readFile("./test/fixtures/large-file.flac");
  const bufferStart = performance.now();
  await readTags(buffer);
  const bufferTime = performance.now() - bufferStart;

  console.log(`WASI: ${wasiTime}ms, Buffer: ${bufferTime}ms`);
  // WASI should be significantly faster for large files
});
```

### 5.4 Browser Tests (Playwright)

```typescript
// test/integration/browser.test.ts
import { expect, test } from "@playwright/test";

test("reads tags from File object", async ({ page }) => {
  await page.goto("/test.html");

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("./test/fixtures/sample.mp3");

  // Wait for processing
  const result = await page.locator("#result").textContent();
  const tags = JSON.parse(result);

  expect(tags.title).toBe("Test Title");
  expect(tags.artist).toBe("Test Artist");
});
```

### 5.5 CI Test Matrix

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test-deno:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - run: deno task test

  test-node:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 21]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      - run: npm test

  test-browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx playwright test
```

**Deliverables:**

- Comprehensive test suite
- Performance benchmarks
- CI passing on all platforms

---

## Phase 6: Packaging & Distribution

**Duration:** 3 days\
**Risk:** Low\
**Dependencies:** Phase 5

### 6.1 Package Structure

```
dist/
  browser/
    taglib_emscripten.js
    taglib_emscripten.wasm
    taglib_emscripten.d.ts
  wasi/
    taglib_wasi.wasm
  index.js
  index.d.ts
  types.d.ts
```

### 6.2 Package.json Configuration

```json
{
  "name": "taglib-wasm",
  "version": "3.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "browser": "./dist/browser/index.js",
      "deno": "./dist/index.js",
      "node": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./types": {
      "types": "./dist/types.d.ts"
    }
  },
  "files": [
    "dist/**",
    "!dist/**/*.test.*"
  ],
  "engines": {
    "node": ">=18.0.0",
    "deno": ">=1.37.0"
  },
  "keywords": [
    "taglib",
    "wasm",
    "wasi",
    "audio",
    "metadata",
    "mp3",
    "flac",
    "m4a"
  ]
}
```

### 6.3 Deno.json Configuration

```json
{
  "name": "@taglib/wasm",
  "version": "3.0.0",
  "exports": {
    ".": "./mod.ts",
    "./types": "./src/types.ts"
  },
  "tasks": {
    "build": "deno task build:wasi && deno task build:emscripten",
    "build:wasi": "./build/build-wasi.sh",
    "build:emscripten": "./build/build-emscripten.sh",
    "test": "deno test --allow-read --allow-ffi",
    "bench": "deno bench --allow-read --allow-ffi"
  }
}
```

### 6.4 Release Process

- [ ] Version bump in package.json and deno.json
- [ ] Generate changelog from commits
- [ ] Build both WASM binaries
- [ ] Run full test suite
- [ ] Publish to npm: `npm publish`
- [ ] Publish to JSR: `deno publish`
- [ ] Create GitHub release with binaries
- [ ] Update documentation

**Deliverables:**

- Published npm package
- Published JSR/Deno package
- GitHub release with artifacts

---

## Phase 7: Quality-of-Life Extras (Post-v3.0)

**Duration:** 2 weeks (optional)\
**Risk:** Low\
**Dependencies:** Phase 6

### 7.1 Advanced Features

- [ ] **FD pass-through**: Accept `{ fd: number }` on Node & Deno to avoid reading whole file into RAM
- [ ] **Streaming API**: Process large files in chunks
- [ ] **Worker pool**: Utility for parallel tag processing
- [ ] **Batch operations**: Process entire directories efficiently
- [ ] **Extended metadata**: Support for lyrics, chapters, custom tags

### 7.2 Performance Optimizations

- [ ] **SIMD support**: Use WASM SIMD for faster processing
- [ ] **Lazy loading**: Load WASM module on-demand
- [ ] **Caching**: Cache parsed tags with file modification time
- [ ] **Memory pooling**: Reuse memory allocations

### 7.3 Developer Experience

- [ ] **CLI tool**: `npx taglib-wasm read file.mp3`
- [ ] **VSCode extension**: Preview tags in editor
- [ ] **React/Vue/Svelte components**: Drop-in UI components
- [ ] **Debugging tools**: WASM profiler integration

### 7.4 Future: Component Model

- [ ] Migrate to WASI Preview 2 when stable
- [ ] Use WebAssembly Component Model for type-safe bindings
- [ ] Support for WASI filesystem proposals
- [ ] Native async/await in WASM

**Deliverables:**

- Feature-complete v3.1+ releases
- Enhanced developer tools
- Future-proof architecture

---

## Success Metrics

### Performance Targets

- [ ] WASI build size < 350KB (gzipped < 150KB)
- [ ] Deno + WASI: < 10ms for average MP3 file
- [ ] Near-native performance for filesystem operations
- [ ] Zero memory leaks in 1000+ file test

### Quality Metrics

- [ ] 100% backward compatibility for public API
- [ ] Test coverage > 90%
- [ ] Zero npm audit vulnerabilities
- [ ] Documentation for all public APIs

### Adoption Metrics

- [ ] Working in all major JS runtimes
- [ ] < 5 GitHub issues in first month
- [ ] Positive performance benchmarks vs alternatives
- [ ] Community adoption in major projects

---

## Timeline Summary

| Phase                  | Duration | Cumulative | Description                    |
| ---------------------- | -------- | ---------- | ------------------------------ |
| Phase 0: Research      | 1 week   | Week 1     | WASI validation & benchmarking |
| Phase 1: Setup         | 3 days   | Week 1-2   | Project structure & CI         |
| Phase 2: C API         | 1 week   | Week 2-3   | Minimal C facade               |
| Phase 3: Build Scripts | 1 week   | Week 3-4   | Dual build system              |
| Phase 4: TypeScript    | 1 week   | Week 4-5   | Runtime loader & API           |
| Phase 5: Testing       | 1 week   | Week 5-6   | Cross-runtime tests            |
| Phase 6: Release       | 3 days   | Week 6     | Package & publish              |
| Phase 7: Extras        | 2 weeks  | Week 7-8   | Optional enhancements          |

**Total: 6 weeks for v3.0.0** (core functionality)\
**Total: 8 weeks with extras** (full feature set)

---

## Why This Architecture is "KISS"

1. **No Embind, no complexity** – Simple C API with JSON serialization
2. **Single source of truth** – One C API serves both builds
3. **Two straightforward toolchains** – emcc for browsers, wasi-sdk for servers
4. **Minimal JavaScript** – ~200 LOC for entire loader and API
5. **Zero migration burden** – Clean slate, no legacy code
6. **Single package** – npm install once, works everywhere
7. **Predictable behavior** – Same API, same results, every platform

## Next Steps

1. **Immediate Actions:**
   - Set up WASI SDK development environment
   - Create proof-of-concept with sample MP3
   - Benchmark Deno + @wasmer/wasi performance

2. **Team Requirements:**
   - 1 developer for 6-8 weeks
   - CI resources for dual builds
   - Test devices/environments

3. **Success Criteria:**
   - Phase 0 validates performance gains
   - Each phase completes independently
   - v3.0.0 ships in 6 weeks

Start with **Phase 0** to validate assumptions, then proceed sequentially. Each phase merges cleanly and provides immediate value.
