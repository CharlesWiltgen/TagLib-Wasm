import { detectRuntime, type RuntimeDetectionResult } from "../detector.ts";
import type { UnifiedLoaderOptions } from "./types.ts";

export function selectWasmType(
  runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): "wasi" | "emscripten" {
  if (options.forceWasmType) {
    return options.forceWasmType;
  }

  // wasmBinary is Emscripten-only: the WASI host loads from a path/URL and
  // would silently ignore supplied bytes (taglib-pbz). Route deterministically
  // so the documented offline pattern never depends on fallback accidents.
  if (options.wasmBinary) {
    return "emscripten";
  }

  if (options.disableOptimizations) {
    return "emscripten";
  }

  if (runtime.wasmType === "wasi" && runtime.supportsFilesystem) {
    return "wasi";
  }

  return "emscripten";
}

export function isWasiAvailable(
  runtime: RuntimeDetectionResult = detectRuntime(),
): boolean {
  return runtime.wasmType === "wasi" && runtime.supportsFilesystem;
}

export function getRecommendedConfig(
  runtime: RuntimeDetectionResult = detectRuntime(),
): UnifiedLoaderOptions {
  if (runtime.environment === "browser") {
    return {
      forceWasmType: "emscripten",
      disableOptimizations: false,
    };
  }

  // Same predicate as isWasiAvailable/selectWasmType: node-emscripten has a
  // filesystem but no WASI backend, so forcing "wasi" there would select a
  // binary the runtime cannot load (taglib-2b4).
  if (runtime.wasmType === "wasi" && runtime.supportsFilesystem) {
    return {
      forceWasmType: "wasi",
      disableOptimizations: false,
    };
  }

  return {
    disableOptimizations: false,
  };
}
