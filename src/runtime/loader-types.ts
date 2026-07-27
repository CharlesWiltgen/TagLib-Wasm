/**
 * @fileoverview Shared types for loader configuration
 *
 * Extracted to prevent circular dependencies between index.ts and unified-loader.ts
 */

/**
 * Options for loading the TagLib WebAssembly module
 */
export interface LoadTagLibOptions {
  /**
   * Optional pre-loaded Wasm binary data (Emscripten backend only).
   * If provided, it is used instead of fetching from network, and auto mode
   * selects the Emscripten backend deterministically. Combining with
   * `forceWasmType: "wasi"` throws — the WASI backend loads from a
   * filesystem path or URL; use `wasmUrl` for that backend.
   */
  wasmBinary?: ArrayBuffer | Uint8Array;

  /**
   * Optional custom URL or path for the WASM file.
   * This is passed to the locateFile function.
   */
  wasmUrl?: string;

  /**
   * Force a specific Wasm backend type.
   * Passed through to the unified loader's `selectWasmType()`.
   */
  forceWasmType?: "wasi" | "emscripten";

  /**
   * Disable runtime optimizations (e.g., wasm-opt).
   * Useful for debugging or testing.
   * @default false
   */
  disableOptimizations?: boolean;
}

/**
 * Describe why `wasmBinary` is not a WebAssembly module, or `null` if it is.
 *
 * Both loader entry points validate this before handing the buffer to
 * Emscripten. Left to the glue, a bad buffer surfaces as an asynchronous
 * `Aborted(CompileError: ...)` written straight to the console AFTER the
 * returned promise settles — so a caller can neither attach it to their own
 * failure nor suppress it. The two entry points raise different error types,
 * hence a shared predicate rather than a shared throw.
 */
export function describeNonWasmBinary(
  binary: ArrayBuffer | Uint8Array,
): string | null {
  const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
  const MAGIC = [0x00, 0x61, 0x73, 0x6d]; // "\0asm"
  if (bytes.length >= 4 && MAGIC.every((b, i) => bytes[i] === b)) return null;
  const found = Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return "wasmBinary is not a WebAssembly module: expected magic bytes " +
    `00 61 73 6d, found ${found || "(empty)"}. Size: ${bytes.length} bytes`;
}
