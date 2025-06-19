/**
 * @fileoverview Static module loader for Deno compile compatibility
 *
 * This module provides a version of taglib-wasm that uses static imports
 * to ensure all dependencies are bundled during Deno compilation.
 */

// Static import of the Wasm wrapper - this ensures it's bundled
import createTagLibModule from "../build/taglib-wrapper.js";

// Import types
import type { LoadTagLibOptions, TagLibModule } from "../index.ts";

// Module state
let cachedModule: TagLibModule | null = null;

/**
 * Loads and initializes the TagLib WebAssembly module using static imports.
 * This version ensures all dependencies are bundled during Deno compilation.
 *
 * @param options - Optional configuration for module loading
 * @returns Promise resolving to initialized TagLib module
 *
 * @example
 * ```typescript
 * // Basic usage in Deno compiled binary
 * const module = await loadTagLibModuleStatic();
 *
 * // With embedded WASM binary
 * const wasmBinary = await Deno.readFile('./taglib.wasm');
 * const module = await loadTagLibModuleStatic({ wasmBinary });
 * ```
 */
export async function loadTagLibModuleStatic(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  // Return cached module if available and no custom options
  if (cachedModule && !options) {
    return cachedModule;
  }

  const moduleConfig: any = {};

  if (options?.wasmBinary) {
    // Use provided binary data directly
    moduleConfig.wasmBinary = options.wasmBinary;
  }

  if (options?.wasmUrl) {
    // Use custom URL for WASM file
    moduleConfig.locateFile = (path: string) => {
      if (path.endsWith(".wasm")) {
        return options.wasmUrl!;
      }
      return path;
    };
  }

  try {
    // Create and initialize the module
    const module = await createTagLibModule(moduleConfig) as TagLibModule;

    // Verify the module loaded correctly
    if (!module || !module.HEAPU8) {
      throw new Error("Module not initialized: missing HEAPU8");
    }

    if (!module._malloc || !module.allocate) {
      throw new Error(
        "Module not initialized: missing memory allocation functions",
      );
    }

    // Cache if using default configuration
    if (!options) {
      cachedModule = module;
    }

    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load TagLib module: ${message}`);
  }
}

// Re-export the function as default
export default loadTagLibModuleStatic;
