import { detectRuntime, type RuntimeDetectionResult } from "../detector.ts";
import type { UnifiedLoaderOptions } from "./types.ts";

export function selectWasmType(
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): "wasi" | "emscripten" {
  if (options.forceWasmType) {
    return options.forceWasmType;
  }

  if (options.disableOptimizations) {
    return "emscripten";
  }

  if (runtime.wasmType === "wasi" && runtime.supportsFilesystem) {
    return "wasi";
  }

  return "emscripten";
}

export function isWasiAvailable(): boolean {
  const runtime = detectRuntime();
  return runtime.wasmType === "wasi" && runtime.supportsFilesystem;
}

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
