/**
 * @fileoverview Unified loader that selects optimal WASM implementation
 *
 * Automatically detects the runtime environment and loads either:
 * - WASI-based implementation for Deno/Node.js (faster filesystem access)
 * - Emscripten-based implementation for browsers (universal compatibility)
 *
 * Addresses code review issues:
 * - Reduced cyclomatic complexity
 * - No circular dependencies
 * - Proper error handling with branded types
 * - Functions under 50 lines
 * - Clean async/await patterns
 */

import { detectRuntime, type RuntimeDetectionResult } from "./detector.ts";
import type { WasiModule } from "./wasmer-sdk-loader.ts";
import type { TagLibModule } from "../wasm.ts";

// Branded error types
export class UnifiedLoaderError extends Error {
  readonly code = "UNIFIED_LOADER_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UnifiedLoaderError";
    this.cause = cause;
  }
}

export class ModuleLoadError extends Error {
  readonly code = "MODULE_LOAD_ERROR" as const;
  constructor(
    message: string,
    public readonly wasmType: "wasi" | "emscripten",
    cause?: unknown,
  ) {
    super(message);
    this.name = "ModuleLoadError";
    this.cause = cause;
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
  const wasmType = selectWasmType(runtime, options);

  if (options.debug) {
    console.log(
      `[UnifiedLoader] Selected ${wasmType} for ${runtime.environment}`,
    );
  }

  // Load the appropriate module (with fallback tracking)
  const { module, actualWasmType } = await loadModule(
    wasmType,
    runtime,
    options,
  );

  // Wrap with unified interface using actual type (may differ due to fallback)
  const unifiedModule = await createUnifiedModule(
    module,
    runtime,
    actualWasmType,
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
 */
function selectWasmType(
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): "wasi" | "emscripten" {
  // Honor forced type if specified
  if (options.forceWasmType) {
    return options.forceWasmType;
  }

  // Use Emscripten if optimizations are disabled
  if (options.disableOptimizations) {
    return "emscripten";
  }

  // Use WASI when the detector determined it's the optimal path
  if (runtime.wasmType === "wasi" && runtime.supportsFilesystem) {
    return "wasi";
  }

  // Default to Emscripten for compatibility
  return "emscripten";
}

interface LoadModuleResult {
  module: TagLibModule | WasiModule;
  actualWasmType: "wasi" | "emscripten";
}

/**
 * Load the appropriate WASM module with fallback tracking
 */
async function loadModule(
  wasmType: "wasi" | "emscripten",
  _runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): Promise<LoadModuleResult> {
  if (wasmType === "wasi") {
    return await loadWasiModuleWithFallback(options);
  } else {
    return {
      module: await loadEmscriptenModule(options),
      actualWasmType: "emscripten",
    };
  }
}

/**
 * Load WASI module with proper error handling and fallback to Emscripten
 */
async function loadWasiModuleWithFallback(
  options: UnifiedLoaderOptions,
): Promise<LoadModuleResult> {
  try {
    // Lazy-load Wasmer SDK (avoids failing in environments without @wasmer/sdk)
    const { initializeWasmer, loadWasmerWasi } = await import(
      "./wasmer-sdk-loader.ts"
    );

    await initializeWasmer(options.useInlineWasm);

    const wasiModule = await loadWasmerWasi({
      wasmPath: options.wasmUrl || "./dist/taglib-wasi.wasm",
      useInlineWasm: options.useInlineWasm,
      debug: options.debug,
    });

    return { module: wasiModule, actualWasmType: "wasi" };
  } catch (error) {
    // If WASI fails, fall back to Emscripten
    if (options.debug) {
      console.warn(
        `[UnifiedLoader] WASI loading failed, falling back to Emscripten:`,
        error,
      );
    }

    // Fallback to Emscripten - return correct type
    return {
      module: await loadEmscriptenModule(options),
      actualWasmType: "emscripten",
    };
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
    let createModule: (config?: unknown) => Promise<TagLibModule>;

    // Try different paths for the wrapper
    try {
      // @ts-ignore: Dynamic import handled at runtime
      const module = await import("../../build/taglib-wrapper.js");
      createModule = module.default as (
        config?: unknown,
      ) => Promise<TagLibModule>;
    } catch {
      try {
        // @ts-ignore: Dynamic import handled at runtime
        const module = await import("../../dist/taglib-wrapper.js");
        createModule = module.default as (
          config?: unknown,
        ) => Promise<TagLibModule>;
      } catch {
        throw new ModuleLoadError(
          "Could not load Emscripten module from build or dist",
          "emscripten",
        );
      }
    }

    // Configure module
    const moduleConfig: Record<string, unknown> = {};
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
    // Add additional properties to the adapter instance
    // Note: Object.assign copies to the instance, preserving prototype methods
    return Object.assign(adapter, {
      runtime,
      isWasi: true,
      isEmscripten: false,
      getPerformanceMetrics: () => ({
        initTime,
        wasmType: "wasi",
        environment: runtime.environment,
        memoryUsage: wasiModule.memory.buffer.byteLength,
      }),
    }) as UnifiedTagLibModule;
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
 */
async function createWasiAdapter(
  wasiModule: WasiModule,
): Promise<TagLibModule> {
  const { WasiToTagLibAdapter } = await import("./wasi-adapter.ts");
  return new WasiToTagLibAdapter(wasiModule);
}

/**
 * Check if WASI is available in the current environment
 */
export function isWasiAvailable(): boolean {
  const runtime = detectRuntime();
  return runtime.wasmType === "wasi" && runtime.supportsFilesystem;
}

/**
 * Get recommended configuration for current environment
 */
export function getRecommendedConfig(): UnifiedLoaderOptions {
  const runtime = detectRuntime();

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
      disableOptimizations: false,
    };
  }

  return {
    disableOptimizations: false,
  };
}
