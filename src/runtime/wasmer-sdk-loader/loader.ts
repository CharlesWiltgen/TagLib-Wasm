/**
 * @fileoverview Main Wasmer WASI loader function
 */

import { Directory } from "@wasmer/sdk";
import type { WasiModule, WasmerLoaderConfig } from "./types.ts";
import { WasmerLoadError } from "./types.ts";
import { initializeWasmer, loadWasmBinary } from "./initialization.ts";
import { instantiateWasi } from "./wasi-stubs.ts";
import { createWasiModule } from "./module-creation.ts";

/**
 * Load WASI module using Wasmer SDK
 */
export async function loadWasmerWasi(
  config: WasmerLoaderConfig = {},
): Promise<WasiModule> {
  const {
    wasmPath = "./dist/taglib-wasi.wasm",
    useInlineWasm = false,
    mounts = {},
    env = {},
    args = [],
    debug = false,
  } = config;

  // Ensure SDK is initialized
  await initializeWasmer(useInlineWasm);

  if (debug) {
    console.log("[WasmerSDK] Loading WASI module from:", wasmPath);
  }

  try {
    // Load WASM binary
    const wasmBytes = await loadWasmBinary(wasmPath);

    // Create WebAssembly module
    const wasmModule = await WebAssembly.compile(wasmBytes as BufferSource);

    // Set up file system mounts
    const mountConfig: Record<string, Directory> = {
      "/": new Directory(), // Root directory
      ...mounts as Record<string, Directory>,
    };

    // Create WASI instance with Wasmer SDK
    const instance = await instantiateWasi(wasmModule, {
      env,
      args,
      mount: mountConfig,
    });

    // Extract exports and wrap in our interface
    return createWasiModule(instance, debug);
  } catch (error) {
    throw new WasmerLoadError(
      `Failed to load WASI module from ${wasmPath}: ${error}`,
      error,
    );
  }
}
