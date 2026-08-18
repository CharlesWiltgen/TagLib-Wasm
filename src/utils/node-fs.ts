/**
 * Synchronous node:fs acquisition that works in every module context
 * (ESM and CJS), including Electron main processes. See taglib-0b5 / GH #24.
 */

/** Structural subset of node:fs used by taglib-wasm's sync call sites. */
export type NodeFsLike = {
  statSync: (path: string) => unknown;
  readFileSync: (path: string) => Uint8Array;
};

type ProcessLike = {
  getBuiltinModule?: (id: string) => unknown;
};

function hasFsShape(fs: unknown): fs is NodeFsLike {
  const candidate = fs as NodeFsLike | null | undefined;
  return typeof candidate?.statSync === "function" &&
    typeof candidate?.readFileSync === "function";
}

/**
 * Acquire node:fs synchronously without tripping bundlers.
 *
 * `process.getBuiltinModule("node:fs")` is the primary strategy: it is
 * synchronous, works in both ESM and CJS, and exists on every supported
 * runtime (added in Node 22.3.0, backported to 20.16.0; the package's
 * `engines` floor of node >= 22.6.0 gates installs, while Electron's
 * embedded Node has shipped it since Electron 32). The legacy fallback
 * reads `globalThis.require` directly — equivalent to evaluating
 * `require(...)` in the global scope, which never resolves in standard
 * module files — kept only for contexts that expose `require` globally
 * (Electron renderers with nodeIntegration, node -e, the REPL) on runtimes
 * predating getBuiltinModule. Results are shape-checked so a polyfilled
 * `process` serving junk modules escalates to the next strategy instead of
 * leaking a non-fs object to callers.
 */
export function getNodeFsSync(): NodeFsLike | null {
  const proc = (globalThis as Record<string, unknown>).process as
    | ProcessLike
    | undefined;
  try {
    const fs = proc?.getBuiltinModule?.("node:fs");
    if (hasFsShape(fs)) return fs;
  } catch {
    // getBuiltinModule missing or hostile — fall through to legacy strategy
  }
  try {
    const g = globalThis as { require?: (id: string) => unknown };
    const fs = typeof g.require === "function"
      ? g.require("node:fs")
      : undefined;
    if (hasFsShape(fs)) return fs;
  } catch {
    // no global require either — caller handles null
  }
  return null;
}
