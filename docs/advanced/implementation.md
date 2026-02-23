# Implementation Guide

Technical details about the TagLib-Wasm architecture.

## Architecture Overview

TagLib-Wasm has a dual-backend architecture:

| Layer            | Emscripten (browser)                        | WASI (server)                                         |
| ---------------- | ------------------------------------------- | ----------------------------------------------------- |
| **C++ bindings** | Embind — direct JS ↔ C++ object access      | C shim — FileRef with MessagePack serialization       |
| **I/O model**    | Buffer: entire file loaded into Wasm memory | Seek-based: reads only headers/tags via WASI syscalls |
| **Binary**       | `taglib-web.wasm` (~2MB)                    | `taglib_wasi.wasm` (~28KB boundary + linked TagLib)   |
| **Selection**    | Auto for browsers, Workers                  | Auto for Deno, Node.js                                |

A unified loader (`src/runtime/unified-loader.ts`) auto-selects the backend
based on runtime detection. Users can override with `forceBufferMode: true`
or `forceWasmType: "emscripten" | "wasi"`.

## Emscripten Backend

Used in browsers and as a fallback. Embind exposes TagLib's C++ classes
directly to JavaScript:

```
Audio buffer (JS) → Wasm memory → FileRef(IOStream*) → TagLib → JSON result
```

- Entire file copied into Wasm linear memory
- Embind provides automatic C++ ↔ JS type conversion
- FileRef with ByteVectorStream for in-memory processing

## WASI Backend

Used on Deno and Node.js. A C/C++ shim provides a boundary API with
MessagePack serialization:

```
File path (JS) → WASI fd_read/fd_seek syscalls → FileRef(path) → TagLib → MessagePack result
```

Key components:

- **`src/capi/taglib_shim.cpp`** — C++ shim using FileRef for both path I/O
  and buffer I/O (`FileRef(IOStream*)`)
- **`src/capi/taglib_boundary.c`** — Pure C WASI exports (no exceptions)
- **`src/capi/taglib_msgpack.c`** — MessagePack encoding via mpack
- **`src/runtime/wasi-host.ts`** — WASI P1 syscall implementation for Deno
- **`src/runtime/wasi-host-loader.ts`** — Loader with memory proxy pattern

### EH-Enabled Sysroot

TagLib uses `dynamic_cast`/RTTI which requires exception handling support.
The WASI binary is built with an EH-enabled sysroot (libc++, libc++abi,
libunwind rebuilt with `-fwasm-exceptions`). See
`.claude/rules/wasm-exception-handling.md` for details.

### Build Flags

All C++ files: `-fwasm-exceptions -mllvm -wasm-use-legacy-eh=false`
All C files: `-fwasm-exceptions` (for target_features consistency)
Linker: `-fwasm-exceptions -mllvm -wasm-use-legacy-eh=false -lunwind -mexec-model=reactor`

The `-mexec-model=reactor` flag is critical — it exports `_initialize`
instead of `_start`, enabling the host to call it for static constructor
initialization.

## Optional: Wasmtime Sidecar

For batch workloads, an optional sidecar spawns a Wasmtime process with
direct filesystem access:

```
File path (JS) → Wasmtime subprocess → WASI filesystem → TagLib → result
```

Requires Wasmtime CLI installed. Configured via `setSidecarConfig()` or
`useSidecar: true` in `TagLib.initialize()`.

## TypeScript API Layers

1. **`src/taglib.ts`** — Core `TagLib` class and `AudioFile` interface
2. **`src/simple.ts`** — Simple API (`readTags`, `applyTagsToBuffer`, `writeTagsToFile`)
3. **`src/folder-api.ts`** — Batch folder operations (`scanFolder`,
   `findDuplicates`)
4. **`src/runtime/unified-loader.ts`** — Backend auto-selection and loading

## Build System

```bash
# Emscripten binary
deno task build:wasm

# WASI binary (requires WASI SDK 30 + EH sysroot)
bash build/setup-wasi-sdk.sh        # One-time: download WASI SDK
bash build/build-eh-sysroot.sh      # One-time: build EH sysroot
bash build/build-wasi.sh            # Build WASI binaries
```

## Testing

Tests use a `forEachBackend` pattern to run against both WASI and Emscripten:

```bash
deno task test                                    # Full suite (format, lint, tests)
deno test --allow-read tests/wasi-host.test.ts    # WASI-specific tests
deno task bench                                   # WASI vs Emscripten benchmarks
```
