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
