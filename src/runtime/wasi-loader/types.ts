/**
 * @fileoverview Type definitions for the WASI loader
 *
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */

/**
 * WASI exports interface matching the C API from Phase 2.5
 */
export interface WasiExports {
  // Memory management
  memory: WebAssembly.Memory;
  malloc: (size: number) => number;
  free: (ptr: number) => void;

  // MessagePack Core API (10x faster than JSON)
  tl_read_tags: (
    pathPtr: number,
    bufPtr: number,
    len: number,
    outSizePtr: number,
  ) => number;
  tl_read_tags_ex: (
    pathPtr: number,
    bufPtr: number,
    len: number,
    format: number,
    outSizePtr: number,
  ) => number;
  tl_write_tags: (
    pathPtr: number,
    bufPtr: number,
    len: number,
    tagsPtr: number,
    tagsSize: number,
    outBufPtr: number,
    outSizePtr: number,
  ) => number;

  // Format-specific optimized paths
  tl_read_mp3: (bufPtr: number, len: number, outSizePtr: number) => number;
  tl_read_flac: (bufPtr: number, len: number, outSizePtr: number) => number;
  tl_read_m4a: (bufPtr: number, len: number, outSizePtr: number) => number;

  // Streaming API (for large files)
  tl_stream_open: (pathPtr: number, bufPtr: number, len: number) => number;
  tl_stream_read_metadata: (stream: number, outSizePtr: number) => number;
  tl_stream_close: (stream: number) => void;

  // Memory pool (Phase 2.5 - 1.7x faster than malloc)
  tl_pool_create: (initialSize: number) => number;
  tl_pool_alloc: (pool: number, size: number) => number;
  tl_pool_reset: (pool: number) => void;
  tl_pool_destroy: (pool: number) => void;

  // Utility functions
  tl_detect_format: (bufPtr: number, len: number) => number;
  tl_format_name: (format: number) => number;
  tl_free: (ptr: number) => void;
  tl_version: () => number;

  // Error handling
  tl_get_last_error: () => number;
  tl_get_last_error_code: () => number;
  tl_clear_error: () => void;
}

/**
 * WASI loader configuration options
 */
export interface WasiLoaderConfig {
  /** Path to the WASI WASM binary */
  wasmPath?: string;
  /** Initial memory size in pages (64KB each) */
  initialMemory?: number;
  /** Maximum memory size in pages */
  maxMemory?: number;
  /** Preopened directories for filesystem access */
  preopens?: Record<string, string>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Enable debug output */
  debug?: boolean;
  /** Enable result caching for better performance */
  enableCaching?: boolean;
  /** Enable MessagePack serialization for 10x faster data transfer */
  enableMessagePack?: boolean;
  /** Paths to preload for faster filesystem access */
  preloadPaths?: string[];
}

/**
 * Default WASI loader configuration
 */
export const DEFAULT_CONFIG: WasiLoaderConfig = {
  wasmPath: "./dist/taglib-wasi.wasm",
  initialMemory: 256, // 16MB
  maxMemory: 32768, // 2GB
  preopens: {},
  env: {},
  debug: false,
};
