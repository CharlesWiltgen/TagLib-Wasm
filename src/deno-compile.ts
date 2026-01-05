/**
 * @fileoverview Helper utilities for using taglib-wasm in Deno compiled binaries
 *
 * This module provides simplified initialization for offline usage in compiled
 * Deno binaries, with automatic detection and embedded WASM loading.
 *
 * @module taglib-wasm/deno-compile
 */

import { TagLib } from "./taglib.ts";

/**
 * Detects if the code is running in a compiled Deno binary.
 *
 * @returns true if running in a Deno compiled binary, false otherwise
 */
export function isDenoCompiled(): boolean {
  // Check if Deno is available and if the main module indicates compilation
  // @ts-ignore: Deno global is only available in Deno runtime
  return typeof Deno !== "undefined" &&
    // @ts-ignore: Deno global is only available in Deno runtime
    typeof Deno.mainModule === "string" &&
    // @ts-ignore: Deno global is only available in Deno runtime
    Deno.mainModule.includes("deno-compile://");
}

/**
 * Initialize TagLib with automatic handling for Deno compiled binaries.
 *
 * In compiled binaries, this function attempts to load embedded WASM from a
 * specified path relative to the binary. If the embedded WASM is not found
 * or if running in development mode, it falls back to network fetch.
 *
 * @param embeddedWasmPath - Path to embedded WASM file (default: './taglib-web.wasm')
 * @returns Promise resolving to initialized TagLib instance
 *
 * @example
 * ```typescript
 * // Basic usage with default path
 * const taglib = await initializeForDenoCompile();
 *
 * // Custom embedded WASM path
 * const taglib = await initializeForDenoCompile('./assets/taglib-web.wasm');
 *
 * // Compile command:
 * // deno compile --allow-read --include taglib-web.wasm myapp.ts
 * ```
 */
export async function initializeForDenoCompile(
  embeddedWasmPath = "./taglib-web.wasm",
): Promise<TagLib> {
  // Only attempt embedded loading in compiled binaries
  if (isDenoCompiled()) {
    try {
      // Try to load the embedded WASM file
      const wasmUrl = new URL(embeddedWasmPath, import.meta.url);
      // @ts-ignore: Deno global is only available in Deno runtime
      const wasmBinary = await Deno.readFile(wasmUrl);

      // Initialize with the embedded binary
      return await TagLib.initialize({ wasmBinary });
    } catch (error) {
      // Log warning but don't fail - fall back to network
      console.warn(
        `Could not load embedded WASM from ${embeddedWasmPath}:`,
        error,
      );
      console.warn("Falling back to network fetch (requires --allow-net)");
    }
  }

  // Fall back to default network-based initialization
  return await TagLib.initialize();
}

/**
 * Helper function to prepare a WASM file for embedding in a compiled binary.
 * This function copies the WASM file from node_modules to a local path.
 *
 * @param outputPath - Where to save the WASM file (default: './taglib-web.wasm')
 *
 * @example
 * ```typescript
 * // In your build script:
 * await prepareWasmForEmbedding('./assets/taglib-web.wasm');
 *
 * // Then compile with:
 * // deno compile --allow-read --include assets/taglib-web.wasm myapp.ts
 * ```
 */
export async function prepareWasmForEmbedding(
  outputPath = "./taglib-web.wasm",
): Promise<void> {
  try {
    // Try to find the WASM file in common locations
    const possiblePaths = [
      new URL("../dist/taglib-web.wasm", import.meta.url),
      new URL("../build/taglib-web.wasm", import.meta.url),
      new URL(
        "./node_modules/taglib-wasm/dist/taglib-web.wasm",
        import.meta.url,
      ),
    ];

    let wasmData: Uint8Array | null = null;
    let sourcePath: string | null = null;

    for (const path of possiblePaths) {
      try {
        // @ts-ignore: Deno global is only available in Deno runtime
        wasmData = await Deno.readFile(path);
        sourcePath = path.pathname;
        break;
      } catch {
        // Try next path
      }
    }

    if (!wasmData || !sourcePath) {
      throw new Error("Could not find taglib-web.wasm in expected locations");
    }

    // Write to output path
    // @ts-ignore: Deno global is only available in Deno runtime
    await Deno.writeFile(outputPath, wasmData);
    console.log(`WASM file copied from ${sourcePath} to ${outputPath}`);
    console.log(
      `Include this file when compiling: deno compile --include ${outputPath} ...`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to prepare WASM for embedding: ${message}`);
  }
}
