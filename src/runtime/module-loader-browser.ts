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
  // The Emscripten factory's shape is typed explicitly: build/ carries the
  // wrapper's .d.ts, but dist/ is gitignored (absent in CI), so the dist
  // import is untyped there (no-unsafe-* errors in the lint gate).
  // The Emscripten factory's shape is typed loosely: deno check infers
  // `Promise<{}>` from the wrapper's JS, eslint's projectService sees the
  // committed .d.ts (`Promise<any>`); `unknown` is assignable from both, and
  // the final cast narrows to TagLibModule.
  type CreateTagLibModule = (
    config?: object,
  ) => Promise<unknown>;
  let createTagLibModule: CreateTagLibModule;
  try {
    const module = await import("../../build/taglib-wrapper.js");
    createTagLibModule = module.default;
  } catch {
    try {
      // dist/ is gitignored (absent in CI), so this import is untyped there;
      // the build/ twin above is typed by its committed .d.ts (taglib-c9b lint gate).
      const module = (await import("../../dist/taglib-wrapper.js")) as {
        default: CreateTagLibModule;
      };
      createTagLibModule = module.default;
    } catch {
      throw new TagLibInitializationError(
        "Could not load taglib-wrapper.js. Ensure it is co-located with the browser bundle.",
      );
    }
  }

  // Keys set on moduleConfig must also be listed in INCOMING_MODULE_JS_API
  // (build/build-wasm.sh), or Emscripten 6.0.2+ silently ignores them (ASSERTIONS=0).
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

  const module = (await createTagLibModule(moduleConfig)) as TagLibModule;
  return module;
}
