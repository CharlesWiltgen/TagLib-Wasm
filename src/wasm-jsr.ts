/**
 * @fileoverview JSR-compatible WASM loading for TagLib
 *
 * This version loads the WASM file directly without relying on Emscripten's JS file,
 * making it compatible with JSR publishing requirements.
 */

import type { TagLibConfig } from "./types.ts";

/**
 * JSR-compatible TagLib module interface
 */
export interface TagLibModule {
  // Standard Emscripten memory arrays
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  // Standard functions
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  allocate: (array: Uint8Array, type: number) => number;

  // Allocation constants
  ALLOC_NORMAL: number;
  ALLOC_STACK: number;
  ALLOC_STATIC: number;
  ALLOC_DYNAMIC: number;
  ALLOC_NONE: number;

  // TagLib-specific functions
  _taglib_file_new_from_buffer: (data: number, size: number) => number;
  _taglib_file_delete: (fileId: number) => void;
  _taglib_file_save: (fileId: number) => number;
  _taglib_file_is_valid: (fileId: number) => number;
  _taglib_file_format: (fileId: number) => number;
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
}

/**
 * Load taglib-wasm module for JSR
 */
export async function loadTagLibModuleJSR(
  config?: TagLibConfig,
): Promise<TagLibModule> {
  // Load WASM file as bytes (same file for all platforms)
  const wasmUrl = new URL("../build/taglib.wasm", import.meta.url);
  const wasmBytes = await fetch(wasmUrl).then((r) => r.arrayBuffer());

  // Create memory
  const memory = new WebAssembly.Memory({ initial: 256, maximum: 4096 });
  
  // Create heap views (initialized after memory is created)
  let HEAP8!: Int8Array;
  let HEAPU8!: Uint8Array;
  let HEAP16!: Int16Array;
  let HEAPU16!: Uint16Array;
  let HEAP32!: Int32Array;
  let HEAPU32!: Uint32Array;
  let HEAPF32!: Float32Array;
  let HEAPF64!: Float64Array;
  
  function updateMemoryViews() {
    const buffer = memory.buffer;
    HEAP8 = new Int8Array(buffer);
    HEAPU8 = new Uint8Array(buffer);
    HEAP16 = new Int16Array(buffer);
    HEAPU16 = new Uint16Array(buffer);
    HEAP32 = new Int32Array(buffer);
    HEAPU32 = new Uint32Array(buffer);
    HEAPF32 = new Float32Array(buffer);
    HEAPF64 = new Float64Array(buffer);
  }
  
  updateMemoryViews();
  
  // Import functions expected by the WASM module (still minified with -O3)
  const wasmImports = {
    a: {
      // a: ___cxa_throw
      a: (ptr: number, type: number, destructor: number) => {
        throw new Error('Exception thrown from WASM');
      },
      // e: __abort_js  
      e: () => {
        throw new Error('Abort called from WASM');
      },
      // b: __tzset_js
      b: (timezone: number, daylight: number, std_name: number, dst_name: number) => {
        // Minimal timezone implementation
      },
      // f: _emscripten_resize_heap
      f: (requestedSize: number) => {
        const oldSize = HEAPU8.length;
        const newSize = Math.max(oldSize, requestedSize);
        const pages = Math.ceil((newSize - memory.buffer.byteLength) / 65536);
        try {
          memory.grow(pages);
          updateMemoryViews();
          return 1;
        } catch (e) {
          return 0;
        }
      },
      // c: _environ_get
      c: (__environ: number, environ_buf: number) => 0,
      // d: _environ_sizes_get
      d: (penviron_count: number, penviron_buf_size: number) => {
        HEAPU32[penviron_count >> 2] = 0;
        HEAPU32[penviron_buf_size >> 2] = 0;
        return 0;
      },
      // g: memory
      g: memory,
    },
  };
  
  // Instantiate WASM with the expected imports
  const wasmModule = await WebAssembly.instantiate(wasmBytes, wasmImports);

  const exports = wasmModule.instance.exports as any;
  
  // Update memory reference from exports (g is memory in minified version)
  if (exports.g) {
    updateMemoryViews();
  }
  
  // Initialize runtime (h is the init function in minified version)
  if (exports.h) {
    exports.h();
  }

  // Build the module interface
  const module: TagLibModule = {
    // Memory arrays
    HEAPU8,
    HEAP8,
    HEAP16,
    HEAP32,
    HEAPU16,
    HEAPU32,
    HEAPF32,
    HEAPF64,

    // Standard functions (minified with -O3)
    _malloc: exports.P || (() => {
      throw new Error("malloc not available");
    }),
    _free: exports.Q || (() => {}),
    allocate: (array: Uint8Array, type: number) => {
      const ptr = module._malloc(array.length);
      // Ensure we have the latest memory view
      if (memory.buffer !== module.HEAPU8.buffer) {
        updateMemoryViews();
        module.HEAPU8 = HEAPU8;
        module.HEAP8 = HEAP8;
        module.HEAP16 = HEAP16;
        module.HEAP32 = HEAP32;
        module.HEAPU16 = HEAPU16;
        module.HEAPU32 = HEAPU32;
        module.HEAPF32 = HEAPF32;
        module.HEAPF64 = HEAPF64;
      }
      module.HEAPU8.set(array, ptr);
      return ptr;
    },

    // Allocation constants
    ALLOC_NORMAL: 0,
    ALLOC_STACK: 1,
    ALLOC_STATIC: 2,
    ALLOC_DYNAMIC: 3,
    ALLOC_NONE: 4,

    // TagLib functions - map from minified WASM exports (with -O3)
    _taglib_file_new_from_buffer: exports.i,
    _taglib_file_delete: exports.j,
    _taglib_file_save: exports.k,
    _taglib_file_is_valid: exports.l,
    _taglib_file_format: exports.m,
    _taglib_file_tag: exports.n,
    _taglib_tag_title: exports.o,
    _taglib_tag_artist: exports.p,
    _taglib_tag_album: exports.q,
    _taglib_tag_comment: exports.r,
    _taglib_tag_genre: exports.s,
    _taglib_tag_year: exports.t,
    _taglib_tag_track: exports.u,
    _taglib_tag_set_title: exports.v,
    _taglib_tag_set_artist: exports.w,
    _taglib_tag_set_album: exports.x,
    _taglib_tag_set_comment: exports.y,
    _taglib_tag_set_genre: exports.z,
    _taglib_tag_set_year: exports.A,
    _taglib_tag_set_track: exports.B,
    _taglib_file_audioproperties: exports.C,
    _taglib_audioproperties_length: exports.D,
    _taglib_audioproperties_bitrate: exports.E,
    _taglib_audioproperties_samplerate: exports.F,
    _taglib_audioproperties_channels: exports.G,

    // PropertyMap operations
    _taglib_file_properties_json: exports.H,
    _taglib_file_set_properties_json: exports.I,
    _taglib_file_get_property: exports.J,
    _taglib_file_set_property: exports.K,

    // MP4-specific operations
    _taglib_file_is_mp4: exports.L,
    _taglib_mp4_get_item: exports.M,
    _taglib_mp4_set_item: exports.N,
    _taglib_mp4_remove_item: exports.O,
  };

  return module;
}

/**
 * Convert JavaScript string to C string pointer
 */
export function jsToCStringJSR(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");
  return module.allocate(bytes, module.ALLOC_NORMAL);
}

/**
 * Convert C string pointer to JavaScript string
 */
export function cStringToJSJSR(module: TagLibModule, ptr: number): string {
  if (ptr === 0) return "";

  const bytes: number[] = [];
  let i = 0;
  while (true) {
    const byte = module.HEAPU8[ptr + i];
    if (byte === undefined || byte === 0) break;
    bytes.push(byte);
    i++;
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}
