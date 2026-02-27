import type { RuntimeDetectionResult } from "../detector.ts";
import type { WasiModule } from "../wasmer-sdk-loader/index.ts";
import type { TagLibModule } from "../../wasm.ts";
import { TagLibError } from "../../errors/base.ts";

export class UnifiedLoaderError extends TagLibError {
  constructor(message: string, cause?: unknown) {
    super("MODULE_LOAD", message, cause ? { cause } : undefined);
    this.name = "UnifiedLoaderError";
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, UnifiedLoaderError.prototype);
  }
}

export class ModuleLoadError extends TagLibError {
  constructor(
    message: string,
    public readonly wasmType: "wasi" | "emscripten",
    cause?: unknown,
  ) {
    super("MODULE_LOAD", message, cause ? { cause, wasmType } : { wasmType });
    this.name = "ModuleLoadError";
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, ModuleLoadError.prototype);
  }
}

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

export interface PerformanceMetrics {
  initTime: number;
  wasmType: "wasi" | "emscripten";
  environment: string;
  memoryUsage?: number;
}

export interface LoadModuleResult {
  module: TagLibModule | WasiModule;
  actualWasmType: "wasi" | "emscripten";
}
