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
   * Force legacy Emscripten-only mode (disables WASI optimizations).
   * Use this for debugging or compatibility with older environments.
   * @default false
   */
  legacyMode?: boolean;
}
