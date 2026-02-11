/**
 * @fileoverview Runtime environment detection for optimal WASM binary selection
 *
 * Detects the current JavaScript runtime environment and determines the optimal
 * WebAssembly binary to load (WASI for filesystem-heavy workloads, Emscripten
 * for browser compatibility).
 *
 * Priority order:
 * 1. Deno + WASI (optimal filesystem performance)
 * 2. Bun + WASI (via node:fs, check before Node)
 * 3. Node.js + WASI (when available)
 * 4. Browser + Emscripten (required for web)
 * 5. Node.js + Emscripten (fallback compatibility)
 */

/**
 * Supported runtime environments with their optimal WASM target
 */
export type RuntimeEnvironment =
  | "deno-wasi" // Deno with WASI support
  | "node-wasi" // Node.js with WASI support
  | "bun-wasi" // Bun with WASI support (via node:fs)
  | "browser" // Browser environment
  | "node-emscripten" // Node.js fallback
  | "worker" // Web Worker environment
  | "cloudflare"; // Cloudflare Workers

/**
 * WASM binary types that can be loaded
 */
export type WasmBinaryType = "wasi" | "emscripten";

/**
 * Runtime detection result with optimization hints
 */
export interface RuntimeDetectionResult {
  /** Detected runtime environment */
  environment: RuntimeEnvironment;
  /** Optimal WASM binary type for this environment */
  wasmType: WasmBinaryType;
  /** Whether filesystem operations are supported */
  supportsFilesystem: boolean;
  /** Whether streaming is supported for large files */
  supportsStreaming: boolean;
  /** Estimated performance tier (1=best, 3=fallback) */
  performanceTier: 1 | 2 | 3;
}

/**
 * Check if the current environment supports WASI
 */
function hasWASISupport(): boolean {
  // Deno has built-in WASI support via @wasmer/wasi
  if (typeof Deno !== "undefined") {
    return true;
  }

  // Node.js 16+ has experimental WASI support
  const globalAny = globalThis as any;
  if (
    typeof globalAny.process !== "undefined" && globalAny.process.versions?.node
  ) {
    const [major] = globalAny.process.versions.node.split(".").map(Number);
    return major >= 16;
  }

  return false;
}

/**
 * Check if running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Check if running in a Web Worker
 */
function isWebWorker(): boolean {
  const globalAny = globalThis as any;
  return typeof globalAny.WorkerGlobalScope !== "undefined" &&
    typeof globalAny.self !== "undefined" &&
    globalAny.self instanceof globalAny.WorkerGlobalScope;
}

/**
 * Check if running in Cloudflare Workers
 */
function isCloudflareWorker(): boolean {
  const globalAny = globalThis as any;
  return typeof caches !== "undefined" &&
    typeof Request !== "undefined" &&
    typeof addEventListener === "function" &&
    typeof Deno === "undefined" &&
    typeof globalAny.process === "undefined";
}

/**
 * Check if running in Bun (must check before Node — Bun sets process.versions.node)
 */
function isBun(): boolean {
  return typeof (globalThis as Record<string, unknown>).Bun !== "undefined";
}

/**
 * Check if running in Node.js
 */
function isNode(): boolean {
  const globalAny = globalThis as any;
  return typeof globalAny.process !== "undefined" &&
    globalAny.process.versions?.node !== undefined;
}

/**
 * Check if running in Deno
 */
function isDeno(): boolean {
  return typeof Deno !== "undefined";
}

/**
 * Detect the current runtime environment and determine optimal WASM binary
 */
export function detectRuntime(): RuntimeDetectionResult {
  // Priority 1: Deno with WASI (optimal for filesystem operations)
  if (isDeno() && hasWASISupport()) {
    return {
      environment: "deno-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  // Priority 2: Bun with WASI (via node:fs provider — check before Node)
  if (isBun()) {
    return {
      environment: "bun-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  // Priority 3: Node.js with WASI (good performance)
  if (isNode() && hasWASISupport()) {
    return {
      environment: "node-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  // Priority 4: Browser (requires Emscripten)
  if (isBrowser()) {
    return {
      environment: "browser",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: true,
      performanceTier: 2,
    };
  }

  // Priority 5: Web Worker (requires Emscripten)
  if (isWebWorker()) {
    return {
      environment: "worker",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: true,
      performanceTier: 2,
    };
  }

  // Priority 6: Cloudflare Workers (requires Emscripten)
  if (isCloudflareWorker()) {
    return {
      environment: "cloudflare",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: false, // Limited streaming capabilities
      performanceTier: 3,
    };
  }

  // Fallback: Node.js with Emscripten (compatibility mode)
  if (isNode()) {
    return {
      environment: "node-emscripten",
      wasmType: "emscripten",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 3,
    };
  }

  // Unknown environment - default to Emscripten for maximum compatibility
  return {
    environment: "browser", // Default assumption
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: true,
    performanceTier: 3,
  };
}

/**
 * Get human-readable description of the runtime environment
 */
export function getEnvironmentDescription(env: RuntimeEnvironment): string {
  switch (env) {
    case "deno-wasi":
      return "Deno with WASI (optimal filesystem performance)";
    case "node-wasi":
      return "Node.js with WASI (high performance)";
    case "bun-wasi":
      return "Bun with WASI (via node:fs)";
    case "browser":
      return "Browser with Emscripten (web compatibility)";
    case "worker":
      return "Web Worker with Emscripten";
    case "cloudflare":
      return "Cloudflare Workers (limited streaming)";
    case "node-emscripten":
      return "Node.js with Emscripten (fallback mode)";
    default:
      return "Unknown environment";
  }
}

/**
 * Check if the current environment can load a specific WASM binary type
 */
export function canLoadWasmType(wasmType: WasmBinaryType): boolean {
  const result = detectRuntime();

  if (wasmType === "wasi") {
    return result.environment === "deno-wasi" ||
      result.environment === "node-wasi" ||
      result.environment === "bun-wasi";
  }

  // Emscripten can be loaded in all environments
  return true;
}

/**
 * Force a specific runtime detection result (for testing)
 * @internal
 */
export function _forceRuntime(result: RuntimeDetectionResult): void {
  // This will be used by tests to simulate different environments
  (globalThis as any).__taglib_wasm_runtime_override = result;
}

/**
 * Clear forced runtime override (for testing)
 * @internal
 */
export function _clearRuntimeOverride(): void {
  delete (globalThis as any).__taglib_wasm_runtime_override;
}

/**
 * Get the current runtime detection result, respecting test overrides
 * @internal
 */
export function _getDetectionResult(): RuntimeDetectionResult {
  const override = (globalThis as any).__taglib_wasm_runtime_override;
  return override || detectRuntime();
}
