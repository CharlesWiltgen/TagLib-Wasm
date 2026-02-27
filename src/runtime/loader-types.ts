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
   * Optional pre-loaded WASM binary data.
   * If provided, this will be used instead of fetching from network.
   */
  wasmBinary?: ArrayBuffer | Uint8Array;

  /**
   * Optional custom URL or path for the WASM file.
   * This is passed to the locateFile function.
   */
  wasmUrl?: string;

  /**
   * Force buffer mode: use Emscripten-based in-memory I/O instead of
   * WASI filesystem I/O. Use for compatibility or when WASI is unavailable.
   * @default false
   */
  forceBufferMode?: boolean;

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
