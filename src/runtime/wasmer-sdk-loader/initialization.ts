/**
 * @fileoverview Wasmer SDK initialization and WASM binary loading
 */

import { init } from "@wasmer/sdk";
import { WasmerInitError } from "./types.ts";

// Track initialization state
let isInitialized = false;

/**
 * Initialize Wasmer SDK (must be called once before any Wasmer APIs)
 */
export async function initializeWasmer(useInline = false): Promise<void> {
  if (isInitialized) return;

  try {
    if (useInline) {
      // Try to use inline WASM for deno compile/bundle
      try {
        const wasmInline = await import("@wasmer/sdk/wasm-inline");
        await init({ module: wasmInline.default || wasmInline });
      } catch {
        // Fall back to standard init if inline fails
        await init();
      }
    } else {
      // Standard initialization
      await init();
    }
    isInitialized = true;
  } catch (error) {
    throw new WasmerInitError(
      `Failed to initialize Wasmer SDK: ${error}`,
      error,
    );
  }
}

/**
 * Load WASM binary from file or URL
 */
export async function loadWasmBinary(path: string): Promise<Uint8Array> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } else {
    const { readFileData } = await import("../../utils/file.ts");
    return await readFileData(path);
  }
}

/**
 * Check if Wasmer SDK is available and can be initialized
 */
export async function isWasmerAvailable(): Promise<boolean> {
  try {
    await initializeWasmer();
    return true;
  } catch {
    return false;
  }
}
