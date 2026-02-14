/**
 * @fileoverview Runtime-specific WASI loaders
 *
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */

import type { WasiExports, WasiLoaderConfig } from "./types.ts";

/**
 * Load WASI WebAssembly module with Deno's @wasmer/wasi
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export async function loadWithWasmerWasi(
  config: WasiLoaderConfig,
): Promise<WasiExports> {
  try {
    // Dynamic import to avoid issues in non-Deno environments
    const wasmerModule = await import("@wasmer/wasi");
    const { init, WASI } = wasmerModule;

    if (config.debug) {
      console.log("[WASI Loader] Initializing @wasmer/wasi");
    }

    // Initialize the WASI module (required in v1.x)
    await init();

    // Configure WASI with filesystem access
    const wasi = new WASI({
      env: config.env || {},
      args: [],
      preopens: {
        "/": Deno.cwd(), // Default to current directory
        ...config.preopens,
      },
    });

    // Load WASM binary
    let wasmBytes: Uint8Array;
    try {
      if (config.wasmPath?.startsWith("http")) {
        const response = await fetch(config.wasmPath);
        wasmBytes = new Uint8Array(await response.arrayBuffer());
      } else {
        wasmBytes = await Deno.readFile(config.wasmPath!);
      }
    } catch (error) {
      throw new Error(
        `Failed to load WASM binary from ${config.wasmPath}: ${error}`,
      );
    }

    if (config.debug) {
      console.log(
        `[WASI Loader] Loaded ${wasmBytes.length} bytes from ${config.wasmPath}`,
      );
    }

    // Compile and instantiate using WASI's instantiate method (v1.x API)
    const module = await WebAssembly.compile(wasmBytes as BufferSource);
    const instance = await wasi.instantiate(module, {});

    // Start WASI (instance already set by instantiate in v1.x)
    wasi.start();

    if (config.debug) {
      console.log("[WASI Loader] WASI module loaded successfully");
    }

    return instance.exports as unknown as WasiExports;
  } catch (error) {
    throw new Error(`Failed to load WASI module with @wasmer/wasi: ${error}`);
  }
}

/**
 * Load WASI WebAssembly module with Node.js built-in WASI (experimental)
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export async function loadWithNodeWasi(
  config: WasiLoaderConfig,
): Promise<WasiExports> {
  try {
    // Dynamic import for Node.js WASI
    const { WASI } = await import("node:wasi");
    const fs = await import("node:fs/promises");

    if (config.debug) {
      console.log("[WASI Loader] Using Node.js built-in WASI");
    }

    // Configure WASI
    const wasi = new WASI({
      version: "preview1",
      env: config.env || {},
      args: [],
      preopens: {
        "/": (globalThis as any).process?.cwd?.() || "/",
        ...config.preopens,
      },
    } as any);

    // Load WASM binary
    let wasmBytes: Uint8Array;
    try {
      if (config.wasmPath?.startsWith("http")) {
        const response = await fetch(config.wasmPath);
        wasmBytes = new Uint8Array(await response.arrayBuffer());
      } else {
        wasmBytes = await fs.readFile(config.wasmPath!);
      }
    } catch (error) {
      throw new Error(
        `Failed to load WASM binary from ${config.wasmPath}: ${error}`,
      );
    }

    if (config.debug) {
      console.log(
        `[WASI Loader] Loaded ${wasmBytes.length} bytes from ${config.wasmPath}`,
      );
    }

    // Compile and instantiate
    const module = await WebAssembly.compile(wasmBytes as BufferSource);
    const instance = await WebAssembly.instantiate(
      module,
      wasi.getImportObject() as any,
    );

    // Initialize WASI
    wasi.start(instance);

    if (config.debug) {
      console.log("[WASI Loader] Node.js WASI module loaded successfully");
    }

    return instance.exports as unknown as WasiExports;
  } catch (error) {
    throw new Error(`Failed to load WASI module with Node.js: ${error}`);
  }
}
