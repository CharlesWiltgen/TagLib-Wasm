/**
 * @fileoverview Refactored unified loader with reduced complexity
 *
 * Addresses code review issues:
 * - Reduced cyclomatic complexity
 * - No circular dependencies
 * - Proper error handling with branded types
 * - Functions under 50 lines
 * - Clean async/await patterns
 */

import { detectRuntime, type RuntimeDetectionResult } from "./detector.ts";
import {
  initializeWasmer,
  isWasmerAvailable,
  loadWasmerWasi,
  type WasiModule,
  type WasmerLoadError,
} from "./wasmer-sdk-loader.ts";
import type { TagLibModule } from "../wasm.ts";

// Branded error types
export class UnifiedLoaderError extends Error {
  readonly code = "UNIFIED_LOADER_ERROR" as const;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "UnifiedLoaderError";
  }
}

export class ModuleLoadError extends Error {
  readonly code = "MODULE_LOAD_ERROR" as const;
  constructor(
    message: string,
    public readonly wasmType: "wasi" | "emscripten",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ModuleLoadError";
  }
}

/**
 * Unified module configuration
 */
export interface UnifiedLoaderOptions {
  /** Force specific WASM type */
  forceWasmType?: "wasi" | "emscripten";
  /** Disable optimizations for debugging */
  disableOptimizations?: boolean;
  /** Custom WASM binary path or data */
  wasmBinary?: ArrayBuffer | Uint8Array;
  /** Custom WASM URL */
  wasmUrl?: string;
  /** Enable debug output */
  debug?: boolean;
  /** Use inline WASM for bundling */
  useInlineWasm?: boolean;
}

/**
 * Extended TagLib module with runtime info
 */
export interface UnifiedTagLibModule extends TagLibModule {
  /** Runtime environment info */
  runtime: RuntimeDetectionResult;
  /** Whether using WASI implementation */
  isWasi: boolean;
  /** Whether using Emscripten implementation */
  isEmscripten: boolean;
  /** Get performance metrics */
  getPerformanceMetrics?: () => PerformanceMetrics;
}

interface PerformanceMetrics {
  initTime: number;
  wasmType: "wasi" | "emscripten";
  environment: string;
  memoryUsage?: number;
}

/**
 * Main unified loader with reduced complexity
 */
export async function loadUnifiedTagLibModule(
  options: UnifiedLoaderOptions = {},
): Promise<UnifiedTagLibModule> {
  const startTime = performance.now();
  const runtime = detectRuntime();

  if (options.debug) {
    console.log(`[UnifiedLoader] Detected runtime: ${runtime.environment}`);
  }

  // Determine which WASM type to use
  const wasmType = await selectWasmType(runtime, options);

  if (options.debug) {
    console.log(
      `[UnifiedLoader] Selected ${wasmType} for ${runtime.environment}`,
    );
  }

  // Load the appropriate module
  const module = await loadModule(wasmType, runtime, options);

  // Wrap with unified interface
  const unifiedModule = await createUnifiedModule(
    module,
    runtime,
    wasmType,
    startTime,
  );

  if (options.debug) {
    const initTime = performance.now() - startTime;
    console.log(`[UnifiedLoader] Initialized in ${initTime.toFixed(2)}ms`);
  }

  return unifiedModule;
}

/**
 * Select optimal WASM type based on runtime and options
 * (Extracted to reduce complexity)
 */
async function selectWasmType(
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): Promise<"wasi" | "emscripten"> {
  // Honor forced type if specified
  if (options.forceWasmType) {
    return options.forceWasmType;
  }

  // Use Emscripten if optimizations are disabled
  if (options.disableOptimizations) {
    return "emscripten";
  }

  // Check if WASI is available and suitable
  if (runtime.supportsFilesystem && await isWasmerAvailable()) {
    return "wasi";
  }

  // Default to Emscripten for compatibility
  return "emscripten";
}

/**
 * Load the appropriate WASM module
 * (Extracted to reduce complexity)
 */
async function loadModule(
  wasmType: "wasi" | "emscripten",
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): Promise<TagLibModule | WasiModule> {
  if (wasmType === "wasi") {
    return await loadWasiModule(options);
  } else {
    return await loadEmscriptenModule(options);
  }
}

/**
 * Load WASI module with proper error handling
 */
async function loadWasiModule(
  options: UnifiedLoaderOptions,
): Promise<WasiModule> {
  try {
    // Initialize Wasmer SDK
    await initializeWasmer(options.useInlineWasm);

    // Load WASI module
    const wasiModule = await loadWasmerWasi({
      wasmPath: options.wasmUrl || "./dist/wasi/taglib_wasi.wasm",
      useInlineWasm: options.useInlineWasm,
      debug: options.debug,
    });

    return wasiModule;
  } catch (error) {
    // If WASI fails, fall back to Emscripten
    if (options.debug) {
      console.warn(
        `[UnifiedLoader] WASI loading failed, falling back to Emscripten:`,
        error,
      );
    }

    // Fallback to Emscripten
    return await loadEmscriptenModule(options);
  }
}

/**
 * Load Emscripten module
 */
async function loadEmscriptenModule(
  options: UnifiedLoaderOptions,
): Promise<TagLibModule> {
  try {
    // Dynamic import to avoid bundling when not needed
    let createModule: any;

    // Try different paths for the wrapper
    try {
      const module = await import("../../build/taglib-wrapper.js");
      createModule = module.default;
    } catch {
      try {
        const module = await import("../../dist/taglib-wrapper.js");
        createModule = module.default;
      } catch {
        throw new ModuleLoadError(
          "Could not load Emscripten module from build or dist",
          "emscripten",
        );
      }
    }

    // Configure module
    const moduleConfig: any = {};
    if (options.wasmBinary) {
      moduleConfig.wasmBinary = options.wasmBinary;
    }
    if (options.wasmUrl) {
      moduleConfig.locateFile = (path: string) => {
        return path.endsWith(".wasm") ? options.wasmUrl! : path;
      };
    }

    // Load and return
    const module = await createModule(moduleConfig);
    return module as TagLibModule;
  } catch (error) {
    throw new ModuleLoadError(
      `Failed to load Emscripten module: ${error}`,
      "emscripten",
      error,
    );
  }
}

/**
 * Create unified module wrapper
 * (Simplified - under 50 lines)
 */
async function createUnifiedModule(
  module: TagLibModule | WasiModule,
  runtime: RuntimeDetectionResult,
  wasmType: "wasi" | "emscripten",
  startTime: number,
): Promise<UnifiedTagLibModule> {
  const isWasi = wasmType === "wasi";
  const initTime = performance.now() - startTime;

  if (isWasi) {
    // Wrap WASI module to match TagLibModule interface
    const wasiModule = module as WasiModule;
    const adapter = await createWasiAdapter(wasiModule);
    return {
      ...adapter,
      runtime,
      isWasi: true,
      isEmscripten: false,
      getPerformanceMetrics: () => ({
        initTime,
        wasmType: "wasi",
        environment: runtime.environment,
        memoryUsage: wasiModule.memory.buffer.byteLength,
      }),
    };
  } else {
    // Emscripten module already has correct interface
    const emscriptenModule = module as TagLibModule;
    return {
      ...emscriptenModule,
      runtime,
      isWasi: false,
      isEmscripten: true,
      getPerformanceMetrics: () => ({
        initTime,
        wasmType: "emscripten",
        environment: runtime.environment,
        memoryUsage: emscriptenModule.HEAP8?.buffer.byteLength,
      }),
    };
  }
}

/**
 * Create adapter to make WASI module compatible with TagLibModule interface
 * (Simplified - delegates to separate file for complex implementation)
 */
async function createWasiAdapter(
  wasiModule: WasiModule,
): Promise<TagLibModule> {
  // Import the complex adapter from a separate file to keep this simple
  // This avoids the 134-line function issue identified in the review
  const { WasiToTagLibAdapter } = await import("./wasi-adapter.ts");
  return new WasiToTagLibAdapter(wasiModule);
}

/**
 * Get recommended configuration for current environment
 */
export function getRecommendedConfig(): UnifiedLoaderOptions {
  const runtime = detectRuntime();

  if (runtime.environment === "cloudflare-workers") {
    return {
      forceWasmType: "emscripten",
      useInlineWasm: true,
    };
  }

  if (runtime.environment === "browser") {
    return {
      forceWasmType: "emscripten",
      disableOptimizations: false,
    };
  }

  if (runtime.supportsFilesystem) {
    return {
      forceWasmType: "wasi",
      useInlineWasm: false,
    };
  }

  return {
    disableOptimizations: false,
  };
}
