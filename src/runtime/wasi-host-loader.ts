/**
 * @fileoverview WASI host loader for in-process filesystem access
 *
 * Loads the taglib_wasi.wasm binary with real WASI filesystem
 * implementations, enabling efficient seek-based file I/O.
 */

import {
  createWasiImports,
  type WasiHostConfig,
  type WasiImportDisposable,
} from "./wasi-host.ts";
import type { FileSystemProvider } from "./wasi-fs-provider.ts";
import type { WasiModule } from "./wasmer-sdk-loader/index.ts";

export interface WasiHostLoaderConfig {
  wasmPath?: string;
  preopens?: Record<string, string>;
  fs?: FileSystemProvider;
}

export class WasiHostLoadError extends Error {
  readonly code = "WASI_HOST_LOAD_ERROR" as const;
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WasiHostLoadError";
  }
}

async function resolveFs(
  provided?: FileSystemProvider,
): Promise<FileSystemProvider> {
  if (provided) return provided;
  if (typeof Deno !== "undefined") {
    const { createDenoFsProvider } = await import("./wasi-fs-deno.ts");
    return createDenoFsProvider();
  }
  const { createNodeFsProvider } = await import("./wasi-fs-node.ts");
  return createNodeFsProvider();
}

export async function loadWasiHost(
  config: WasiHostLoaderConfig,
): Promise<WasiModule & Disposable> {
  const defaultPath = (() => {
    const url = new URL("../../build/taglib_wasi.wasm", import.meta.url);
    return url.protocol === "file:" ? url.pathname : url.href;
  })();
  const wasmPath = config.wasmPath ?? defaultPath;
  const preopens = config.preopens ?? {};
  const fs = await resolveFs(config.fs);

  const wasmBytes = await loadWasmBinary(wasmPath, fs);
  const wasmModule = await WebAssembly.compile(wasmBytes as BufferSource);

  // We need a Memory object before creating imports, but Wasm defines its own.
  // Create a placeholder that will be updated after instantiation.
  const memoryProxy = { buffer: new ArrayBuffer(0) };

  const hostConfig: WasiHostConfig = {
    preopens,
    fs,
    stderr: (data) => {
      const text = new TextDecoder().decode(data);
      if (text.trim()) console.error(`[wasi-host] ${text}`);
    },
  };

  const wasiImports = createWasiImports(memoryProxy, hostConfig);

  const importObject = {
    wasi_snapshot_preview1: wasiImports,
    env: {},
  };

  const instance = await WebAssembly.instantiate(wasmModule, importObject);
  const memory = instance.exports.memory as WebAssembly.Memory;

  // Patch the memory proxy to point at real memory
  Object.defineProperty(memoryProxy, "buffer", {
    get: () => memory.buffer,
  });

  if (instance.exports._initialize) {
    (instance.exports._initialize as () => void)();
  }

  return createWasiModuleFromInstance(instance, memory, wasiImports);
}

async function loadWasmBinary(
  path: string,
  fs: FileSystemProvider,
): Promise<Uint8Array> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new WasiHostLoadError(
        `Failed to fetch Wasm binary: ${response.statusText}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  try {
    return await fs.readFile(path);
  } catch (cause) {
    throw new WasiHostLoadError(
      `Failed to read Wasm binary: ${path}`,
      cause,
    );
  }
}

function createWasiModuleFromInstance(
  instance: WebAssembly.Instance,
  memory: WebAssembly.Memory,
  wasiImports: WasiImportDisposable,
): WasiModule & Disposable {
  const exports = instance.exports;

  function readCString(ptr: number): string {
    if (!ptr) return "";
    const u8 = new Uint8Array(memory.buffer);
    let end = ptr;
    while (end < u8.length && u8[end] !== 0) end++;
    return new TextDecoder().decode(u8.slice(ptr, end));
  }

  return {
    tl_version: () => {
      const ptr = (exports.tl_version as () => number)();
      return readCString(ptr);
    },
    tl_api_version: () =>
      exports.tl_api_version ? (exports.tl_api_version as () => number)() : 100,
    malloc: (size: number) =>
      (exports.tl_malloc as (size: number) => number)(size),
    free: (ptr: number) => (exports.tl_free as (ptr: number) => void)(ptr),
    tl_read_tags: (pathPtr, bufPtr, len, outSizePtr) =>
      (exports.tl_read_tags as (
        p: number,
        b: number,
        l: number,
        o: number,
      ) => number)(pathPtr, bufPtr, len, outSizePtr),
    tl_write_tags: (pathPtr, bufPtr, len, tagsPtr, tagsSz, outPtr, outSzPtr) =>
      (exports.tl_write_tags as (
        p: number,
        b: number,
        l: number,
        t: number,
        ts: number,
        o: number,
        os: number,
      ) => number)(pathPtr, bufPtr, len, tagsPtr, tagsSz, outPtr, outSzPtr),
    tl_get_last_error: () => (exports.tl_get_last_error as () => number)(),
    tl_get_last_error_code: () =>
      (exports.tl_get_last_error_code as () => number)(),
    tl_clear_error: () => (exports.tl_clear_error as () => void)(),
    memory,
    [Symbol.dispose]: () => wasiImports[Symbol.dispose](),
  };
}
