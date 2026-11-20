/**
 * @fileoverview Module loading functions for TagLib Wasm initialization
 *
 * Handles both WASI (optimal for Deno/Node.js) and Emscripten (browser fallback)
 * module loading strategies.
 */

import type { LoadTagLibOptions } from "./loader-types.ts";
import { describeNonWasmBinary } from "./loader-types.ts";
import type { TagLibModule } from "../wasm.ts";
import {
  EnvironmentError,
  errorMessage,
  TagLibInitializationError,
} from "../errors/classes.ts";
import { isDenoCompiled } from "./deno-detect.ts";
import { checkNodeVersion } from "./detector.ts";

/** Validate backend/version preconditions before loading. */
function validateLoadPreconditions(options?: LoadTagLibOptions): void {
  // Browsers have no `process`; Node's global type is not available in the
  // browser build, so model the optional field explicitly.
  const runtime = globalThis as {
    process?: { versions?: { node?: unknown } };
  };
  const node = runtime.process?.versions?.node;
  const nodeVersion = typeof node === "string" ? node : undefined;
  const versionError = checkNodeVersion(nodeVersion);
  if (versionError) {
    throw new EnvironmentError("Node.js", versionError, "WASI support");
  }

  if (options?.forceWasmType === "wasi" && options?.wasmBinary) {
    throw new TagLibInitializationError(
      "wasmBinary is not supported by the WASI backend: it loads from a " +
        "filesystem path or URL. Use wasmUrl, or omit forceWasmType to " +
        "use the Emscripten backend",
      { forceWasmType: "wasi" },
    );
  }

  if (options?.wasmBinary) {
    const problem = describeNonWasmBinary(options.wasmBinary);
    if (problem) {
      throw new TagLibInitializationError(problem, {
        byteLength: options.wasmBinary.byteLength,
      });
    }
  }
}

/** Deno compile: load the embedded Wasm, or warn and use the default path. */
async function loadDenoCompiled(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  const wasmBinary = await tryLoadEmbeddedWasm();
  if (!wasmBinary) {
    console.warn(
      "[TagLib] Deno compile detected but embedded Wasm not found. " +
        "Include taglib-web.wasm with: deno compile --include taglib-web.wasm",
    );
  }
  return loadBufferModeTagLibModule({
    ...options,
    forceWasmType: "emscripten",
    ...(wasmBinary ? { wasmBinary } : {}),
  });
}

/** Unified loader with auto-mode fallback; an explicit WASI choice throws. */
async function loadUnified(options?: LoadTagLibOptions): Promise<TagLibModule> {
  try {
    // Lazy on purpose: the unified loader pulls the Wasm loader graph, and
    // auto mode must be able to fall back to buffer mode when that import
    // fails. A static import would turn the fallback into an init failure.
    const { loadUnifiedTagLibModule } =
      await import("./unified-loader/index.ts");
    return await loadUnifiedTagLibModule({
      ...(options?.wasmBinary !== undefined
        ? { wasmBinary: options.wasmBinary }
        : {}),
      ...(options?.wasmUrl !== undefined ? { wasmUrl: options.wasmUrl } : {}),
      ...(options?.forceWasmType !== undefined
        ? { forceWasmType: options.forceWasmType }
        : {}),
      debug: false,
    });
  } catch (error) {
    // An explicit backend choice must fail loudly: silently serving the other
    // backend masks backend-specific bugs (taglib-3o4). Auto mode keeps the
    // fallback for resilience.
    if (options?.forceWasmType === "wasi") {
      throw new TagLibInitializationError(
        `WASI backend failed to load: ${errorMessage(error)}. ` +
          `forceWasmType is "wasi", so the Emscripten fallback was not attempted`,
        { cause: error, forceWasmType: "wasi" },
      );
    }
    console.warn(
      `[TagLib] Unified loader failed, falling back to buffer mode: ${errorMessage(
        error,
      )}`,
    );
    return loadBufferModeTagLibModule(options || {});
  }
}

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
 * // Force Emscripten mode (in-memory I/O)
 * const module = await loadTagLibModule({ forceWasmType: "emscripten" });
 *
 * // Force WASI mode (Deno/Node.js only)
 * const module = await loadTagLibModule({ forceWasmType: "wasi" });
 *
 * // With custom WASM binary (selects the Emscripten backend; the bytes
 * // must be its artifact, taglib-web.wasm)
 * const wasmData = await fetch("taglib-web.wasm").then(r => r.arrayBuffer());
 * const module = await loadTagLibModule({ wasmBinary: wasmData });
 * ```
 *
 * @note Most users should use `TagLib.initialize()` instead,
 * which handles module loading automatically.
 */
export async function loadTagLibModule(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  validateLoadPreconditions(options);

  if (
    !options?.wasmBinary &&
    !options?.wasmUrl &&
    !options?.forceWasmType &&
    isDenoCompiled()
  ) {
    return loadDenoCompiled(options);
  }

  if (options?.forceWasmType === "emscripten") {
    return loadBufferModeTagLibModule(options);
  }

  return loadUnified(options);
}

/**
 * Emscripten-only module loader for buffer mode (in-memory I/O).
 * Used for fallback compatibility and when forceWasmType is "emscripten".
 *
 * @internal
 */
async function loadBufferModeTagLibModule(
  options: LoadTagLibOptions,
): Promise<TagLibModule> {
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
        "Could not load taglib-wrapper.js from either ./build or ./dist",
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
    const wasmUrl = new URL("../../build/taglib-web.wasm", import.meta.url);
    moduleConfig.locateFile = (path: string) =>
      path.endsWith(".wasm") ? wasmUrl.href : path;
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
