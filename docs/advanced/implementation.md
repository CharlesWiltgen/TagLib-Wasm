# Implementation Guide

Technical details about the TagLib-Wasm architecture.

## Architecture Overview

TagLib-Wasm has a dual-backend architecture:

| Layer            | Emscripten (browser)                        | WASI (server)                                         |
| ---------------- | ------------------------------------------- | ----------------------------------------------------- |
| **C++ bindings** | Embind — direct JS ↔ C++ object access      | C shim — FileRef with MessagePack serialization       |
| **I/O model**    | Buffer: entire file loaded into Wasm memory | Seek-based: reads only headers/tags via WASI syscalls |
| **Binary**       | `taglib-web.wasm` (~2MB)                    | `taglib-wasi.wasm` (~28KB boundary + linked TagLib)   |
| **Selection**    | Auto for browsers, Workers                  | Auto for Deno, Node.js                                |

A unified loader (`src/runtime/unified-loader.ts`) auto-selects the backend
based on runtime detection. Users can override with `forceWasmType: "emscripten" | "wasi"`.

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

- **`src/capi/taglib_read.cpp` / `src/capi/taglib_write.cpp`** – C++ shim
  halves using FileRef for both path I/O and buffer I/O
  (`FileRef(IOStream*)`); shared tables live in `taglib_shim_common.cpp`
- **`src/capi/taglib_boundary.c`** – Pure C WASI exports (no exceptions)
- **`src/capi/taglib_msgpack.c`** – MessagePack encoding via mpack
- **`src/runtime/wasi-host.ts`** – WASI P1 syscall implementation for Deno
- **`src/runtime/wasi-host-loader.ts`** – Loader with memory proxy pattern

### EH-Enabled Sysroot

TagLib uses `dynamic_cast`/RTTI which requires exception handling support.
The WASI binary is built with an EH-enabled sysroot — the pinned WASI SDK's
stock `eh/` multilib provides libc++/libc++abi/libunwind compiled with
exceptions, selected automatically by `-fwasm-exceptions`. Every translation
unit must use the same EH model: mixing `-fwasm-exceptions` with `-fexceptions`
fails to link with undefined `__cxa_*` symbols.

### Build Flags

All C++ files: `-fwasm-exceptions -mllvm -wasm-use-legacy-eh=false`
All C files: `-fwasm-exceptions` (for target_features consistency)
Linker: `-fwasm-exceptions -lunwind -mexec-model=reactor` — `-fwasm-exceptions` auto-selects the stock WASI SDK `eh/` multilib (introduced in SDK 33; the pinned SDK is 34, which also provides the `__cpp_exception` tag, so no `wasm_eh_tag.S` shim is needed)

The `-mexec-model=reactor` flag is critical — it exports `_initialize`
instead of `_start`, enabling the host to call it for static constructor
initialization.

## TypeScript API Layers

1. **`src/taglib.ts`** – Core `TagLib` class and `AudioFile` interface
2. **`src/simple.ts`** – Simple API (`readTags`, `applyTags`, `applyTagsToFile`)
3. **`src/folder-api.ts`** – Batch folder operations (`scanFolder`,
   `findDuplicates`)
4. **`src/runtime/unified-loader.ts`** – Backend auto-selection and loading

## Build System

```bash
# Emscripten binary
pnpm run build:wasm

# WASI binary (requires WASI SDK 34 — stock sysroot ships C++ exceptions)
bash build/setup-wasi-sdk.sh        # One-time: download WASI SDK 34
bash build/build-wasi.sh            # Build WASI binaries
```

## Testing

Tests use a `forEachBackend` pattern to run against both WASI and Emscripten:

```bash
pnpm exec vp test                                 # Full Vitest suite (tests/ + src/)
pnpm run test:deno                                # Deno-gated tests (requires Deno)
pnpm exec vp test tests/wasi-host.test.ts         # WASI-specific tests
pnpm run bench                                    # WASI vs Emscripten benchmarks
```
