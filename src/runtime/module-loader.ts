/**
 * @fileoverview Module loading functions for TagLib Wasm initialization
 *
 * Handles both WASI (optimal for Deno/Node.js) and Emscripten (browser fallback)
 * module loading strategies.
 */

import type { LoadTagLibOptions } from "./loader-types.ts";
import type { TagLibModule } from "../wasm.ts";
import { TagLibInitializationError } from "../errors/classes.ts";
import { isDenoCompiled } from "./deno-detect.ts";

/**
 * Load the TagLib Wasm module.
 * This function initializes the WebAssembly module and returns
 * the loaded module for use with the Full API.
 *
 * Automatically selects the optimal implementation:
 * - WASI for Deno/Node.js (faster filesystem access, MessagePack serialization)
 * - Emscripten for browsers (universal compatibility)
 *
 * @param options - Optional configuration for module initialization
 * @returns Promise resolving to the initialized TagLib module
 *
 * @example
 * ```typescript
 * import { loadTagLibModule, TagLib } from "taglib-wasm";
 *
 * // Auto-select optimal implementation
 * const module = await loadTagLibModule();
 * const taglib = new TagLib(module);
 *
 * // Force buffer mode (Emscripten-based in-memory I/O)
 * const module = await loadTagLibModule({ forceBufferMode: true });
 *
 * // Force WASI mode (Deno/Node.js only)
 * const module = await loadTagLibModule({ forceWasmType: "wasi" });
 *
 * // With custom WASM binary
 * const wasmData = await fetch("taglib.wasm").then(r => r.arrayBuffer());
 * const module = await loadTagLibModule({ wasmBinary: wasmData });
 * ```
 *
 * @note Most users should use `TagLib.initialize()` instead,
 * which handles module loading automatically.
 */
export async function loadTagLibModule(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  if (
    !options?.forceBufferMode && !options?.wasmBinary && !options?.wasmUrl &&
    !options?.forceWasmType && isDenoCompiled()
  ) {
    const wasmBinary = await tryLoadEmbeddedWasm();
    if (!wasmBinary) {
      console.warn(
        "[TagLib] Deno compile detected but embedded Wasm not found. " +
          "Include taglib-web.wasm with: deno compile --include taglib-web.wasm",
      );
    }
    return loadBufferModeTagLibModule({
      ...options,
      forceBufferMode: true,
      ...(wasmBinary ? { wasmBinary } : {}),
    });
  }

  if (options?.forceBufferMode) {
    return loadBufferModeTagLibModule(options);
  }

  try {
    const { loadUnifiedTagLibModule } = await import(
      "./unified-loader/index.ts"
    );
    return await loadUnifiedTagLibModule({
      wasmBinary: options?.wasmBinary,
      wasmUrl: options?.wasmUrl,
      forceWasmType: options?.forceWasmType,
      debug: false,
      useInlineWasm: false,
    });
  } catch (error) {
    console.warn(
      `[TagLib] Unified loader failed, falling back to buffer mode: ${error}`,
    );
    return loadBufferModeTagLibModule(options || {});
  }
}

/**
 * Emscripten-only module loader for buffer mode (in-memory I/O).
 * Used for fallback compatibility and when forceBufferMode is explicitly requested.
 *
 * @internal
 */
async function loadBufferModeTagLibModule(
  options: LoadTagLibOptions,
): Promise<TagLibModule> {
  let createTagLibModule;
  try {
    // @ts-ignore: Dynamic import handled at runtime
    const module = await import("../../build/taglib-wrapper.js");
    createTagLibModule = module.default;
  } catch {
    try {
      // @ts-ignore: Dynamic import handled at runtime
      const module = await import("../../dist/taglib-wrapper.js");
      createTagLibModule = module.default;
    } catch {
      throw new TagLibInitializationError(
        "Could not load taglib-wrapper.js from either ./build or ./dist",
      );
    }
  }

  const moduleConfig: any = {};

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
  }

  const module = await createTagLibModule(moduleConfig);
  return module as TagLibModule;
}

/** @internal Try to load embedded Wasm from the default path. */
async function tryLoadEmbeddedWasm(): Promise<Uint8Array | null> {
  const strategies: Array<() => Promise<Uint8Array>> = [
    // Relative to user's entry point (where --include embeds files)
    () => Deno.readFile(new URL("./taglib-web.wasm", Deno.mainModule)),
    // Relative to this library module
    () => Deno.readFile(new URL("./taglib-web.wasm", import.meta.url)),
    // CWD fallback (last resort — depends on where the binary is invoked)
    () => Deno.readFile("taglib-web.wasm"),
  ];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch {
      // Try next strategy
    }
  }
  return null;
}
