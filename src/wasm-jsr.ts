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
 * Load TagLib WASM module for JSR
 */
export async function loadTagLibModuleJSR(
  config?: TagLibConfig,
): Promise<TagLibModule> {
  // Load WASM file as bytes
  const wasmUrl = new URL("../build/taglib.wasm", import.meta.url);
  const wasmBytes = await fetch(wasmUrl).then((r) => r.arrayBuffer());

  // Minimal WebAssembly instantiation
  const wasmModule = await WebAssembly.instantiate(wasmBytes, {
    env: {
      // Minimal environment for WASM
      memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
      __handle_stack_overflow: () => {},
      emscripten_notify_memory_growth: () => {},
    },
  });

  const instance = wasmModule.instance;
  const exports = instance.exports as any;

  // Create memory views
  const memory = exports.memory || new WebAssembly.Memory({ initial: 256 });
  const buffer = memory.buffer;

  // Build the module interface
  const module: TagLibModule = {
    // Memory arrays
    HEAPU8: new Uint8Array(buffer),
    HEAP8: new Int8Array(buffer),
    HEAP16: new Int16Array(buffer),
    HEAP32: new Int32Array(buffer),
    HEAPU16: new Uint16Array(buffer),
    HEAPU32: new Uint32Array(buffer),
    HEAPF32: new Float32Array(buffer),
    HEAPF64: new Float64Array(buffer),

    // Standard functions
    _malloc: exports._malloc || (() => {
      throw new Error("malloc not available");
    }),
    _free: exports._free || (() => {}),
    allocate: (array: Uint8Array, type: number) => {
      const ptr = module._malloc(array.length);
      module.HEAPU8.set(array, ptr);
      return ptr;
    },

    // Allocation constants
    ALLOC_NORMAL: 0,
    ALLOC_STACK: 1,
    ALLOC_STATIC: 2,
    ALLOC_DYNAMIC: 3,
    ALLOC_NONE: 4,

    // TagLib functions - map from WASM exports
    _taglib_file_new_from_buffer: exports._taglib_file_new_from_buffer,
    _taglib_file_delete: exports._taglib_file_delete,
    _taglib_file_save: exports._taglib_file_save,
    _taglib_file_is_valid: exports._taglib_file_is_valid,
    _taglib_file_format: exports._taglib_file_format,
    _taglib_file_tag: exports._taglib_file_tag,
    _taglib_tag_title: exports._taglib_tag_title,
    _taglib_tag_artist: exports._taglib_tag_artist,
    _taglib_tag_album: exports._taglib_tag_album,
    _taglib_tag_comment: exports._taglib_tag_comment,
    _taglib_tag_genre: exports._taglib_tag_genre,
    _taglib_tag_year: exports._taglib_tag_year,
    _taglib_tag_track: exports._taglib_tag_track,
    _taglib_tag_set_title: exports._taglib_tag_set_title,
    _taglib_tag_set_artist: exports._taglib_tag_set_artist,
    _taglib_tag_set_album: exports._taglib_tag_set_album,
    _taglib_tag_set_comment: exports._taglib_tag_set_comment,
    _taglib_tag_set_genre: exports._taglib_tag_set_genre,
    _taglib_tag_set_year: exports._taglib_tag_set_year,
    _taglib_tag_set_track: exports._taglib_tag_set_track,
    _taglib_file_audioproperties: exports._taglib_file_audioproperties,
    _taglib_audioproperties_length: exports._taglib_audioproperties_length,
    _taglib_audioproperties_bitrate: exports._taglib_audioproperties_bitrate,
    _taglib_audioproperties_samplerate:
      exports._taglib_audioproperties_samplerate,
    _taglib_audioproperties_channels: exports._taglib_audioproperties_channels,

    // PropertyMap operations
    _taglib_file_properties_json: exports._taglib_file_properties_json,
    _taglib_file_set_properties_json: exports._taglib_file_set_properties_json,
    _taglib_file_get_property: exports._taglib_file_get_property,
    _taglib_file_set_property: exports._taglib_file_set_property,

    // MP4-specific operations
    _taglib_file_is_mp4: exports._taglib_file_is_mp4,
    _taglib_mp4_get_item: exports._taglib_mp4_get_item,
    _taglib_mp4_set_item: exports._taglib_mp4_set_item,
    _taglib_mp4_remove_item: exports._taglib_mp4_remove_item,
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
