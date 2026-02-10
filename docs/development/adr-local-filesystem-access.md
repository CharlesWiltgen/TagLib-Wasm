# ADR: Local Filesystem Access Strategy for taglib-wasm

**Status**: Accepted (sidecar); Proposed (in-process alternatives)
**Date**: 2026-02-09
**Supersedes**: Initial Wasmer WASI design (reverted `3c9dc02`)

## Context

taglib-wasm v0.9.1 provides audio metadata reading/writing via two Wasm binaries:

| Binary                           | Size   | Runtime             | Filesystem       |
| -------------------------------- | ------ | ------------------- | ---------------- |
| `taglib-web.wasm` (Emscripten)   | 374 KB | Browser, Node, Deno | Buffer-only      |
| `taglib_wasi.wasm` (WASI SDK)    | 424 KB | WASI runtimes       | Buffer + WASI fs |
| `taglib-sidecar.wasm` (WASI SDK) | 427 KB | Wasmtime subprocess | Real filesystem  |

The **buffer-only** path requires callers to `readFile()` into memory, pass the buffer, and `writeFile()` back. For batch operations on local files (e.g. tagging a music library), this creates unnecessary I/O overhead — the Wasm module could read/write files directly if it had filesystem access.

### Problem Statement

How should taglib-wasm provide direct filesystem access from JavaScript runtimes (Node.js, Deno) when WebAssembly modules run in a sandboxed environment without inherent filesystem capabilities?

### Prior Art in This Project

1. **Wasmer `@wasmer/wasi` attempt** (commit `04c9aaf`, reverted in `3c9dc02`):
   Replaced WASI stubs with `@wasmer/wasi` imports. Discovery: `@wasmer/wasi` only provides **MemFS** (in-memory filesystem), not real host filesystem access. The module loaded but couldn't actually read files from disk.

2. **Wasmtime sidecar** (commits `0a800ba` through `a1b593a`):
   Long-lived Wasmtime subprocess communicating via length-prefixed MessagePack over stdin/stdout. Functionally complete — reads and writes tags on real files via WASI preopened directories. Production-ready but requires Wasmtime CLI installed on the host.

## Decision Drivers

- **Latency**: Subprocess IPC adds overhead per operation (process spawn + message serialization)
- **Dependency weight**: Requiring Wasmtime CLI installed is a significant deployment burden
- **Platform reach**: Must work in Node.js and Deno; browser is out of scope for filesystem access
- **Security**: WASI capability model (preopened directories) preferred over unrestricted access
- **Maintenance**: Fewer moving parts preferred; single-process is simpler than IPC protocol
- **Standards alignment**: Favor ecosystem-standard approaches over custom solutions

## Options Evaluated

### Option 1: Wasmtime Sidecar (Current — Production)

**Architecture**: TypeScript spawns `wasmtime run --dir /music::/music taglib-sidecar.wasm` as a long-lived child process. Communication uses a custom length-prefixed MessagePack protocol over stdin/stdout.

```
┌─────────────┐    stdin/stdout     ┌──────────────────┐
│  Node/Deno  │◄──── msgpack ──────►│  wasmtime run    │
│  (host)     │    (IPC protocol)   │  sidecar.wasm    │
└─────────────┘                     └──────────────────┘
                                          │
                                          ▼ WASI fs
                                    ┌──────────────┐
                                    │  /music/*.mp3 │
                                    └──────────────┘
```

**Strengths**:

- Fully working today (5/5 implementation tasks complete)
- Real filesystem access via WASI preopened directories
- Security sandboxing via Wasmtime's capability model
- Process isolation (crash doesn't affect host)
- Supports `await using` RAII pattern for cleanup

**Weaknesses**:

- Requires Wasmtime CLI installed on host system
- Subprocess startup latency (~100ms)
- IPC serialization overhead per request
- Custom protocol adds maintenance burden
- Known issues: missing try-finally in `#sendRequest()`/`#receiveResponse()`, no path traversal validation, buffer accumulation in `#readExact()`, shutdown race conditions

**Latency profile**: ~5ms per operation after initial startup (measured in bench tests).

### Option 2: jco + WASI 0.2 Component Model (Recommended Next Step)

**Architecture**: Compile `taglib_wasi.wasm` as a WASI 0.2 Component, then use `jco transpile` to generate JavaScript bindings that call the component's filesystem interfaces via `preview2-shim`.

```
┌─────────────┐    direct call     ┌──────────────────┐
│  Node/Deno  │◄──── import ──────►│  jco-generated   │
│  (host)     │    (ES modules)    │  JS bindings     │
└─────────────┘                    └────────┬─────────┘
                                            │ calls
                                   ┌────────▼─────────┐
                                   │  taglib.wasm     │
                                   │  (Component)     │
                                   └────────┬─────────┘
                                            │ WASI 0.2
                                   ┌────────▼─────────┐
                                   │  preview2-shim   │
                                   │  (real Node fs)  │
                                   └──────────────────┘
```

**How jco works**:

- [jco 1.0](https://bytecodealliance.org/articles/jco-1.0) (Bytecode Alliance) transpiles Wasm Components into standard ES modules
- `preview2-shim` provides WASI 0.2 interfaces (`wasi:filesystem`, `wasi:io`, etc.) backed by real Node.js `fs` APIs
- The generated JavaScript is a regular importable module — no subprocess, no runtime dependency

**Build pipeline change required**:

1. Current: WASI SDK compiles to **WASI Preview 1** core module (`wasm32-wasi` target)
2. New: Must produce a **WASI 0.2 Component** — either:
   - Compile with `wasm32-wasip2` target (Rust), or
   - Use `wasm-tools component new` to wrap a P1 module as a P2 component with adapter
3. Then: `jco transpile component.wasm -o dist/` generates JS + core Wasm

**Strengths**:

- In-process (no subprocess overhead)
- No runtime dependency (generated JS is self-contained)
- Standards-track (WASI 0.2 is the current standard; WASI 0.3 with async coming Feb 2026)
- Capability-based security preserved
- Node.js support today; Deno partial (lacks native WASI P2, confirmed by [nodejs/node#55396](https://github.com/nodejs/node/issues/55396))

**Weaknesses**:

- Requires build pipeline changes (P1→P2 component wrapping or `wasip2` target)
- jco output is Node.js-first; Deno support via Node compat layer
- Generated bindings add indirection layer
- Relatively new toolchain (jco 1.0 released 2025)

**Open questions**:

- Can we wrap our existing `wasm32-wasi` (P1) binary as a P2 component using `wasm-tools component new --adapt`?
- What's the latency delta vs. direct `WebAssembly.instantiate()` with buffer passing?
- Does `preview2-shim` support preopened directory restrictions, or is it unrestricted?

### Option 3: Wasmer `@wasmer/sdk` with WASIX

**Architecture**: Use `@wasmer/sdk` (not `@wasmer/wasi`) to mount real host directories into the Wasm instance via WASIX extensions.

```
┌─────────────┐    in-process      ┌──────────────────┐
│  Node/Deno  │◄──── wasm ────────►│  @wasmer/sdk     │
│  (host)     │                    │  WASIX runtime   │
└─────────────┘                    └────────┬─────────┘
                                            │ mapdir
                                   ┌────────▼─────────┐
                                   │  /music/*.mp3    │
                                   └──────────────────┘
```

**Critical distinction from prior attempt**: The reverted commit (`04c9aaf`) used `@wasmer/wasi`, which only provides MemFS. The `@wasmer/sdk` package supports `mapdir`-style real directory mounting via WASIX, which extends WASI with additional syscalls.

**Strengths**:

- In-process (no subprocess)
- JavaScript-first SDK with good ergonomics
- Directory mounting for real filesystem access
- Works in Node.js, Deno, and browser (for MemFS use cases)

**Weaknesses**:

- WASIX is a Wasmer-specific extension, not a standard
- [Security advisory GHSA-55f3-3qvg-8pv5](https://github.com/wasmerio/wasmer/security/advisories/GHSA-55f3-3qvg-8pv5): symlink bypass in sandbox
- [Issue #4267](https://github.com/wasmerio/wasmer/issues/4267): default sandbox may be more permissive than expected
- Vendor lock-in to Wasmer ecosystem
- May require recompiling with WASIX target instead of standard WASI

**Risk assessment**: Medium-high. WASIX provides the capability but deviates from the WASI standard, and the security model has known gaps.

### Option 4: Custom Host Import Functions

**Architecture**: Skip WASI filesystem entirely. Define custom Wasm imports (`read_file`, `write_file`) that the JavaScript host provides at instantiation time, backed by native `fs` APIs.

```
┌─────────────┐                    ┌──────────────────┐
│  Node/Deno  │    importObject    │  taglib.wasm     │
│  (host)     │◄───────────────────│  (core module)   │
│             │  read_file(path)   │                  │
│  fs.readFile│  write_file(...)   │  calls imports   │
└─────────────┘                    └──────────────────┘
```

**Implementation sketch**:

```typescript
const imports = {
  env: {
    host_read_file: (
      pathPtr: number,
      pathLen: number,
      outBufPtr: number,
      outSizePtr: number,
    ): number => {
      const path = readCString(memory, pathPtr, pathLen);
      const data = fs.readFileSync(path);
      // Write data into Wasm memory at outBufPtr
      return 0; // success
    },
    host_write_file: (
      pathPtr: number,
      pathLen: number,
      bufPtr: number,
      bufLen: number,
    ): number => {
      const path = readCString(memory, pathPtr, pathLen);
      const data = new Uint8Array(memory.buffer, bufPtr, bufLen);
      fs.writeFileSync(path, data);
      return 0;
    },
  },
};
const instance = await WebAssembly.instantiate(module, imports);
```

**C-side changes required**:

```c
// New imports declared in C
extern int host_read_file(const char* path, size_t path_len,
                          uint8_t* out_buf, size_t* out_size);
extern int host_write_file(const char* path, size_t path_len,
                           const uint8_t* buf, size_t len);
```

**Strengths**:

- Simplest architecture (no runtime dependencies, no standards to follow)
- In-process with minimal overhead
- Full control over security model (host decides what paths are allowed)
- Works identically in Node.js and Deno
- No build pipeline changes for Component Model
- Essentially the sidecar protocol but without the subprocess

**Weaknesses**:

- Non-standard (custom imports, not WASI)
- Requires C-side changes to `taglib_boundary.c` (new extern declarations)
- Must handle synchronous fs calls from Wasm (no async in core Wasm yet)
- Path validation entirely host-side responsibility
- Can't leverage WASI ecosystem tooling

**Risk assessment**: Low. This is architecturally identical to what the sidecar does today, minus the subprocess.

### Option 5: `node:wasi` (Node.js Built-in)

**Architecture**: Use Node.js experimental WASI module to instantiate with real preopened directories.

**Status**: Experimental, no sandbox enforcement. Only works in Node.js (not Deno, not browser). Missing features (no WASI 0.2 support). Not recommended as primary path.

### Option 6: Deno WASI (Deno Built-in)

**Architecture**: Use Deno's `std/wasi` module.

**Status**: Missing WASI 0.2, missing `fsync` (critical for write operations). Deno-only. Not recommended as primary path.

## Decision

### Keep sidecar as production default (Option 1)

The Wasmtime sidecar is functionally complete and works today. It should remain the recommended path for users who have Wasmtime installed and need filesystem access.

**Action items** (tracked in beads):

- Harden sidecar: fix 6 code review issues (`taglib-wasm-s3m`)
- Add missing test coverage (`taglib-wasm-2xw`)

### Research jco + Component Model as next-gen replacement (Option 2)

jco represents the standards-track future. A research spike should prototype the full pipeline:

1. Wrap existing `taglib_wasi.wasm` (P1) as P2 component using `wasm-tools component new --adapt`
2. Transpile with `jco transpile`
3. Test filesystem access in Node.js via `preview2-shim`
4. Benchmark latency vs. buffer-passing and sidecar approaches

**Action item** (tracked in beads): `taglib-wasm-6j9`

### Keep custom host imports (Option 4) as fallback plan

If jco proves too complex or immature, custom host imports offer the simplest in-process path with minimal risk. The C-side changes are small (two new `extern` declarations in the boundary layer), and the JavaScript host implementation is straightforward.

### Do not pursue Wasmer WASIX (Option 3)

Despite being technically capable, WASIX is a vendor-specific extension with known security gaps. The WASI standard (via jco) is a better long-term investment.

## Consequences

### Positive

- Users get filesystem access today via sidecar (no regression)
- Clear migration path to standards-based in-process access (jco)
- Low-risk fallback (custom host imports) if standards path stalls
- Decision aligns with Bytecode Alliance ecosystem direction

### Negative

- Sidecar requires Wasmtime CLI as external dependency
- jco research requires build pipeline investment (Component Model tooling)
- Two filesystem access modes to maintain during transition period

### Risks

- WASI 0.3 (async) timeline may slip, delaying full async filesystem support
- jco's Deno support depends on Deno's Node compat layer quality
- Component Model toolchain (wasm-tools, wit-bindgen) is still evolving rapidly

## Appendix: Binary Architecture

### Current Build Pipeline

```
TagLib C++ (lib/taglib/)
    │
    ├──► WASI SDK (clang --target=wasm32-wasi)
    │       │
    │       ├──► taglib_wasi.wasm (424 KB) — library module, buffer API
    │       │       Uses: taglib_boundary.c + taglib_shim.cpp + mpack
    │       │       Exports: tl_read_tags, tl_write_tags, tl_version, ...
    │       │
    │       └──► taglib-sidecar.wasm (427 KB) — executable, stdin/stdout protocol
    │               Uses: taglib_sidecar.c + taglib_boundary.c + taglib_shim.cpp + mpack
    │               Entry: main() loop reading msgpack from stdin
    │
    └──► Emscripten (emcc --bind)
            │
            └──► taglib-web.wasm (374 KB) — browser/Node via Embind
                    Uses: Embind C++ bindings
                    Exports: FileHandle, TagWrapper, AudioPropertiesWrapper
```

### Exception Handling Architecture

All WASI binaries use a hybrid C/C++ approach to avoid Wasm EH model conflicts:

- **Pure C** (`taglib_boundary.c`, `taglib_sidecar.c`, `taglib_msgpack.c`): No exception handling
- **C++ shim** (`taglib_shim.cpp`): `-fwasm-exceptions` to catch TagLib C++ exceptions
- **C++ support** (`taglib_error.cpp`): `-fwasm-exceptions` for std::string compatibility
- **EH sysroot**: libc++abi + libunwind rebuilt with `-fwasm-exceptions` (via `build/build-eh-sysroot.sh`)

All C++ code uses consistent Wasm EH flags (`-fwasm-exceptions -mllvm -wasm-use-legacy-eh=false`). See `.claude/rules/wasm-exception-handling.md`.

### Sidecar IPC Protocol

```
Request:  [4-byte LE uint32 length][MessagePack payload]
Response: [4-byte LE uint32 length][MessagePack payload]

Request payload:  { "op": "read_tags"|"write_tags", "path": string, "tags"?: bytes }
Response payload: { "ok": true, "tags": bytes } | { "ok": false, "error": string }
```

## References

- [WASI interfaces specification](https://wasi.dev/interfaces)
- [Wasmtime documentation](https://docs.wasmtime.dev/)
- [jco 1.0 announcement](https://bytecodealliance.org/articles/jco-1.0)
- [Node.js WASI P2 tracking issue](https://github.com/nodejs/node/issues/55396)
- [Wasmer SDK filesystem docs](https://docs.wasmer.io/sdk/wasmer-js/how-to/use-filesystem)
- [Wasmer sandbox advisory GHSA-55f3-3qvg-8pv5](https://github.com/wasmerio/wasmer/security/advisories/GHSA-55f3-3qvg-8pv5)
- [Wasmer sandbox issue #4267](https://github.com/wasmerio/wasmer/issues/4267)
- [Rust `wasm32-wasip2` target](https://doc.rust-lang.org/nightly/rustc/platform-support/wasm32-wasip2.html)
- [cargo-component](https://github.com/bytecodealliance/cargo-component)
- [wit-bindgen](https://github.com/bytecodealliance/wit-bindgen)
