/**
 * @fileoverview Helper utilities for using TagLib-Wasm in Deno compiled binaries
 *
 * This module provides simplified initialization for offline usage in compiled
 * Deno binaries, with automatic detection and embedded WASM loading.
 *
 * @module taglib-wasm/deno-compile
 */

import { TagLib } from "./taglib.ts";
import { FileOperationError } from "./errors/classes.ts";
import { isDenoCompiled } from "./runtime/deno-detect.ts";
export { isDenoCompiled } from "./runtime/deno-detect.ts";

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
    const strategies: Array<() => Promise<Uint8Array>> = [
      // Relative to user's entry point (where --include embeds files)
      () => Deno.readFile(new URL(embeddedWasmPath, Deno.mainModule)),
      // Relative to this library module
      () => Deno.readFile(new URL(embeddedWasmPath, import.meta.url)),
      // CWD fallback (last resort — depends on where the binary is invoked)
      () => Deno.readFile(embeddedWasmPath),
    ];

    for (const strategy of strategies) {
      try {
        const wasmBinary = await strategy();
        return await TagLib.initialize({ wasmBinary, forceBufferMode: true });
      } catch {
        // Try next strategy
      }
    }

    console.warn(`Could not load embedded WASM from ${embeddedWasmPath}`);
    console.warn("Falling back to network fetch (requires --allow-net)");
  }

  // Fall back to default network-based initialization (Emscripten for compile targets)
  return await TagLib.initialize({ forceBufferMode: true });
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
      throw new FileOperationError(
        "read",
        "Could not find taglib-web.wasm in expected locations",
      );
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
    throw new FileOperationError(
      "read",
      `Failed to prepare WASM for embedding: ${message}`,
    );
  }
}
