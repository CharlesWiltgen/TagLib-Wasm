# FileRef `call_indirect` Crash in WebAssembly

Technical analysis of why `TagLib::FileRef` crashes with `RuntimeError: function signature mismatch` in V8/Deno, and what would need to change to fix it.

## Summary

`FileRef` uses `dynamic_cast` (RTTI). The RTTI runtime (`__dynamic_cast` in libc++abi) was compiled **without** the Wasm `exception-handling` feature, but TagLib and our shim are compiled **with** it (`-fwasm-exceptions`). When the linker merges these into one binary, the indirect function table contains entries with mismatched type signatures. V8 traps on `call_indirect` when the caller's expected signature doesn't match the callee's actual signature.

**This is a WASI SDK limitation, not a TagLib bug.** WASI SDK 27.0 does not ship a libc++abi built with exception handling support.

## Evidence

### Target feature mismatch (confirmed via `llvm-objdump --section=target_features`)

| Object file                          | `exception-handling` feature |
| ------------------------------------ | ---------------------------- |
| `taglib_shim.obj` (our code)         | YES                          |
| `fileref.cpp.obj` (TagLib)           | YES                          |
| `cxa_stubs.obj` (our stubs)          | NO                           |
| `private_typeinfo.cpp.o` (libc++abi) | NO                           |

### What FileRef needs that FileStream doesn't

`fileref.cpp.obj` undefined symbols:

```
U __dynamic_cast                          # RTTI — from libc++abi (no EH feature)
U __cxa_atexit                            # static destructors
U __cxa_pure_virtual                      # pure virtual handler
U _ZTVN10__cxxabiv117__class_type_infoE   # RTTI vtable — from libc++abi (no EH feature)
U _ZTVN10__cxxabiv120__si_class_type_infoE # RTTI vtable — from libc++abi (no EH feature)
```

`FileStream` uses none of these. It only uses the `IOStream` vtable (simple single-inheritance virtual dispatch), which doesn't cross the EH feature boundary.

### The `dynamic_cast` in FileRef's code path

```cpp
// fileref.cpp:120 — called during FileRef construction
if(auto streamResolver = dynamic_cast<const FileRef::StreamTypeResolver *>(resolver)) {
```

Even though the resolver list is empty at runtime (no custom resolvers registered), the **linker must include** the `__dynamic_cast` implementation and its RTTI vtable dependencies. These come from libc++abi's `private_typeinfo.cpp.o`, which was compiled without `exception-handling`. This pollutes the indirect function table with entries whose signatures are incompatible with the EH-enabled calling code.

### `-fwasm-exceptions` still generates `__cxa_throw` calls

Both `-fwasm-exceptions` and `-fexceptions` produce identical `throw` codegen:

```wasm
call __cxa_allocate_exception
i32.store 0
call __cxa_throw
unreachable
```

The difference is only in `try`/`catch` — Wasm EH uses native `try`/`catch`/`rethrow` instructions while Itanium uses `_Unwind_*` landing pads. Both models still call `__cxa_throw` to initiate the throw.

### TagLib files that reference Itanium EH symbols

These TagLib `.o` files reference `__cxa_throw` (despite being compiled with `-fwasm-exceptions`):

- `tfilestream.cpp.obj`
- `tbytevector.cpp.obj`
- `tstring.cpp.obj`
- `rifffile.cpp.obj`
- `dsdifffile.cpp.obj`
- `tvariant.cpp.obj`

Our `cxa_stubs.c` provides abort-on-throw stubs for these. This works in practice because no code path in our usage actually throws — but the stubs lack the `exception-handling` feature flag, adding to the function table mismatch.

## FileRef's detection flow

```
FileRef(path)
  → parse(fileName, ...)
    → detectByResolvers(fileName, ...)     // virtual dispatch + dynamic_cast
    → new FileStream(fileName)             // this part works fine
    → detectByExtension(stream, ...)       // direct constructors, no RTTI
    → detectByContent(stream, ...)         // static isSupported() calls, no RTTI
```

The crash occurs because `detectByResolvers` links in `dynamic_cast` → `__dynamic_cast` → RTTI vtables from non-EH libc++abi, even though the resolver list is empty at runtime.

## Potential fixes

### 1. Build libc++abi with `-fwasm-exceptions` (most correct)

Build the entire WASI sysroot from source with exception handling enabled. This would make all function table entries consistent.

**Blocker**: WASI SDK tracks this at [WebAssembly/wasi-sdk#565](https://github.com/WebAssembly/wasi-sdk/issues/565). As of SDK 27.0, this is not supported. The SDK would need to ship separate sysroots for EH-enabled and non-EH builds, and Clang doesn't auto-select sysroots based on `-fwasm-exceptions`.

### 2. Compile TagLib without `-fwasm-exceptions` to match libc++abi

Remove `-fwasm-exceptions` from TagLib's CMake flags. This would make all code use the same (non-EH) ABI. Exception handling would go through the Itanium stubs (abort on throw).

**Trade-off**: The shim's `catch (...)` blocks would stop working. Currently they provide a safety net around TagLib operations. In practice this might be fine since TagLib rarely throws in normal operation.

**Risk**: If TagLib ever does throw (e.g., corrupted file triggers an internal exception), the process would abort instead of returning an error code.

### 3. Eliminate `dynamic_cast` from the FileRef code path

If FileRef's `detectByResolvers` could be compiled without `dynamic_cast` (e.g., by patching TagLib to remove the `StreamTypeResolver` check, or by stripping the resolver infrastructure entirely), the RTTI dependency would be eliminated.

**Trade-off**: Requires maintaining a TagLib patch.

### 4. Keep the current workaround (status quo)

Use `FileStream` + manual format detection + format-specific constructors. This avoids FileRef entirely and stays within the working subset of C++ features (IOStream virtual dispatch only).

**Trade-off**: ~60 lines of format-specific code that duplicates what FileRef does internally. Each new audio format requires adding a case to `create_file_from_buffer` and `tl_detect_format`.

## Resolution

Fixed by building an EH-enabled WASI sysroot using the approach from
[PR #590](https://github.com/WebAssembly/wasi-sdk/pull/590). The sysroot
rebuilds libc++, libc++abi, and libunwind with `-fwasm-exceptions -mllvm
-wasm-use-legacy-eh=false`, making all function table entries consistent.

With WASI SDK 30 + EH sysroot:

- `FileRef(path)` works for path-based I/O
- `FileRef(IOStream*)` works for buffer-based I/O
- `dynamic_cast` in `detectByResolvers` no longer causes type mismatches
- `cxa_stubs.c` is no longer needed (real EH symbols from sysroot)

Build steps:

```bash
bash build/setup-wasi-sdk.sh    # Download SDK 30
bash build/build-eh-sysroot.sh  # Build EH sysroot (~5-10 min)
bash build/build-wasi.sh        # Build with FileRef
```

## Environment

- WASI SDK 30.0 + EH sysroot (via PR #590)
- TagLib 2.1.1
- Target: `wasm32-wasi`
- Runtime: Deno 2 / V8
- Originally diagnosed: 2026-02-09 (SDK 27.0)
- Resolved: 2026-02-09 (SDK 30.0 + EH sysroot)
