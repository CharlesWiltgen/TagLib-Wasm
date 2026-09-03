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

/**
 * The pure per-environment backend configuration. `detectRuntime()` is the
 * only sniffer in the codebase; every downstream decision (backend choice,
 * PlatformIO creation, WASI availability) derives from this table so it can
 * be exercised with synthetic environments instead of real runtimes
 * (taglib-2b4).
 */
export interface EnvironmentProfile {
  wasmType: WasmBinaryType;
  supportsFilesystem: boolean;
  supportsStreaming: boolean;
  performanceTier: 1 | 2 | 3;
}

const ENVIRONMENT_PROFILES: Record<RuntimeEnvironment, EnvironmentProfile> = {
  "deno-wasi": {
    wasmType: "wasi",
    supportsFilesystem: true,
    supportsStreaming: true,
    performanceTier: 1,
  },
  "node-wasi": {
    wasmType: "wasi",
    supportsFilesystem: true,
    supportsStreaming: true,
    performanceTier: 1,
  },
  "bun-wasi": {
    wasmType: "wasi",
    supportsFilesystem: true,
    supportsStreaming: true,
    performanceTier: 1,
  },
  browser: {
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: true,
    performanceTier: 2,
  },
  worker: {
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: true,
    performanceTier: 2,
  },
  cloudflare: {
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: false,
    performanceTier: 3,
  },
  "node-emscripten": {
    wasmType: "emscripten",
    supportsFilesystem: true,
    supportsStreaming: true,
    performanceTier: 3,
  },
};

/** Pure environment -> backend configuration lookup (taglib-2b4). */
export function environmentProfile(
  env: RuntimeEnvironment,
): EnvironmentProfile {
  return ENVIRONMENT_PROFILES[env];
}

const g = globalThis as Record<string, unknown>;

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 6;

/**
 * Check if a Node.js version meets the minimum requirement (v22.6.0+).
 * Returns an error message string if the version is too old, or undefined if OK.
 * Pass undefined for non-Node environments (always returns undefined).
 */
export function checkNodeVersion(
  nodeVersion: string | undefined,
): string | undefined {
  if (!nodeVersion) return undefined;
  const parts = nodeVersion.split(".").map(Number);
  const [major, minor] = parts;
  if (
    major < MIN_NODE_MAJOR ||
    (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)
  ) {
    return (
      `Node.js v${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 or higher is required. ` +
      `Current version: v${nodeVersion}. ` +
      `Older versions lack WASI and Wasm exception handling support.`
    );
  }
  return undefined;
}

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

/** Shared Deno-runtime check — do not hand-roll `typeof Deno` tests (taglib-rfr). */
export function isDeno(): boolean {
  return g.Deno !== undefined;
}

export function detectRuntime(): RuntimeDetectionResult {
  if (isDeno() && hasWASISupport()) {
    return { environment: "deno-wasi", ...environmentProfile("deno-wasi") };
  }

  if (isBun()) {
    return { environment: "bun-wasi", ...environmentProfile("bun-wasi") };
  }

  if (isNode() && hasWASISupport()) {
    return { environment: "node-wasi", ...environmentProfile("node-wasi") };
  }

  if (isBrowser()) {
    return { environment: "browser", ...environmentProfile("browser") };
  }

  if (isWebWorker()) {
    return { environment: "worker", ...environmentProfile("worker") };
  }

  if (isCloudflareWorker()) {
    return { environment: "cloudflare", ...environmentProfile("cloudflare") };
  }

  if (isNode()) {
    return {
      environment: "node-emscripten",
      ...environmentProfile("node-emscripten"),
    };
  }

  // Unknown embedder: report as browser-shaped but at the slowest tier —
  // the profile table cannot express this variant of "browser", so override.
  return {
    environment: "browser",
    ...environmentProfile("browser"),
    performanceTier: 3,
  };
}

// deno-fmt-ignore
const EXNREF_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // Wasm header
  0x06, 0x06,                                       // Global section, 6 bytes
  0x01,                                             // 1 global
  0x69, 0x00,                                       // exnref, const
  0xd0, 0x69, 0x0b,                                 // ref.null exnref, end
]);

/**
 * Detect whether the runtime supports the Wasm `exnref` type.
 * Uses `WebAssembly.validate()` with a minimal probe module — synchronous and zero-cost.
 */
export function supportsExnref(): boolean {
  try {
    return WebAssembly.validate(EXNREF_PROBE);
  } catch {
    return false;
  }
}

export function getEnvironmentDescription(env: RuntimeEnvironment): string {
  switch (env) {
    case "deno-wasi":
      return "Deno with WASI (optimal filesystem performance)";
    case "node-wasi":
      return "Node.js with WASI (high performance)";
    case "bun-wasi":
      return "Bun with WASI (Bun-native file I/O)";
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

export function canLoadWasmType(
  wasmType: WasmBinaryType,
  env: RuntimeEnvironment = detectRuntime().environment,
): boolean {
  if (wasmType === "wasi") {
    return environmentProfile(env).wasmType === "wasi";
  }
  return true;
}
