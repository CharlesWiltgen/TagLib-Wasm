/**
 * @fileoverview Deno compile support for taglib-wasm
 *
 * This module provides utilities to make taglib-wasm work seamlessly
 * with Deno compile by handling WASM loading appropriately.
 */

import type { LoadTagLibOptions } from "./runtime/loader-types.ts";

/**
 * Detects if running in a Deno compiled binary
 */
export function isDenoCompiled(): boolean {
  return typeof Deno !== "undefined" &&
    Deno.mainModule?.startsWith("file:///") &&
    Deno.execPath()?.includes("deno") === false;
}

/**
 * Enhanced WASM loading options for Deno compile
 */
export interface DenoCompileOptions extends LoadTagLibOptions {
  /**
   * Path to WASM file for runtime loading (not compiled binaries)
   */
  wasmPath?: string;

  /**
   * Fallback URL if local WASM is not found
   */
  fallbackUrl?: string;
}

/**
 * Smart WASM loader that handles both development and compiled environments
 *
 * @example
 * ```typescript
 * // In your application
 * import { TagLib } from "taglib-wasm";
 * import { loadWasmForDeno } from "taglib-wasm/deno-compile-support";
 *
 * const wasmBinary = await loadWasmForDeno();
 * const taglib = await TagLib.initialize({ wasmBinary });
 * ```
 */
export async function loadWasmForDeno(
  options: DenoCompileOptions = {},
): Promise<Uint8Array | undefined> {
  // Try different loading strategies
  const strategies = [
    // 1. User-provided binary
    async () => options.wasmBinary,

    // 2. Local file (development)
    async () => {
      if (typeof Deno !== "undefined" && !isDenoCompiled()) {
        try {
          const path = options.wasmPath ?? "./build/taglib.wasm";
          return await Deno.readFile(path);
        } catch {
          // File not found, try next strategy
        }
      }
    },

    // 3. Fetch from URL
    async () => {
      const url = options.wasmUrl ?? options.fallbackUrl ??
        "https://cdn.jsdelivr.net/npm/taglib-wasm@latest/dist/taglib.wasm";
      try {
        const response = await fetch(url);
        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }
      } catch {
        // Network error, try next strategy
      }
    },
  ];

  // Try each strategy in order
  for (const strategy of strategies) {
    const result = await strategy();
    if (result) {
      // Ensure we always return a Uint8Array
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    }
  }

  return undefined;
}

/**
 * Simplified initialization for Deno applications
 *
 * @example
 * ```typescript
 * import { initializeForDeno } from "taglib-wasm/deno-compile-support";
 *
 * // Works in development, production, and compiled binaries
 * const taglib = await initializeForDeno();
 * ```
 */
export async function initializeForDeno(options: DenoCompileOptions = {}) {
  const { TagLib } = await import("../src/taglib.ts");

  // Load WASM using the smart loader
  const wasmBinary = await loadWasmForDeno(options);

  if (!wasmBinary) {
    throw new Error(
      "Failed to load WASM module. " +
        "For compiled binaries, either bundle the WASM or ensure network access.",
    );
  }

  return TagLib.initialize({ wasmBinary });
}
