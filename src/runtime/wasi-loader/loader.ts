/**
 * @fileoverview WASI loader with runtime auto-detection and capability checks
 *
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */

import type { WasiExports, WasiLoaderConfig } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { loadWithNodeWasi, loadWithWasmerWasi } from "./runtime-loaders.ts";

/**
 * Primary WASI loader function with automatic runtime detection
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export async function loadWasi(
  userConfig: Partial<WasiLoaderConfig> = {},
): Promise<WasiExports> {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  if (config.debug) {
    console.log("[WASI Loader] Loading WASI module with config:", config);
  }

  // Try Deno's @wasmer/wasi first (optimal for Deno)
  if (typeof Deno !== "undefined") {
    try {
      return await loadWithWasmerWasi(config);
    } catch (error) {
      if (config.debug) {
        console.warn("[WASI Loader] @wasmer/wasi failed, falling back:", error);
      }
    }
  }

  // Try Node.js built-in WASI (experimental but native)
  const globalAny = globalThis as any;
  if (
    typeof globalAny.process !== "undefined" && globalAny.process.versions?.node
  ) {
    try {
      return await loadWithNodeWasi(config);
    } catch (error) {
      if (config.debug) {
        console.warn("[WASI Loader] Node.js WASI failed:", error);
      }
    }
  }

  // No WASI support available
  throw new Error(
    "WASI not supported in this environment. " +
      "Ensure you're running in Deno or Node.js 16+ with WASI support.",
  );
}

/**
 * Check if WASI is available in the current environment
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export async function isWasiAvailable(): Promise<boolean> {
  try {
    // Quick check for Deno + @wasmer/wasi
    if (typeof Deno !== "undefined") {
      try {
        await import("@wasmer/wasi");
        return true;
      } catch {
        // @wasmer/wasi not available, but that's ok
        return false;
      }
    }

    // Quick check for Node.js WASI
    const globalAny = globalThis as any;
    if (
      typeof globalAny.process !== "undefined" &&
      globalAny.process.versions?.node
    ) {
      try {
        await import("node:wasi");
        return true;
      } catch {
        // Node WASI not available
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get WASI capability information for the current environment
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export async function getWasiCapabilities(): Promise<{
  available: boolean;
  runtime: "deno" | "node" | "unknown";
  version?: string;
  features: {
    filesystem: boolean;
    networking: boolean;
    threading: boolean;
  };
}> {
  const available = await isWasiAvailable();

  if (typeof Deno !== "undefined") {
    return {
      available,
      runtime: "deno",
      version: Deno.version.deno,
      features: {
        filesystem: true,
        networking: true,
        threading: false,
      },
    };
  }

  const globalAny = globalThis as any;
  if (
    typeof globalAny.process !== "undefined" && globalAny.process.versions?.node
  ) {
    return {
      available,
      runtime: "node",
      version: globalAny.process.versions.node,
      features: {
        filesystem: true,
        networking: false,
        threading: false,
      },
    };
  }

  return {
    available: false,
    runtime: "unknown",
    features: {
      filesystem: false,
      networking: false,
      threading: false,
    },
  };
}
