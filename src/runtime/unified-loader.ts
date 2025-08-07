/**
 * @fileoverview Unified loader that selects optimal WASM implementation
 *
 * Automatically detects the runtime environment and loads either:
 * - WASI-based implementation for Deno/Node.js (faster filesystem access)
 * - Emscripten-based implementation for browsers (universal compatibility)
 *
 * Provides zero-breaking-changes wrapper around existing TagLib APIs.
 */

import type { TagLibModule, WasmModule } from "../wasm.ts";
import type { LoadTagLibOptions } from "../../index.ts";
import { detectRuntime, type RuntimeDetectionResult } from "./detector.ts";
import {
  loadWasi,
  type WasiExports,
  type WasiLoaderConfig,
} from "./wasi-loader.ts";

/**
 * Configuration options for the unified loader
 */
export interface UnifiedLoaderOptions extends LoadTagLibOptions {
  /** Force a specific WASM type (overrides automatic detection) */
  forceWasmType?: "wasi" | "emscripten";
  /** Disable performance optimizations for debugging */
  disableOptimizations?: boolean;
  /** WASI-specific configuration */
  wasiConfig?: Partial<WasiLoaderConfig>;
}

/**
 * Unified module interface that wraps both WASI and Emscripten implementations
 */
export interface UnifiedTagLibModule extends TagLibModule {
  /** Runtime information */
  readonly runtime: RuntimeDetectionResult;
  /** Whether this module uses WASI */
  readonly isWasi: boolean;
  /** Whether this module uses Emscripten */
  readonly isEmscripten: boolean;
  /** Get performance metrics */
  getPerformanceMetrics?(): {
    initTime: number;
    wasmType: string;
    environment: string;
    memoryUsage?: number;
  };
}

/**
 * Load the optimal TagLib module for the current runtime environment
 */
export async function loadUnifiedTagLibModule(
  options: UnifiedLoaderOptions = {},
): Promise<UnifiedTagLibModule> {
  const startTime = performance.now();

  // Detect runtime environment
  const runtime = detectRuntime();

  // Determine which WASM implementation to use
  const preferredWasmType = options.forceWasmType ||
    (runtime.wasmType === "wasi" && runtime.supportsFilesystem
      ? "wasi"
      : "emscripten");

  console.debug(
    `[UnifiedLoader] Selected ${preferredWasmType} for ${runtime.environment}`,
  );

  let module: TagLibModule;
  let actualWasmType: "wasi" | "emscripten";

  if (preferredWasmType === "wasi") {
    // Try to load WASI implementation
    try {
      module = await loadWasiTagLibModule(runtime, options);
      actualWasmType = "wasi";
    } catch (error) {
      console.warn(
        `[UnifiedLoader] WASI loading failed, falling back to Emscripten: ${error}`,
      );
      // Fall back to Emscripten if WASI fails
      module = await loadEmscriptenTagLibModule(options);
      actualWasmType = "emscripten";
    }
  } else {
    // Load Emscripten implementation directly
    module = await loadEmscriptenTagLibModule(options);
    actualWasmType = "emscripten";
  }

  const initTime = performance.now() - startTime;

  // Wrap with unified interface using the actual loaded type
  const unifiedModule: UnifiedTagLibModule = {
    ...module,
    runtime,
    isWasi: actualWasmType === "wasi",
    isEmscripten: actualWasmType === "emscripten",
    getPerformanceMetrics: () => ({
      initTime,
      wasmType: actualWasmType,
      environment: runtime.environment,
      memoryUsage: (module as any).getTotalMemory?.(),
    }),
  };

  console.debug(`[UnifiedLoader] Initialized in ${initTime.toFixed(2)}ms`);

  return unifiedModule;
}

/**
 * Load WASI-based TagLib module (Deno/Node.js optimized)
 */
async function loadWasiTagLibModule(
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): Promise<TagLibModule> {
  // Load the WASI module
  const wasiConfig: Partial<WasiLoaderConfig> = {
    enableMessagePack: !options.disableOptimizations,
    ...options.wasiConfig,
  };

  const wasiExports = await loadWasi(wasiConfig);

  // Create TagLib-compatible wrapper
  const tagLibModule: TagLibModule = await createTagLibWasiWrapper(
    wasiExports,
    runtime,
  );

  return tagLibModule;
}

/**
 * Load traditional Emscripten-based TagLib module (browser compatible)
 *
 * IMPORTANT: This function directly loads the legacy Emscripten module
 * to avoid circular dependency with index.ts
 */
async function loadEmscriptenTagLibModule(
  options: UnifiedLoaderOptions,
): Promise<TagLibModule> {
  // Directly load the Emscripten module without going through index.ts
  // This prevents circular dependency: index.ts -> unified-loader.ts -> index.ts

  let createTagLibModule;
  try {
    // First try the build directory (development)
    // @ts-ignore: Dynamic import handled at runtime
    const module = await import("../../build/taglib-wrapper.js");
    createTagLibModule = module.default;
  } catch {
    try {
      // Then try the dist directory (CI/production)
      // @ts-ignore: Dynamic import handled at runtime
      const module = await import("../../dist/taglib-wrapper.js");
      createTagLibModule = module.default;
    } catch {
      throw new Error(
        "Could not load taglib-wrapper.js from either ./build or ./dist. " +
          "Ensure the Emscripten build is available for fallback compatibility.",
      );
    }
  }

  const moduleConfig: any = {};

  if (options?.wasmBinary) {
    moduleConfig.wasmBinary = options.wasmBinary;
  }

  if (options?.wasmUrl) {
    moduleConfig.locateFile = (path: string) => {
      if (path.endsWith(".wasm")) {
        return options.wasmUrl!;
      }
      return path;
    };
  }

  const module = await createTagLibModule(moduleConfig);
  return module as TagLibModule;
}

/**
 * Create TagLib-compatible wrapper around WASI exports
 *
 * IMPORTANT: This is currently a STUB implementation. It provides the
 * correct interface but will throw errors when actual WASI functionality
 * is used, rather than silently returning fake data.
 */
async function createTagLibWasiWrapper(
  wasiExports: WasiExports,
  runtime: RuntimeDetectionResult,
): Promise<TagLibModule> {
  // Validate that we actually have WASI capability
  validateWasiCapability(wasiExports, runtime);

  // Import MessagePack utilities
  const { decodeTagData, decodeAudioProperties, encodeTagData } = await import(
    "../msgpack/index.ts"
  );

  // Create subsystems
  const memoryManager = createWasiMemoryManager(wasiExports);
  const compatibilityLayer = createWasiCompatibilityLayer(memoryManager);
  const fileHandleFactory = createWasiFileHandleFactory(
    wasiExports,
    memoryManager,
  );

  // Combine into TagLibModule interface
  return {
    ...compatibilityLayer,
    createFileHandle: fileHandleFactory,
  };
}

/**
 * Validate that WASI is actually available and functional
 * Throws clear errors instead of proceeding with fake implementations
 */
function validateWasiCapability(
  wasiExports: WasiExports,
  runtime: RuntimeDetectionResult,
): void {
  if (!wasiExports) {
    throw new Error(
      "WASI exports not available: WASI binary not loaded or incompatible runtime environment",
    );
  }

  if (!runtime.supportsFilesystem) {
    throw new Error(
      `Runtime ${runtime.environment} does not support filesystem operations required for WASI`,
    );
  }

  // Check for required WASI exports
  const requiredExports = ["memory", "malloc", "free"];
  for (const exportName of requiredExports) {
    if (!(exportName in wasiExports)) {
      throw new Error(
        `WASI binary missing required export: ${exportName}. Binary may be incompatible or corrupted.`,
      );
    }
  }
}

/**
 * Create memory manager for WASI environment
 *
 * NOTE: This is a simplified stub. Real implementation would
 * interact directly with WASI memory exports.
 */
function createWasiMemoryManager(wasiExports: WasiExports): WasiMemoryManager {
  // Check if we have actual WASI memory available
  if (!wasiExports.memory) {
    throw new Error("WASI memory not available: Cannot create memory manager");
  }

  const allocatedBlocks = new Map<number, number>(); // ptr -> size
  let nextPtr = 1024; // Start allocations after initial reserved space

  return {
    malloc: (size: number): number => {
      // In real WASI implementation, this would call wasiExports.malloc
      const ptr = nextPtr;
      nextPtr += size + 8; // Add padding for alignment
      allocatedBlocks.set(ptr, size);
      return ptr;
    },

    free: (ptr: number): void => {
      // In real WASI implementation, this would call wasiExports.free
      allocatedBlocks.delete(ptr);
    },

    realloc: (ptr: number, newSize: number): number => {
      throw new Error(
        "WASI realloc not implemented: Real implementation required for memory reallocation",
      );
    },

    getTotalMemory: (): number => {
      return Array.from(allocatedBlocks.values()).reduce(
        (sum, size) => sum + size,
        0,
      );
    },

    readString: (ptr: number): string => {
      throw new Error(
        "WASI string reading not implemented: Real WASI memory access required",
      );
    },

    writeString: (str: string, ptr: number, maxBytes: number): number => {
      throw new Error(
        "WASI string writing not implemented: Real WASI memory access required",
      );
    },
  };
}

/**
 * Memory manager interface for WASI operations
 */
interface WasiMemoryManager {
  malloc(size: number): number;
  free(ptr: number): void;
  realloc(ptr: number, newSize: number): number;
  getTotalMemory(): number;
  readString(ptr: number): string;
  writeString(str: string, ptr: number, maxBytes: number): number;
}

/**
 * Create Emscripten compatibility layer for WASI module
 * Provides the heap arrays and utility functions expected by TagLibModule interface
 */
function createWasiCompatibilityLayer(
  memoryManager: WasiMemoryManager,
): Omit<TagLibModule, "createFileHandle"> {
  const module = {
    // Core Emscripten compatibility - empty arrays since WASI doesn't use Emscripten heap
    HEAP8: new Int8Array(0),
    HEAP16: new Int16Array(0),
    HEAP32: new Int32Array(0),
    HEAPU8: new Uint8Array(0),
    HEAPU16: new Uint16Array(0),
    HEAPU32: new Uint32Array(0),
    HEAPF32: new Float32Array(0),
    HEAPF64: new Float64Array(0),

    // Memory management delegation
    _malloc: memoryManager.malloc,
    _free: memoryManager.free,
    _realloc: memoryManager.realloc,

    // String utilities delegation
    UTF8ToString: (ptr: number) => memoryManager.readString(ptr),
    stringToUTF8: (str: string, ptr: number, maxBytes: number) =>
      memoryManager.writeString(str, ptr, maxBytes),
    lengthBytesUTF8: (str: string) => new TextEncoder().encode(str).length,

    // Unsupported in WASI mode - fail fast with clear errors
    addFunction: () => {
      throw new Error(
        "addFunction not supported in WASI mode: Use WASI exports directly",
      );
    },
    removeFunction: () => {
      throw new Error(
        "removeFunction not supported in WASI mode: Use WASI exports directly",
      );
    },

    // Embind classes - not supported in WASI mode
    FileHandle: (() => {
      throw new Error(
        "FileHandle constructor not available in WASI mode: Use createFileHandle() instead",
      );
    }) as any,
    TagWrapper: (() => {
      throw new Error(
        "TagWrapper constructor not available in WASI mode: Use WASI tag exports instead",
      );
    }) as any,
    AudioPropertiesWrapper: (() => {
      throw new Error(
        "AudioPropertiesWrapper constructor not available in WASI mode: Use WASI audio exports instead",
      );
    }) as any,

    // Embind-specific properties (not used in WASI)
    ___getTypeName: undefined as any,
    __embind_register_class: undefined as any,
    __embind_register_class_constructor: undefined as any,
    __embind_register_class_function: undefined as any,
  };

  // Add ready promise that resolves to the module itself
  const moduleWithReady = {
    ...module,
    ready: Promise.resolve(module as any),
  };

  return moduleWithReady;
}

/**
 * Create file handle factory for WASI environment
 * Returns a factory function that creates FileHandle instances
 */
function createWasiFileHandleFactory(
  wasiExports: WasiExports,
  memoryManager: WasiMemoryManager,
): () => import("../wasm.ts").FileHandle {
  return () => {
    // Check that we have the required WASI exports for file operations
    const requiredFileExports = ["tl_read_tags", "tl_write_tags"];
    for (const exportName of requiredFileExports) {
      if (!(exportName in wasiExports)) {
        throw new Error(
          `WASI file operations not available: Missing ${exportName} export. ` +
            "Ensure TagLib-WASI.wasm is compiled with the MessagePack C API.",
        );
      }
    }

    return createWasiFileHandle(wasiExports, memoryManager);
  };
}

/**
 * Create individual WASI file handle
 * FAILS FAST: Throws errors instead of returning fake data
 */
function createWasiFileHandle(
  wasiExports: WasiExports,
  memoryManager: WasiMemoryManager,
): import("../wasm.ts").FileHandle {
  let fileData: Uint8Array | null = null;
  let isDestroyed = false;

  const checkNotDestroyed = () => {
    if (isDestroyed) {
      throw new Error(
        "FileHandle has been destroyed: Cannot perform operations on disposed handle",
      );
    }
  };

  return {
    // File loading - only accepts buffer, doesn't pretend to work
    loadFromBuffer: (buffer: Uint8Array): boolean => {
      checkNotDestroyed();
      if (!buffer || buffer.length === 0) {
        return false; // Legitimately invalid input
      }

      fileData = buffer;
      // TODO: In real implementation, would pass to WASI for format validation
      return true;
    },

    // File validation
    isValid: (): boolean => {
      checkNotDestroyed();
      // Only return true if we actually have data AND could validate it through WASI
      return fileData !== null && fileData.length > 0;
    },

    // Format detection - fails fast if not implemented
    getFormat: (): string => {
      checkNotDestroyed();
      throw new Error(
        "WASI format detection not implemented: Requires TagLib-WASI.wasm with format detection exports",
      );
    },

    // Tag access - fails fast instead of returning empty data
    getTag: () => {
      checkNotDestroyed();
      throw new Error(
        "WASI tag reading not implemented: Requires TagLib-WASI.wasm with MessagePack tag exports",
      );
    },

    // Audio properties - fails fast instead of returning zeros
    getAudioProperties: () => {
      checkNotDestroyed();
      throw new Error(
        "WASI audio properties reading not implemented: Requires TagLib-WASI.wasm with properties exports",
      );
    },

    // All other methods fail fast with clear error messages
    getProperties: () => {
      checkNotDestroyed();
      throw new Error("WASI properties access not implemented");
    },
    setProperties: (props: any) => {
      checkNotDestroyed();
      throw new Error("WASI properties modification not implemented");
    },
    getProperty: (key: string) => {
      checkNotDestroyed();
      throw new Error("WASI individual property access not implemented");
    },
    setProperty: (key: string, value: string) => {
      checkNotDestroyed();
      throw new Error("WASI individual property modification not implemented");
    },

    // MP4-specific operations
    isMP4: () => {
      checkNotDestroyed();
      throw new Error("WASI MP4 detection not implemented");
    },
    getMP4Item: (key: string) => {
      checkNotDestroyed();
      throw new Error("WASI MP4 item access not implemented");
    },
    setMP4Item: (key: string, value: string) => {
      checkNotDestroyed();
      throw new Error("WASI MP4 item modification not implemented");
    },
    removeMP4Item: (key: string) => {
      checkNotDestroyed();
      throw new Error("WASI MP4 item removal not implemented");
    },

    // Picture operations
    getPictures: () => {
      checkNotDestroyed();
      throw new Error("WASI picture access not implemented");
    },
    setPictures: (pictures: any[]) => {
      checkNotDestroyed();
      throw new Error("WASI picture modification not implemented");
    },
    addPicture: (picture: any) => {
      checkNotDestroyed();
      throw new Error("WASI picture addition not implemented");
    },
    removePictures: () => {
      checkNotDestroyed();
      throw new Error("WASI picture removal not implemented");
    },

    // File operations
    save: (): boolean => {
      checkNotDestroyed();
      throw new Error(
        "WASI file saving not implemented: Requires TagLib-WASI.wasm with write operations",
      );
    },
    getBuffer: (): Uint8Array => {
      checkNotDestroyed();
      if (!fileData) {
        throw new Error("No file data loaded: Call loadFromBuffer first");
      }
      return fileData;
    },

    // Proper cleanup
    destroy: () => {
      fileData = null;
      isDestroyed = true;
    },
  };
}

/**
 * Check if WASI is available in the current environment
 */
export function isWasiAvailable(): boolean {
  const runtime = detectRuntime();
  return runtime.wasmType === "wasi" && runtime.supportsFilesystem;
}

/**
 * Get recommended configuration for the current environment
 */
export function getRecommendedConfig(): UnifiedLoaderOptions {
  const runtime = detectRuntime();

  if (runtime.performanceTier >= 2) {
    // High-performance environment
    return {
      disableOptimizations: false,
      wasiConfig: {
        enableMessagePack: true,
        preloadPaths: ["/tmp", "/var/tmp"],
      },
    };
  } else {
    // Lower-performance environment
    return {
      disableOptimizations: false,
      wasiConfig: {
        enableMessagePack: true,
      },
    };
  }
}
