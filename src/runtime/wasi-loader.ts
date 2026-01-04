/**
 * @fileoverview WASI WebAssembly loader for server-side environments
 *
 * Loads and instantiates the WASI version of taglib-wasm for optimal
 * filesystem performance in Deno and Node.js environments.
 *
 * Uses @wasmer/wasi for Deno and node:wasi for Node.js when available.
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
const DEFAULT_CONFIG: WasiLoaderConfig = {
  wasmPath: "./dist/wasi/taglib_wasi.wasm",
  initialMemory: 256, // 16MB
  maxMemory: 32768, // 2GB
  preopens: {},
  env: {},
  debug: false,
};

/**
 * Load WASI WebAssembly module with Deno's @wasmer/wasi
 */
async function loadWithWasmerWasi(
  config: WasiLoaderConfig,
): Promise<WasiExports> {
  try {
    // Dynamic import to avoid issues in non-Deno environments
    const wasmerModule = await import("@wasmer/wasi");
    const { init, WASI } = wasmerModule;

    if (config.debug) {
      console.log("[WASI Loader] Initializing @wasmer/wasi");
    }

    // Initialize the WASI module (required in v1.x)
    await init();

    // Configure WASI with filesystem access
    const wasi = new WASI({
      env: config.env || {},
      args: [],
      preopens: {
        "/": Deno.cwd(), // Default to current directory
        ...config.preopens,
      },
    });

    // Load WASM binary
    let wasmBytes: Uint8Array;
    try {
      if (config.wasmPath?.startsWith("http")) {
        const response = await fetch(config.wasmPath);
        wasmBytes = new Uint8Array(await response.arrayBuffer());
      } else {
        wasmBytes = await Deno.readFile(config.wasmPath!);
      }
    } catch (error) {
      throw new Error(
        `Failed to load WASM binary from ${config.wasmPath}: ${error}`,
      );
    }

    if (config.debug) {
      console.log(
        `[WASI Loader] Loaded ${wasmBytes.length} bytes from ${config.wasmPath}`,
      );
    }

    // Compile and instantiate using WASI's instantiate method (v1.x API)
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await wasi.instantiate(module, {});

    // Start WASI (instance already set by instantiate in v1.x)
    wasi.start();

    if (config.debug) {
      console.log("[WASI Loader] WASI module loaded successfully");
    }

    return instance.exports as unknown as WasiExports;
  } catch (error) {
    throw new Error(`Failed to load WASI module with @wasmer/wasi: ${error}`);
  }
}

/**
 * Load WASI WebAssembly module with Node.js built-in WASI (experimental)
 */
async function loadWithNodeWasi(
  config: WasiLoaderConfig,
): Promise<WasiExports> {
  try {
    // Dynamic import for Node.js WASI
    const { WASI } = await import("node:wasi");
    const fs = await import("node:fs/promises");

    if (config.debug) {
      console.log("[WASI Loader] Using Node.js built-in WASI");
    }

    // Configure WASI
    const wasi = new WASI({
      version: "preview1",
      env: config.env || {},
      args: [],
      preopens: {
        "/": (globalThis as any).process?.cwd?.() || "/",
        ...config.preopens,
      },
    } as any);

    // Load WASM binary
    let wasmBytes: Uint8Array;
    try {
      if (config.wasmPath?.startsWith("http")) {
        const response = await fetch(config.wasmPath);
        wasmBytes = new Uint8Array(await response.arrayBuffer());
      } else {
        wasmBytes = await fs.readFile(config.wasmPath!);
      }
    } catch (error) {
      throw new Error(
        `Failed to load WASM binary from ${config.wasmPath}: ${error}`,
      );
    }

    if (config.debug) {
      console.log(
        `[WASI Loader] Loaded ${wasmBytes.length} bytes from ${config.wasmPath}`,
      );
    }

    // Compile and instantiate
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(
      module,
      wasi.getImportObject() as any,
    );

    // Initialize WASI
    wasi.start(instance);

    if (config.debug) {
      console.log("[WASI Loader] Node.js WASI module loaded successfully");
    }

    return instance.exports as unknown as WasiExports;
  } catch (error) {
    throw new Error(`Failed to load WASI module with Node.js: ${error}`);
  }
}

/**
 * Primary WASI loader function with automatic runtime detection
 */
export async function loadWasi(
  userConfig: Partial<WasiLoaderConfig> = {},
): Promise<WasiExports> {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  if (config.debug) {
    console.log("[WASI Loader] Loading WASI module with config:", config);
  }

  // Try Deno's @wasmer/wasi first (optimal for Deno)
  if (typeof Deno !== "undefined") {
    try {
      return await loadWithWasmerWasi(config);
    } catch (error) {
      if (config.debug) {
        console.warn("[WASI Loader] @wasmer/wasi failed, falling back:", error);
      }
    }
  }

  // Try Node.js built-in WASI (experimental but native)
  const globalAny = globalThis as any;
  if (
    typeof globalAny.process !== "undefined" && globalAny.process.versions?.node
  ) {
    try {
      return await loadWithNodeWasi(config);
    } catch (error) {
      if (config.debug) {
        console.warn("[WASI Loader] Node.js WASI failed:", error);
      }
    }
  }

  // No WASI support available
  throw new Error(
    "WASI not supported in this environment. " +
      "Ensure you're running in Deno or Node.js 16+ with WASI support.",
  );
}

/**
 * Check if WASI is available in the current environment
 */
export async function isWasiAvailable(): Promise<boolean> {
  try {
    // Quick check for Deno + @wasmer/wasi
    if (typeof Deno !== "undefined") {
      try {
        await import("@wasmer/wasi");
        return true;
      } catch {
        // @wasmer/wasi not available, but that's ok
        return false;
      }
    }

    // Quick check for Node.js WASI
    const globalAny = globalThis as any;
    if (
      typeof globalAny.process !== "undefined" &&
      globalAny.process.versions?.node
    ) {
      try {
        await import("node:wasi");
        return true;
      } catch {
        // Node WASI not available
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get WASI capability information for the current environment
 */
export async function getWasiCapabilities(): Promise<{
  available: boolean;
  runtime: "deno" | "node" | "unknown";
  version?: string;
  features: {
    filesystem: boolean;
    networking: boolean;
    threading: boolean;
  };
}> {
  const available = await isWasiAvailable();

  if (typeof Deno !== "undefined") {
    return {
      available,
      runtime: "deno",
      version: Deno.version.deno,
      features: {
        filesystem: true,
        networking: true,
        threading: false,
      },
    };
  }

  const globalAny = globalThis as any;
  if (
    typeof globalAny.process !== "undefined" && globalAny.process.versions?.node
  ) {
    return {
      available,
      runtime: "node",
      version: globalAny.process.versions.node,
      features: {
        filesystem: true,
        networking: false,
        threading: false,
      },
    };
  }

  return {
    available: false,
    runtime: "unknown",
    features: {
      filesystem: false,
      networking: false,
      threading: false,
    },
  };
}

/**
 * Create a WASI loader instance with caching
 * Useful for applications that need to load multiple files
 */
export class CachedWasiLoader {
  private instance: WasiExports | null = null;
  private config: WasiLoaderConfig;

  constructor(config: Partial<WasiLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create the WASI instance
   */
  async getInstance(): Promise<WasiExports> {
    if (!this.instance) {
      this.instance = await loadWasi(this.config);
    }
    return this.instance;
  }

  /**
   * Clear the cached instance (useful for testing)
   */
  clearCache(): void {
    this.instance = null;
  }

  /**
   * Update configuration and clear cache
   */
  updateConfig(newConfig: Partial<WasiLoaderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }
}
