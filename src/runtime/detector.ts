export type RuntimeEnvironment =
  | "deno-wasi"
  | "node-wasi"
  | "bun-wasi"
  | "browser"
  | "node-emscripten"
  | "worker"
  | "cloudflare";

export type WasmBinaryType = "wasi" | "emscripten";

export interface RuntimeDetectionResult {
  environment: RuntimeEnvironment;
  wasmType: WasmBinaryType;
  supportsFilesystem: boolean;
  supportsStreaming: boolean;
  performanceTier: 1 | 2 | 3;
}

const g = globalThis as Record<string, unknown>;

function hasWASISupport(): boolean {
  if (g.Deno !== undefined) return true;
  if (g.process !== undefined && (g.process as any).versions?.node) {
    const [major] = (g.process as any).versions.node.split(".").map(Number);
    return major >= 16;
  }
  return false;
}

function isBrowser(): boolean {
  return g.window !== undefined && g.document !== undefined;
}

function isWebWorker(): boolean {
  return g.WorkerGlobalScope !== undefined &&
    g.self !== undefined &&
    g.self instanceof (g.WorkerGlobalScope as any);
}

function isCloudflareWorker(): boolean {
  return g.caches !== undefined &&
    g.Request !== undefined &&
    typeof g.addEventListener === "function" &&
    g.Deno === undefined &&
    g.process === undefined;
}

// Must check before Node — Bun sets process.versions.node
function isBun(): boolean {
  return g.Bun !== undefined;
}

function isNode(): boolean {
  return g.process !== undefined &&
    (g.process as any).versions?.node !== undefined;
}

function isDeno(): boolean {
  return g.Deno !== undefined;
}

export function detectRuntime(): RuntimeDetectionResult {
  if (isDeno() && hasWASISupport()) {
    return {
      environment: "deno-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  if (isBun()) {
    return {
      environment: "bun-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  if (isNode() && hasWASISupport()) {
    return {
      environment: "node-wasi",
      wasmType: "wasi",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 1,
    };
  }

  if (isBrowser()) {
    return {
      environment: "browser",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: true,
      performanceTier: 2,
    };
  }

  if (isWebWorker()) {
    return {
      environment: "worker",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: true,
      performanceTier: 2,
    };
  }

  if (isCloudflareWorker()) {
    return {
      environment: "cloudflare",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: false,
      performanceTier: 3,
    };
  }

  if (isNode()) {
    return {
      environment: "node-emscripten",
      wasmType: "emscripten",
      supportsFilesystem: true,
      supportsStreaming: true,
      performanceTier: 3,
    };
  }

  return {
    environment: "browser",
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: true,
    performanceTier: 3,
  };
}

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

export function canLoadWasmType(wasmType: WasmBinaryType): boolean {
  const result = detectRuntime();
  if (wasmType === "wasi") {
    return result.environment === "deno-wasi" ||
      result.environment === "node-wasi" ||
      result.environment === "bun-wasi";
  }
  return true;
}

/** @internal */
export function _forceRuntime(result: RuntimeDetectionResult): void {
  (globalThis as any).__taglib_wasm_runtime_override = result;
}

/** @internal */
export function _clearRuntimeOverride(): void {
  delete (globalThis as any).__taglib_wasm_runtime_override;
}

/** @internal */
export function _getDetectionResult(): RuntimeDetectionResult {
  const override = (globalThis as any).__taglib_wasm_runtime_override;
  return override || detectRuntime();
}
