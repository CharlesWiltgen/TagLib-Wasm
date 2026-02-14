import { detectRuntime, type RuntimeDetectionResult } from "../detector.ts";
import type { WasiModule } from "../wasmer-sdk-loader/index.ts";
import type { TagLibModule } from "../../wasm.ts";
import type { UnifiedLoaderOptions, UnifiedTagLibModule } from "./types.ts";
import { selectWasmType } from "./module-selection.ts";
import { loadModule } from "./module-loading.ts";

export async function loadUnifiedTagLibModule(
  options: UnifiedLoaderOptions = {},
): Promise<UnifiedTagLibModule> {
  const startTime = performance.now();
  const runtime = detectRuntime();

  if (options.debug) {
    console.log(`[UnifiedLoader] Detected runtime: ${runtime.environment}`);
  }

  const wasmType = selectWasmType(runtime, options);

  if (options.debug) {
    console.log(
      `[UnifiedLoader] Selected ${wasmType} for ${runtime.environment}`,
    );
  }

  const { module, actualWasmType } = await loadModule(
    wasmType,
    runtime,
    options,
  );

  const unifiedModule = await createUnifiedModule(
    module,
    runtime,
    actualWasmType,
    startTime,
  );

  if (options.debug) {
    const initTime = performance.now() - startTime;
    console.log(`[UnifiedLoader] Initialized in ${initTime.toFixed(2)}ms`);
  }

  return unifiedModule;
}

async function createUnifiedModule(
  module: TagLibModule | WasiModule,
  runtime: RuntimeDetectionResult,
  wasmType: "wasi" | "emscripten",
  startTime: number,
): Promise<UnifiedTagLibModule> {
  const isWasi = wasmType === "wasi";
  const initTime = performance.now() - startTime;

  if (isWasi) {
    const wasiModule = module as WasiModule;
    const adapter = await createWasiAdapter(wasiModule);
    return Object.assign(adapter, {
      runtime,
      isWasi: true,
      isEmscripten: false,
      getPerformanceMetrics: () => ({
        initTime,
        wasmType: "wasi" as const,
        environment: runtime.environment,
        memoryUsage: wasiModule.memory.buffer.byteLength,
      }),
    }) as UnifiedTagLibModule;
  } else {
    const emscriptenModule = module as TagLibModule;
    return {
      ...emscriptenModule,
      runtime,
      isWasi: false,
      isEmscripten: true,
      getPerformanceMetrics: () => ({
        initTime,
        wasmType: "emscripten" as const,
        environment: runtime.environment,
        memoryUsage: emscriptenModule.HEAP8?.buffer.byteLength,
      }),
    };
  }
}

async function createWasiAdapter(
  wasiModule: WasiModule,
): Promise<TagLibModule> {
  const { WasiToTagLibAdapter } = await import("../wasi-adapter/index.ts");
  return new WasiToTagLibAdapter(wasiModule);
}
