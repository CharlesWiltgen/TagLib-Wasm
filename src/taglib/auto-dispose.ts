import type { FileHandle } from "../wasm.ts";

/**
 * Best-effort safety net for forgetful callers (taglib-t4sn).
 *
 * The Full API requires an explicit dispose() — via `using` or a finally
 * block — but nothing enforces it, and a forgotten wrapper leaks the native
 * FileHandle for the life of the process (the Wasm C++ object on Emscripten,
 * file buffers on WASI). tuneup's engine worker hit exactly this in its write
 * path.
 *
 * The registry releases the FileHandle when the wrapper becomes unreachable
 * WITHOUT an explicit dispose(). Explicit dispose() remains the preferred and
 * deterministic path: it unregisters first, so the finalizer never runs after
 * an explicit release.
 *
 * Safety: the finalizer only ever fires when the wrapper is garbage, so a live
 * wrapper can never observe a destroyed handle. destroy() is idempotent on
 * both backends (WasiFileHandle nulls fields and sets `destroyed`; the Embind
 * binding resets unique_ptrs), so even a double-destroy via the open()-failure
 * path plus a later finalizer run is harmless.
 */
const registry = new FinalizationRegistry<FileHandle>((handle) => {
  handle.destroy();
});

/** @internal Register `handle` for release when `target` becomes garbage. */
export function registerAutoDispose(target: object, handle: FileHandle): void {
  registry.register(target, handle, target);
}

/** @internal Drop the pending registration for `target` (explicit dispose). */
export function unregisterAutoDispose(target: object): void {
  registry.unregister(target);
}
