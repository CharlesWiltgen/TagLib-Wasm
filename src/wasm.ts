/**
 * @fileoverview WebAssembly module interface and loading utilities
 */

import type { TagLibConfig } from "./types.ts";

/**
 * Emscripten module interface for TagLib WASM
 */
export interface TagLibModule {
  // Emscripten standard properties
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  // Standard Emscripten functions
  cwrap: (ident: string, returnType: string, argTypes: string[]) => any;
  ccall: (
    ident: string,
    returnType: string,
    argTypes: string[],
    args: any[],
  ) => any;
  getValue: (ptr: number, type: string) => number;
  setValue: (ptr: number, value: number, type: string) => void;
  addFunction: (func: Function, signature: string) => number;
  removeFunction: (funcPtr: number) => void;

  // Memory allocation functions
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  allocate: (array: Uint8Array, type: number) => number;

  // Allocation types
  ALLOC_NORMAL: number;
  ALLOC_STACK: number;
  ALLOC_STATIC: number;
  ALLOC_DYNAMIC: number;
  ALLOC_NONE: number;

  // File operations
  _taglib_file_new_from_buffer: (data: number, size: number) => number;
  _taglib_file_delete: (fileId: number) => void;
  _taglib_file_save: (fileId: number) => number;
  _taglib_file_is_valid: (fileId: number) => number;
  _taglib_file_format: (fileId: number) => number;

  // Tag operations
  _taglib_file_tag: (fileId: number) => number;
  _taglib_tag_title: (tag: number) => number;
  _taglib_tag_artist: (tag: number) => number;
  _taglib_tag_album: (tag: number) => number;
  _taglib_tag_comment: (tag: number) => number;
  _taglib_tag_genre: (tag: number) => number;
  _taglib_tag_year: (tag: number) => number;
  _taglib_tag_track: (tag: number) => number;

  _taglib_tag_set_title: (tag: number, title: number) => void;
  _taglib_tag_set_artist: (tag: number, artist: number) => void;
  _taglib_tag_set_album: (tag: number, album: number) => void;
  _taglib_tag_set_comment: (tag: number, comment: number) => void;
  _taglib_tag_set_genre: (tag: number, genre: number) => void;
  _taglib_tag_set_year: (tag: number, year: number) => void;
  _taglib_tag_set_track: (tag: number, track: number) => void;

  // Audio properties
  _taglib_file_audioproperties: (fileId: number) => number;
  _taglib_audioproperties_length: (props: number) => number;
  _taglib_audioproperties_bitrate: (props: number) => number;
  _taglib_audioproperties_samplerate: (props: number) => number;
  _taglib_audioproperties_channels: (props: number) => number;

  // PropertyMap operations
  _taglib_file_properties_json: (fileId: number) => number;
  _taglib_file_set_properties_json: (fileId: number, json: number) => number;
  _taglib_file_get_property: (fileId: number, key: number) => number;
  _taglib_file_set_property: (fileId: number, key: number, value: number) => number;

  // MP4-specific operations
  _taglib_file_is_mp4: (fileId: number) => number;
  _taglib_mp4_get_item: (fileId: number, key: number) => number;
  _taglib_mp4_set_item: (fileId: number, key: number, value: number) => number;
  _taglib_mp4_remove_item: (fileId: number, key: number) => number;

  // String utilities
  _taglib_string_new: (str: number) => number;
  _taglib_string_delete: (str: number) => void;
  _taglib_string_to_cstring: (str: number) => number;

  // Memory management functions already defined above
}

/**
 * Default configuration for TagLib WASM module
 */
const DEFAULT_CONFIG: Required<TagLibConfig> = {
  memory: {
    initial: 16 * 1024 * 1024, // 16MB
    maximum: 256 * 1024 * 1024, // 256MB
  },
  debug: false,
};

/**
 * Load and initialize the TagLib WebAssembly module
 */
export async function loadTagLibModule(
  config: TagLibConfig = {},
): Promise<TagLibModule> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Detect runtime environment
  const isNode = typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.versions?.node;
  const isDeno = typeof (globalThis as any).Deno !== "undefined";

  let wasmPath: string;

  if (isDeno) {
    // Deno: Use file system path
    wasmPath = new URL("../build/taglib.wasm", import.meta.url).pathname;
  } else if (isNode) {
    // Node.js: Use require.resolve or fs path
    wasmPath = new URL("../build/taglib.wasm", import.meta.url).pathname;
  } else {
    // Browser: Relative path
    wasmPath = "./taglib.wasm";
  }

  // Load WASM binary
  let wasmBinary: Uint8Array;

  if (isDeno) {
    wasmBinary = await (globalThis as any).Deno.readFile(wasmPath);
  } else if (isNode) {
    const fs = await import("node:fs");
    wasmBinary = await fs.promises.readFile(wasmPath);
  } else {
    // Browser
    const response = await fetch(wasmPath);
    wasmBinary = new Uint8Array(await response.arrayBuffer());
  }

  // Create Emscripten module configuration
  const moduleConfig = {
    wasmBinary,
    wasmMemory: new WebAssembly.Memory({
      initial: mergedConfig.memory.initial! / (64 * 1024),
      maximum: mergedConfig.memory.maximum! / (64 * 1024),
    }),
    print: mergedConfig.debug ? console.log : () => {},
    printErr: mergedConfig.debug ? console.error : () => {},
    onRuntimeInitialized: () => {
      if (mergedConfig.debug) {
        console.log("TagLib WASM module initialized");
      }
    },
  };

  // Load the Emscripten-generated module
  try {
    // For Deno, we need to handle the CommonJS-style export
    let TagLibWASM: any;

    if (isDeno) {
      // In Deno, read and evaluate the JS file
      const jsContent = await (globalThis as any).Deno.readTextFile(
        new URL("../build/taglib.js", import.meta.url).pathname,
      );

      // Create a minimal CommonJS environment
      const exports = {} as any;
      const module = { exports } as any;
      const define = undefined;
      const require = (name: string) => {
        if (name === "fs") {
          return {
            readFileSync: (path: string) => (globalThis as any).Deno.readFileSync(path),
          };
        }
        throw new Error(`Module ${name} not found`);
      };

      // Add a minimal process object for Node.js compatibility
      const process = {
        versions: {},
        argv: [],
        type: "deno",
      };

      // Execute the WASM JS with the proper context
      const func = new Function(
        "exports",
        "module",
        "define",
        "require",
        "process",
        "__dirname",
        "__filename",
        jsContent +
          '\nreturn typeof TagLibWASM !== "undefined" ? TagLibWASM : module.exports;',
      );

      TagLibWASM = func(exports, module, define, require, process, "", "");
    } else {
      // For Node.js and browsers, use normal import
      const wasmModule = await import("../build/taglib.js");
      TagLibWASM = wasmModule.default || wasmModule;
    }

    if (typeof TagLibWASM !== "function") {
      throw new Error("Failed to load TagLib WASM module");
    }

    const wasmInstance = await TagLibWASM(moduleConfig);

    // Ensure proper memory arrays are set up
    if (!wasmInstance.HEAPU8) {
      // Manual setup if not automatically created
      const buffer = wasmInstance.buffer || wasmInstance.wasmMemory?.buffer;
      if (buffer) {
        wasmInstance.HEAPU8 = new Uint8Array(buffer);
        wasmInstance.HEAP8 = new Int8Array(buffer);
        wasmInstance.HEAP16 = new Int16Array(buffer);
        wasmInstance.HEAP32 = new Int32Array(buffer);
        wasmInstance.HEAPU16 = new Uint16Array(buffer);
        wasmInstance.HEAPU32 = new Uint32Array(buffer);
        wasmInstance.HEAPF32 = new Float32Array(buffer);
        wasmInstance.HEAPF64 = new Float64Array(buffer);
      }
    }

    return wasmInstance as TagLibModule;
  } catch (error) {
    throw new Error(`Failed to load TagLib WASM: ${(error as Error).message}`);
  }
}

/**
 * Convert a C string pointer to JavaScript string
 */
export function cStringToJS(module: TagLibModule, ptr: number): string {
  if (ptr === 0) return "";

  const view = new Uint8Array(module.HEAPU8.buffer, ptr);
  let length = 0;
  while (view[length] !== 0) length++;

  return new TextDecoder().decode(view.subarray(0, length));
}

/**
 * Convert JavaScript string to C string
 */
export function jsToCString(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");
  return module.allocate(bytes, module.ALLOC_NORMAL);
}
