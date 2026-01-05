/**
 * Type declarations for optional @wasmer/wasi and @wasmer/sdk dependencies
 * These are dynamically imported at runtime, so we provide minimal types
 */

declare module "@wasmer/wasi" {
  export function init(): Promise<void>;

  export interface WASIOptions {
    env?: Record<string, string>;
    args?: string[];
    preopens?: Record<string, string>;
  }

  export class WASI {
    constructor(options?: WASIOptions);
    instantiate(
      module: WebAssembly.Module,
      imports?: Record<string, any>,
    ): Promise<WebAssembly.Instance>;
    start(): void;
  }
}

declare module "@wasmer/sdk" {
  export function init(options?: { module?: unknown }): Promise<void>;

  export class Directory {
    constructor();
  }

  export type Instance = WebAssembly.Instance;
  export type runWasix = (
    module: WebAssembly.Module,
    options?: unknown,
  ) => Promise<Instance>;
}

declare module "@wasmer/sdk/wasm-inline" {
  const wasmModule: unknown;
  export default wasmModule;
}
