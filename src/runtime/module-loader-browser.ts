/**
 * @fileoverview Browser-only module loader for TagLib Wasm
 *
 * Emscripten-only loader with zero imports of WASI, Wasmer, node:fs, or Deno modules.
 * Used by browser entry points to avoid bundler errors from server-only code paths.
 */

import type { LoadTagLibOptions } from "./loader-types.ts";
import type { TagLibModule } from "../wasm.ts";
import { TagLibInitializationError } from "../errors/classes.ts";

/**
 * Load the TagLib Wasm module using Emscripten only.
 *
 * Import paths use `./` because the browser bundle is output to `dist/`
 * alongside `taglib-wrapper.js` and `taglib-web.wasm` (copied by postbuild).
 */
export async function loadTagLibModule(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  // These import paths are rewritten by the esbuild browser plugin to
  // "./taglib-wrapper.js" (co-located in dist/). Source paths kept for tsc.
  let createTagLibModule;
  try {
    const module = await import("../../build/taglib-wrapper.js");
    createTagLibModule = module.default;
  } catch {
    try {
      const module = await import("../../dist/taglib-wrapper.js");
      createTagLibModule = module.default;
    } catch {
      throw new TagLibInitializationError(
        "Could not load taglib-wrapper.js. Ensure it is co-located with the browser bundle.",
      );
    }
  }

  const moduleConfig: Record<string, unknown> = {};

  if (options?.wasmBinary) {
    moduleConfig.wasmBinary = options.wasmBinary;
  }

  if (options?.wasmUrl) {
    moduleConfig.locateFile = (path: string) => {
      if (path.endsWith(".wasm")) {
        return options.wasmUrl!;
      }
      return path;
    };
  } else if (!options?.wasmBinary) {
    // Resolve relative to the bundle location (dist/)
    const wasmUrl = new URL("./taglib-web.wasm", import.meta.url);
    moduleConfig.locateFile = (path: string) =>
      path.endsWith(".wasm") ? wasmUrl.href : path;
  }

  const module = await createTagLibModule(moduleConfig);
  return module as TagLibModule;
}
