/**
 * @fileoverview WebAssembly module interface for Cloudflare Workers
 */

import type { TagLibModule, TagLibWorkersConfig } from "./types.ts";
import { TagLibInitializationError } from "./errors.ts";
import type { WasmExports } from "./runtime/wasi-memory.ts";

// Re-export TagLibModule for convenience
export type { TagLibModule };

export { WasmAlloc, WasmArena } from "./runtime/wasi-memory.ts";

/**
 * Bridge Emscripten module to WasmExports interface for RAII memory management.
 * Prefers wasmMemory (live .buffer getter survives memory growth). Falls back
 * to a snapshot of HEAPU8.buffer — safe for short-lived allocations but would
 * go stale if Emscripten grows memory between adapter creation and use.
 */
export function emscriptenToWasmExports(module: TagLibModule): WasmExports {
  const memory = module.wasmMemory ?? { buffer: module.HEAPU8.buffer };
  return {
    memory,
    malloc: (size: number) => module._malloc(size),
    free: (ptr: number) => module._free(ptr),
  };
}

/**
 * Default configuration for TagLib-Wasm module in Workers environment
 * Reduced memory limits to fit within Workers constraints
 */
const DEFAULT_WORKERS_CONFIG: TagLibWorkersConfig = {
  memory: {
    initial: 8 * 1024 * 1024, // 8MB (reduced from 16MB)
    maximum: 64 * 1024 * 1024, // 64MB (reduced from 256MB)
  },
  debug: false,
};

/**
 * Create Emscripten module configuration for Workers
 */
function createModuleConfig(
  wasmBinary: Uint8Array,
  config: TagLibWorkersConfig,
) {
  const mergedConfig = { ...DEFAULT_WORKERS_CONFIG, ...config };

  return {
    wasmBinary,
    wasmMemory: new WebAssembly.Memory({
      initial: (mergedConfig.memory?.initial ?? 8 * 1024 * 1024) / (64 * 1024),
      maximum: (mergedConfig.memory?.maximum ?? 64 * 1024 * 1024) / (64 * 1024),
    }),
    print: mergedConfig.debug ? console.log : () => {},
    printErr: mergedConfig.debug ? console.error : () => {},
    onRuntimeInitialized: () => {
      if (mergedConfig.debug) {
        console.log("TagLib-Wasm module initialized in Workers");
      }
    },
    // Workers-specific settings
    locateFile: () => "", // Empty string since we're providing wasmBinary directly
    noFSInit: true, // Disable file system access
    noExitRuntime: true,
  };
}

/**
 * Setup memory arrays on the WebAssembly instance
 */
function setupMemoryArrays(wasmInstance: any): void {
  if (!wasmInstance.HEAPU8) {
    const buffer = wasmInstance.buffer ?? wasmInstance.wasmMemory?.buffer;
    if (buffer) {
      wasmInstance.HEAPU8 = new Uint8Array(buffer);
      wasmInstance.HEAP8 = new Int8Array(buffer);
      wasmInstance.HEAP16 = new Int16Array(buffer);
      wasmInstance.HEAP32 = new Int32Array(buffer);
      wasmInstance.HEAPU16 = new Uint16Array(buffer);
      wasmInstance.HEAPU32 = new Uint32Array(buffer);
      wasmInstance.HEAPF32 = new Float32Array(buffer);
      wasmInstance.HEAPF64 = new Float64Array(buffer);
    }
  }
}

/**
 * Load and initialize the TagLib WebAssembly module for Cloudflare Workers
 *
 * @param wasmBinary - The WebAssembly binary as Uint8Array
 * @param config - Optional configuration for the Wasm module
 * @returns Promise resolving to initialized TagLib module
 *
 * @example
 * ```typescript
 * import wasmBinary from "../build/taglib.wasm";
 *
 * const taglib = await loadTagLibModuleForWorkers(wasmBinary);
 * ```
 */
export async function loadTagLibModuleForWorkers(
  wasmBinary: Uint8Array,
  config: TagLibWorkersConfig = {},
): Promise<TagLibModule> {
  const moduleConfig = createModuleConfig(wasmBinary, config);

  try {
    // For Workers, we need to use a modified version of the Emscripten output
    // that doesn't include Node.js/CommonJS dependencies
    const TagLibWasm = await createWorkersCompatibleModule();

    if (typeof TagLibWasm !== "function") {
      throw new TagLibInitializationError(
        "Failed to load TagLib-Wasm module for Workers. " +
          "The module may not be properly bundled for the Workers environment.",
      );
    }

    const wasmInstance = await TagLibWasm(moduleConfig);
    setupMemoryArrays(wasmInstance);

    return wasmInstance as TagLibModule;
  } catch (error) {
    if (error instanceof TagLibInitializationError) {
      throw error;
    }
    throw new TagLibInitializationError(
      `Failed to load TagLib-Wasm for Workers: ${(error as Error).message}`,
      { error: (error as Error).message },
    );
  }
}

/**
 * Create a Workers-compatible version of the Emscripten module
 * This function loads the Wasm module without Node.js/CommonJS dependencies
 */
async function createWorkersCompatibleModule(): Promise<any> {
  // In a real Workers environment, you would typically:
  // 1. Use a build process to create a Workers-compatible version of taglib.js
  // 2. Or inline the essential parts of the Emscripten runtime here
  // 3. Or use dynamic import with proper bundling

  // For now, we'll attempt to load the existing module with Workers compatibility
  try {
    // Try to import the existing module
    const wasmModule = await import("../build/taglib-wrapper.js");
    return wasmModule.default ?? wasmModule;
  } catch (error) {
    // If that fails, provide a fallback implementation
    throw new TagLibInitializationError(
      "Workers-compatible Wasm module not available. " +
        "Please build with Workers target or use a bundler that supports Wasm modules. " +
        `Original error: ${(error as Error).message}`,
      { error: (error as Error).message },
    );
  }
}

/**
 * Convert a C string pointer to JavaScript string (Workers-compatible)
 */
export function cStringToJS(module: TagLibModule, ptr: number): string {
  if (ptr === 0) return "";

  const view = new Uint8Array(module.HEAPU8.buffer, ptr);
  let length = 0;
  while (view[length] !== 0) length++;

  return new TextDecoder().decode(view.subarray(0, length));
}

/**
 * Convert JavaScript string to C string (Workers-compatible)
 * Note: This function allocates memory that must be freed by the caller
 * @deprecated Use WasmAlloc.writeCString() with emscriptenToWasmExports() instead
 */
export function jsToCString(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");

  // Use allocate if available, otherwise use _malloc
  if (module.allocate && module.ALLOC_NORMAL !== undefined) {
    return module.allocate(bytes, module.ALLOC_NORMAL);
  } else {
    const ptr = module._malloc(bytes.length);
    try {
      module.HEAPU8.set(bytes, ptr);
      return ptr;
    } catch (error) {
      // Free memory if set operation fails
      module._free(ptr);
      throw error;
    }
  }
}

/**
 * Utility function to check if we're running in Cloudflare Workers
 */
export function isCloudflareWorkers(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof globalThis.caches !== "undefined" &&
    typeof globalThis.Request !== "undefined" &&
    typeof globalThis.Response !== "undefined" &&
    typeof (globalThis as any).process === "undefined" &&
    typeof (globalThis as any).Deno === "undefined"
  );
}
