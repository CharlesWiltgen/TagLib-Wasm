import type { RuntimeDetectionResult } from "../detector.ts";
import type { TagLibModule } from "../../wasm.ts";
import type { LoadModuleResult, UnifiedLoaderOptions } from "./types.ts";
import { ModuleLoadError } from "./types.ts";

function resolveWasmPath(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  return url.protocol === "file:" ? url.pathname : url.href;
}

export async function loadModule(
  wasmType: "wasi" | "emscripten",
  _runtime: RuntimeDetectionResult,
  options: UnifiedLoaderOptions,
): Promise<LoadModuleResult> {
  if (wasmType === "wasi") {
    return await loadWasiModuleWithFallback(options);
  } else {
    return {
      module: await loadEmscriptenModule(options),
      actualWasmType: "emscripten",
    };
  }
}

async function loadWasiModuleWithFallback(
  options: UnifiedLoaderOptions,
): Promise<LoadModuleResult> {
  const defaultWasmPath = resolveWasmPath("../../../build/taglib_wasi.wasm");

  // Strategy 1: In-process WASI host (Deno, Node, Bun — no external deps)
  try {
    const { loadWasiHost } = await import("../wasi-host-loader.ts");
    const wasiModule = await loadWasiHost({
      wasmPath: options.wasmUrl || defaultWasmPath,
    });
    return { module: wasiModule, actualWasmType: "wasi" };
  } catch (hostError) {
    if (options.debug) {
      console.warn(`[UnifiedLoader] WASI host failed:`, hostError);
    }
  }

  // Strategy 2: Wasmer SDK (fallback for environments without native fs)
  try {
    const { initializeWasmer, loadWasmerWasi } = await import(
      "../wasmer-sdk-loader/index.ts"
    );
    await initializeWasmer(options.useInlineWasm);
    const wasiModule = await loadWasmerWasi({
      wasmPath: options.wasmUrl || defaultWasmPath,
      useInlineWasm: options.useInlineWasm,
      debug: options.debug,
    });
    return { module: wasiModule, actualWasmType: "wasi" };
  } catch (sdkError) {
    if (options.debug) {
      console.warn(`[UnifiedLoader] Wasmer SDK failed:`, sdkError);
    }
  }

  // Strategy 3: Emscripten fallback
  if (options.debug) {
    console.warn(`[UnifiedLoader] All WASI loaders failed, using Emscripten`);
  }
  return {
    module: await loadEmscriptenModule(options),
    actualWasmType: "emscripten",
  };
}

async function loadEmscriptenModule(
  options: UnifiedLoaderOptions,
): Promise<TagLibModule> {
  try {
    let createModule: (config?: unknown) => Promise<TagLibModule>;

    try {
      // @ts-ignore: Dynamic import handled at runtime
      const module = await import("../../../build/taglib-wrapper.js");
      createModule = module.default as (
        config?: unknown,
      ) => Promise<TagLibModule>;
    } catch {
      try {
        // @ts-ignore: Dynamic import handled at runtime
        const module = await import("../../../dist/taglib-wrapper.js");
        createModule = module.default as (
          config?: unknown,
        ) => Promise<TagLibModule>;
      } catch {
        throw new ModuleLoadError(
          "Could not load Emscripten module from build or dist",
          "emscripten",
        );
      }
    }

    const moduleConfig: Record<string, unknown> = {};
    if (options.wasmBinary) {
      moduleConfig.wasmBinary = options.wasmBinary;
    }
    if (options.wasmUrl) {
      moduleConfig.locateFile = (path: string) => {
        return path.endsWith(".wasm") ? options.wasmUrl! : path;
      };
    }

    const module = await createModule(moduleConfig);
    return module;
  } catch (error) {
    throw new ModuleLoadError(
      `Failed to load Emscripten module: ${error}`,
      "emscripten",
      error,
    );
  }
}
