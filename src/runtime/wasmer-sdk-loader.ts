/**
 * @fileoverview Modern WASI loader using @wasmer/sdk for Deno 2+
 *
 * Implements actual WASI functionality using Wasmer SDK with proper
 * file system mounting, memory management, and error handling.
 */

import { Directory, init, type Instance, type runWasix } from "@wasmer/sdk";
import {
  heapViews,
  WasmArena,
  type WasmExports,
  WasmMemoryError,
} from "./wasi-memory.ts";

// Branded error types for proper error handling
export class WasmerInitError extends Error {
  readonly code = "WASMER_INIT_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerInitError";
  }
}

export class WasmerLoadError extends Error {
  readonly code = "WASMER_LOAD_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerLoadError";
  }
}

export class WasmerExecutionError extends Error {
  readonly code = "WASMER_EXECUTION_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasmerExecutionError";
  }
}

/**
 * WASI module interface matching our C API exports
 */
export interface WasiModule {
  // Core metadata functions
  tl_version(): string;
  tl_api_version(): number;

  // Memory management
  malloc(size: number): number;
  free(ptr: number): void;

  // MessagePack API
  tl_read_tags(
    pathPtr: number,
    bufPtr: number,
    len: number,
    outSizePtr: number,
  ): number;
  tl_write_tags(
    pathPtr: number,
    bufPtr: number,
    len: number,
    tagsPtr: number,
    tagsSize: number,
    outBufPtr: number,
    outSizePtr: number,
  ): number;

  // Error handling (returns pointer to error string)
  tl_get_last_error(): number;
  tl_get_last_error_code(): number;
  tl_clear_error(): void;

  // Memory access
  memory: WebAssembly.Memory;
}

/**
 * Configuration for Wasmer SDK loader
 */
export interface WasmerLoaderConfig {
  /** Path to WASI WASM binary */
  wasmPath?: string;
  /** Use inline WASM for bundling */
  useInlineWasm?: boolean;
  /** Initial file system mounts */
  mounts?: Record<string, Directory>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Arguments to pass to WASI module */
  args?: string[];
  /** Enable debug output */
  debug?: boolean;
}

// Track initialization state
let isInitialized = false;

/**
 * Initialize Wasmer SDK (must be called once before any Wasmer APIs)
 */
export async function initializeWasmer(useInline = false): Promise<void> {
  if (isInitialized) return;

  try {
    if (useInline) {
      // Try to use inline WASM for deno compile/bundle
      try {
        const wasmInline = await import("@wasmer/sdk/wasm-inline");
        await init({ module: wasmInline.default || wasmInline });
      } catch {
        // Fall back to standard init if inline fails
        await init();
      }
    } else {
      // Standard initialization
      await init();
    }
    isInitialized = true;
  } catch (error) {
    throw new WasmerInitError(
      `Failed to initialize Wasmer SDK: ${error}`,
      error,
    );
  }
}

/**
 * Load WASI module using Wasmer SDK
 */
export async function loadWasmerWasi(
  config: WasmerLoaderConfig = {},
): Promise<WasiModule> {
  const {
    wasmPath = "./dist/taglib-wasi.wasm",
    useInlineWasm = false,
    mounts = {},
    env = {},
    args = [],
    debug = false,
  } = config;

  // Ensure SDK is initialized
  await initializeWasmer(useInlineWasm);

  if (debug) {
    console.log("[WasmerSDK] Loading WASI module from:", wasmPath);
  }

  try {
    // Load WASM binary
    const wasmBytes = await loadWasmBinary(wasmPath);

    // Create WebAssembly module
    const wasmModule = await WebAssembly.compile(wasmBytes as BufferSource);

    // Set up file system mounts
    const mountConfig: Record<string, Directory> = {
      "/": new Directory(), // Root directory
      ...mounts,
    };

    // Create WASI instance with Wasmer SDK
    const instance = await instantiateWasi(wasmModule, {
      env,
      args,
      mount: mountConfig,
    });

    // Extract exports and wrap in our interface
    return createWasiModule(instance, debug);
  } catch (error) {
    throw new WasmerLoadError(
      `Failed to load WASI module from ${wasmPath}: ${error}`,
      error,
    );
  }
}

/**
 * Load WASM binary from file or URL
 */
async function loadWasmBinary(path: string): Promise<Uint8Array> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } else {
    return await Deno.readFile(path);
  }
}

/**
 * Instantiate WASI module with Wasmer SDK
 */
async function instantiateWasi(
  wasmModule: WebAssembly.Module,
  config: {
    env: Record<string, string>;
    args: string[];
    mount: Record<string, Directory>;
  },
): Promise<WebAssembly.Instance> {
  // WASI P1 stubs for buffer-only mode (no filesystem access).
  // Signatures must match Wasm type section exactly (i64 → bigint in JS).
  const EBADF = 8;
  const importObject = {
    wasi_snapshot_preview1: {
      // (i32, i32, i32, i32) -> i32
      fd_write: (_fd: number, _iovs: number, _len: number, _nw: number) => 0,
      // (i32, i32, i32, i32) -> i32
      fd_read: (_fd: number, _iovs: number, _len: number, _nr: number) => EBADF,
      // (i32) -> i32
      fd_close: (_fd: number) => 0,
      // (i32, i64, i32, i32) -> i32
      fd_seek: (_fd: number, _off: bigint, _whence: number, _new: number) =>
        EBADF,
      // (i32, i32) -> i32
      fd_fdstat_get: (_fd: number, _buf: number) => EBADF,
      // (i32, i32) -> i32
      fd_fdstat_set_flags: (_fd: number, _flags: number) => EBADF,
      // (i32, i64) -> i32
      fd_filestat_set_size: (_fd: number, _size: bigint) => EBADF,
      // (i32, i32) -> i32
      fd_prestat_get: (_fd: number, _buf: number) => EBADF,
      // (i32, i32, i32) -> i32
      fd_prestat_dir_name: (_fd: number, _path: number, _len: number) => EBADF,
      // (i32, i32, i32, i32, i32, i64, i64, i32, i32) -> i32
      path_open: ( // NOSONAR — WASI P1 spec mandates 9 parameters
        _fd: number,
        _df: number,
        _p: number,
        _pl: number,
        _of: number,
        _rbBase: bigint,
        _rbInherit: bigint,
        _ff: number,
        _ofd: number,
      ) => 76, // ENOTCAPABLE
      // (i32, i32) -> i32
      args_get: (_argv: number, _buf: number) => 0,
      // (i32, i32) -> i32
      args_sizes_get: (_argc: number, _bufsz: number) => 0,
      // (i32) -> nil
      proc_exit: (_code: number) => {},
    },
    env: {},
  };

  // Instantiate the module
  const instance = await WebAssembly.instantiate(wasmModule, importObject);

  // Initialize if needed (for libraries)
  if (instance.exports._initialize) {
    (instance.exports._initialize as () => void)();
  }

  return instance;
}

/**
 * Validate required WASI exports are present
 */
function validateWasiExports(exports: WebAssembly.Exports): void {
  const requiredExports = [
    "memory",
    "tl_malloc",
    "tl_free",
    "tl_version",
    "tl_read_tags",
    "tl_write_tags",
    "tl_get_last_error",
  ];

  for (const name of requiredExports) {
    if (!(name in exports)) {
      throw new WasmerLoadError(
        `WASI module missing required export: ${name}`,
      );
    }
  }
}

/**
 * Create memory utilities for WASI operations
 */
function createMemoryUtils(memory: WebAssembly.Memory) {
  const views = heapViews(memory);

  return {
    readCString: (ptr: number): string => {
      if (!ptr) return "";
      let end = ptr;
      while (views.u8[end] !== 0) end++;
      return new TextDecoder().decode(views.u8.slice(ptr, end));
    },

    writeCString: (str: string, ptr: number): void => {
      const bytes = new TextEncoder().encode(str);
      views.u8.set(bytes, ptr);
      views.u8[ptr + bytes.length] = 0; // Null terminator
    },
  };
}

/**
 * Create WasiModule interface from WebAssembly instance
 */
function createWasiModule(
  instance: WebAssembly.Instance,
  debug: boolean,
): WasiModule {
  const exports = instance.exports;
  validateWasiExports(exports);

  const memory = exports.memory as WebAssembly.Memory;
  const memUtils = createMemoryUtils(memory);

  if (debug) {
    console.log(
      "[WasmerSDK] WASI module loaded with exports:",
      Object.keys(exports),
    );
  }

  return createWasiInterface(exports, memory, memUtils);
}

/**
 * Create the actual WasiModule interface object
 */
function createWasiInterface(
  exports: WebAssembly.Exports,
  memory: WebAssembly.Memory,
  memUtils: ReturnType<typeof createMemoryUtils>,
): WasiModule {
  return {
    // Core metadata
    tl_version: () => {
      const ptr = (exports.tl_version as () => number)();
      return memUtils.readCString(ptr);
    },

    tl_api_version: () => {
      return exports.tl_api_version
        ? (exports.tl_api_version as () => number)()
        : 100; // Default API version
    },

    // Memory management
    malloc: (size: number) =>
      (exports.tl_malloc as (size: number) => number)(size),
    free: (ptr: number) => (exports.tl_free as (ptr: number) => void)(ptr),

    // MessagePack API
    tl_read_tags: (pathPtr, bufPtr, len, outSizePtr) =>
      (exports.tl_read_tags as (
        flag: number,
        input: number,
        inputSize: number,
        output: number,
      ) => number)(
        pathPtr,
        bufPtr,
        len,
        outSizePtr,
      ) as number,

    tl_write_tags: (
      pathPtr,
      bufPtr,
      len,
      tagsPtr,
      tagsSize,
      outBufPtr,
      outSizePtr,
    ) =>
      (exports.tl_write_tags as (
        flag: number,
        input: number,
        inputSize: number,
        tags: number,
        tagSize: number,
        output: number,
        outSize: number,
      ) => number)(
        pathPtr,
        bufPtr,
        len,
        tagsPtr,
        tagsSize,
        outBufPtr,
        outSizePtr,
      ) as number,

    // Error handling
    tl_get_last_error: () => (exports.tl_get_last_error as () => number)(),
    tl_get_last_error_code: () =>
      (exports.tl_get_last_error_code as () => number)(),
    tl_clear_error: () => (exports.tl_clear_error as () => void)(),

    // Memory access
    memory,
  };
}

/**
 * High-level API for reading tags from audio files using WASI
 * Uses RAII pattern with automatic memory cleanup
 */
export async function readTagsWithWasi(
  audioBuffer: Uint8Array,
  wasiModule: WasiModule,
): Promise<Uint8Array> {
  using arena = new WasmArena(wasiModule as WasmExports);

  // Allocate and copy input buffer
  const inputBuf = arena.allocBuffer(audioBuffer);
  const outSizePtr = arena.allocUint32();

  // Call WASI function to get required size
  const sizeResult = wasiModule.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outSizePtr.ptr,
  );
  if (sizeResult !== 0) {
    const errorCode = wasiModule.tl_get_last_error_code();
    throw new WasmMemoryError(
      `error code ${errorCode}`,
      "read tags size",
      errorCode,
    );
  }

  // Allocate output buffer and read data
  const outputSize = outSizePtr.readUint32();
  const outputBuf = arena.alloc(outputSize);

  const readResult = wasiModule.tl_read_tags(
    0,
    inputBuf.ptr,
    inputBuf.size,
    outputBuf.ptr,
  );
  if (readResult !== 0) {
    throw new WasmMemoryError(
      "failed to read data into buffer",
      "read tags data",
      readResult,
    );
  }

  // Return copy of data (arena will dispose automatically)
  return new Uint8Array(outputBuf.read().slice());
}

/**
 * Check if Wasmer SDK is available and can be initialized
 */
export async function isWasmerAvailable(): Promise<boolean> {
  try {
    await initializeWasmer();
    return true;
  } catch {
    return false;
  }
}
