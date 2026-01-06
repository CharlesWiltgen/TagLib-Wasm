# WASI Direct Filesystem Implementation Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable true WASI direct filesystem access via Wasmtime sidecar with `--dir` preopened directories.

**Architecture:** Long-lived Wasmtime subprocess with stdin/stdout MessagePack protocol. Host sends file paths, sidecar reads files directly via WASI, returns tags.

**Tech Stack:** Wasmtime CLI, MessagePack (mpack), Deno subprocess API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    JavaScript Host                          │
│  readTags("/music/song.mp3") → send path to sidecar        │
└─────────────────────────┬───────────────────────────────────┘
                          │ stdin/stdout (MessagePack)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Wasmtime Sidecar (long-lived)                  │
│  wasmtime run --dir=/music taglib-wasi.wasm                 │
│                                                             │
│  • Receives path via stdin                                  │
│  • Opens file directly (true WASI filesystem)               │
│  • Returns MessagePack tags via stdout                      │
└─────────────────────────────────────────────────────────────┘
```

**Why Wasmtime sidecar:**

- Real filesystem via `--dir` preopened directories (not MemFS)
- Long-lived process amortizes WASM startup cost
- High throughput for batch operations
- Reference WASI implementation

**What we already have:**

- C API with path support: `tl_read_tags(path, NULL, 0, &out_size)` ✅
- MessagePack wire format ✅
- Compiled `taglib-wasi.wasm` ✅

---

## Task 1: Build Sidecar Main Loop (C)

**Files:**

- Create: `src/capi/taglib_sidecar.c`
- Modify: `build/build-wasi.sh` (add sidecar target)

**Goal:** A WASI binary that reads requests from stdin, processes them, writes responses to stdout.

**Protocol (MessagePack):**

Request:

```
{
  "op": "read_tags",      // or "write_tags"
  "path": "/music/song.mp3",
  "tags": {...}           // only for write_tags
}
```

Response:

```
{
  "ok": true,
  "tags": {...},          // for read_tags
  "error": "message"      // if ok=false
}
```

**Step 1: Write the sidecar main loop**

```c
// src/capi/taglib_sidecar.c
#include "taglib_api.h"
#include "core/taglib_msgpack.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Read length-prefixed message from stdin
static int read_request(uint8_t** buf, size_t* len) {
    uint32_t msg_len;
    if (fread(&msg_len, 4, 1, stdin) != 1) return -1;

    *buf = malloc(msg_len);
    if (fread(*buf, 1, msg_len, stdin) != msg_len) {
        free(*buf);
        return -1;
    }
    *len = msg_len;
    return 0;
}

// Write length-prefixed response to stdout
static void write_response(const uint8_t* buf, size_t len) {
    uint32_t msg_len = (uint32_t)len;
    fwrite(&msg_len, 4, 1, stdout);
    fwrite(buf, 1, len, stdout);
    fflush(stdout);
}

int main() {
    uint8_t* req_buf;
    size_t req_len;

    // Main loop - process requests until EOF
    while (read_request(&req_buf, &req_len) == 0) {
        // Decode request (get op and path)
        // ... decode msgpack request ...

        // Call appropriate API
        size_t out_size;
        uint8_t* result = tl_read_tags(path, NULL, 0, &out_size);

        // Encode and send response
        // ... encode msgpack response ...
        write_response(response_buf, response_len);

        free(req_buf);
    }

    return 0;
}
```

**Step 2: Add build target**

In `build/build-wasi.sh`, add:

```bash
# Build sidecar binary
$WASI_SDK/bin/clang \
    src/capi/taglib_sidecar.c \
    src/capi/taglib_api.cpp \
    ... \
    -o dist/taglib-sidecar.wasm
```

**Step 3: Test manually**

```bash
echo '{"op":"read_tags","path":"./test.mp3"}' | \
  wasmtime run --dir=. dist/taglib-sidecar.wasm
```

**Step 4: Commit**

```bash
git add src/capi/taglib_sidecar.c build/build-wasi.sh
git commit -m "feat(wasi): add sidecar main loop for stdin/stdout protocol"
```

---

## Task 2: TypeScript WasmtimeSidecar Class

**Files:**

- Create: `src/runtime/wasmtime-sidecar.ts`
- Create: `tests/wasmtime-sidecar.test.ts`

**Goal:** Manage long-lived Wasmtime subprocess, send/receive MessagePack messages.

**Step 1: Write failing test**

```typescript
// tests/wasmtime-sidecar.test.ts
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { WasmtimeSidecar } from "../src/runtime/wasmtime-sidecar.ts";

describe("WasmtimeSidecar", () => {
  let sidecar: WasmtimeSidecar | null = null;

  afterEach(async () => {
    await sidecar?.shutdown();
  });

  it("should spawn wasmtime process", async () => {
    sidecar = new WasmtimeSidecar({
      wasmPath: "./dist/taglib-sidecar.wasm",
      preopens: { "/test": "./tests/test-files" },
    });

    await sidecar.start();
    assertEquals(sidecar.isRunning(), true);
  });

  it("should read tags from path", async () => {
    sidecar = new WasmtimeSidecar({
      wasmPath: "./dist/taglib-sidecar.wasm",
      preopens: { "/test": "./tests/test-files" },
    });

    await sidecar.start();
    const tags = await sidecar.readTags("/test/mp3/kiss-snippet.mp3");

    assertExists(tags);
    assertEquals(typeof tags.title, "string");
  });
});
```

**Step 2: Implement WasmtimeSidecar**

```typescript
// src/runtime/wasmtime-sidecar.ts
import { decodeTagData, encodeTagData } from "../msgpack/index.ts";

export interface SidecarConfig {
  wasmPath: string;
  preopens: Record<string, string>; // WASI path → host path
  wasmtimePath?: string; // Default: "wasmtime"
}

export class WasmtimeSidecar {
  private process: Deno.ChildProcess | null = null;
  private stdin: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private stdout: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private config: SidecarConfig;

  constructor(config: SidecarConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    const args = ["run"];

    // Add --dir flags for each preopen
    for (const [wasiPath, hostPath] of Object.entries(this.config.preopens)) {
      args.push(`--dir=${hostPath}::${wasiPath}`);
    }

    args.push(this.config.wasmPath);

    const command = new Deno.Command(this.config.wasmtimePath ?? "wasmtime", {
      args,
      stdin: "piped",
      stdout: "piped",
      stderr: "inherit",
    });

    this.process = command.spawn();
    this.stdin = this.process.stdin.getWriter();
    this.stdout = this.process.stdout.getReader();
  }

  async readTags(path: string): Promise<Record<string, unknown>> {
    // Send request
    const request = { op: "read_tags", path };
    await this.sendMessage(request);

    // Receive response
    const response = await this.receiveMessage();
    if (!response.ok) {
      throw new Error(response.error);
    }
    return response.tags;
  }

  async writeTags(path: string, tags: Record<string, unknown>): Promise<void> {
    const request = { op: "write_tags", path, tags };
    await this.sendMessage(request);

    const response = await this.receiveMessage();
    if (!response.ok) {
      throw new Error(response.error);
    }
  }

  private async sendMessage(msg: unknown): Promise<void> {
    const encoded = encodeRequest(msg);
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, encoded.length, true);

    await this.stdin!.write(lenBuf);
    await this.stdin!.write(encoded);
  }

  private async receiveMessage(): Promise<any> {
    // Read 4-byte length prefix
    const lenBuf = await this.readExact(4);
    const len = new DataView(lenBuf.buffer).getUint32(0, true);

    // Read message body
    const msgBuf = await this.readExact(len);
    return decodeResponse(msgBuf);
  }

  private async readExact(n: number): Promise<Uint8Array> {
    const result = new Uint8Array(n);
    let offset = 0;
    while (offset < n) {
      const { value, done } = await this.stdout!.read();
      if (done) throw new Error("Unexpected EOF from sidecar");
      result.set(value.slice(0, n - offset), offset);
      offset += value.length;
    }
    return result;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  async shutdown(): Promise<void> {
    this.stdin?.close();
    await this.process?.status;
    this.process = null;
  }
}
```

**Step 3: Commit**

```bash
git add src/runtime/wasmtime-sidecar.ts tests/wasmtime-sidecar.test.ts
git commit -m "feat(wasi): add WasmtimeSidecar class for long-lived worker"
```

---

## Task 3: Add Routing Logic in Simple API

**Files:**

- Modify: `src/simple.ts`
- Modify: `src/taglib.ts` (add sidecar initialization option)

**Goal:** When WASI sidecar is configured, route path-based calls through it.

**Step 1: Add initialization option**

```typescript
// In TagLib.initialize()
export interface InitOptions {
  // ... existing options ...
  useSidecar?: boolean;
  sidecarConfig?: {
    preopens: Record<string, string>;
    wasmtimePath?: string;
  };
}
```

**Step 2: Add routing in readTags**

```typescript
export async function readTags(file: AudioFileInput): Promise<Tag> {
  const taglib = await getTagLib();

  // Route to sidecar for path-based access when available
  if (typeof file === "string" && taglib.sidecar?.isRunning()) {
    return taglib.sidecar.readTags(file);
  }

  // Existing buffer-based path
  // ...
}
```

**Step 3: Commit**

```bash
git add src/simple.ts src/taglib.ts
git commit -m "feat(simple): add sidecar routing for path-based access"
```

---

## Task 4: Add Benchmark Tests

**Files:**

- Create: `tests/sidecar-benchmark.bench.ts`

**Goal:** Quantify performance difference between buffer-based and sidecar approaches.

```typescript
const TEST_FILE = "./tests/test-files/mp3/kiss-snippet.mp3";

// Baseline: Host reads file, passes buffer
Deno.bench({
  name: "readTags - buffer (host reads file)",
  group: "single-file",
  baseline: true,
  async fn() {
    const buffer = await Deno.readFile(TEST_FILE);
    await readTags(buffer);
  },
});

// Sidecar: WASI reads file directly
Deno.bench({
  name: "readTags - sidecar (WASI reads file)",
  group: "single-file",
  async fn() {
    await readTags(TEST_FILE); // Routes to sidecar
  },
});

// Batch: Where sidecar really shines
Deno.bench({
  name: "batch 10 files - buffer",
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
  name: "batch 10 files - sidecar",
  group: "batch",
  async fn() {
    for (const file of testFiles) {
      await readTags(file);
    }
  },
});
```

---

## Task 5: Update Documentation

**Files:**

- Modify: `docs/concepts/runtime-compatibility.md`
- Modify: `LLMs.md`
- Modify: `README.md`

Add section on Wasmtime sidecar mode:

````markdown
## High-Performance Mode: Wasmtime Sidecar

For server-side batch operations, enable the Wasmtime sidecar for true
direct filesystem access:

### Prerequisites

Install Wasmtime: `curl https://wasmtime.dev/install.sh -sSf | bash`

### Usage

```typescript
import { readTags, TagLib } from "taglib-wasm";

await TagLib.initialize({
  useSidecar: true,
  sidecarConfig: {
    preopens: {
      "/music": "/home/user/Music",
    },
  },
});

// Now path-based calls use direct WASI filesystem access
const tags = await readTags("/music/song.mp3");
```
````

### When to Use

| Scenario                        | Recommended Mode       |
| ------------------------------- | ---------------------- |
| Browser                         | Buffer-based (default) |
| Single file CLI                 | Buffer-based           |
| Batch processing (100+ files)   | Sidecar                |
| Electron app with large library | Sidecar                |

```
---

## Success Criteria

- [ ] `taglib-sidecar.wasm` builds and responds to stdin requests
- [ ] `WasmtimeSidecar` class spawns and manages wasmtime process
- [ ] `readTags("/path")` routes to sidecar when configured
- [ ] Benchmarks show measurable improvement for batch operations
- [ ] Documentation explains when/how to use sidecar mode
```
