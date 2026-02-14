/**
 * @fileoverview TagLibWorkers class and processAudioMetadata utility
 */

import type {
  AudioFormat,
  AudioProperties,
  Tag,
  TagLibWorkersConfig,
} from "../types.ts";
import {
  emscriptenToWasmExports,
  loadTagLibModuleForWorkers,
  type TagLibModule,
  WasmAlloc,
} from "../wasm-workers.ts";
import {
  EnvironmentError,
  InvalidFormatError,
  MemoryError,
} from "../errors.ts";
import { AudioFileWorkers } from "./audio-file-workers.ts";

/**
 * Main TagLib class for Cloudflare Workers.
 * Provides methods to initialize the library and open audio files
 * in edge computing environments.
 *
 * @example
 * ```typescript
 * import wasmBinary from "../build/taglib.wasm";
 *
 * // Initialize TagLib
 * const taglib = await TagLibWorkers.initialize(wasmBinary);
 *
 * // Process audio file
 * using file = taglib.open(audioBuffer);
 * const metadata = file.tag();
 * ```
 */
export class TagLibWorkers {
  private readonly module: TagLibModule;

  private constructor(module: TagLibModule) {
    this.module = module;
  }

  /**
   * Initialize TagLib for Workers with Wasm binary
   *
   * @param wasmBinary - The WebAssembly binary as Uint8Array
   * @param config - Optional configuration for the Wasm module
   *
   * @example
   * ```typescript
   * // In a Cloudflare Worker
   * import wasmBinary from "../build/taglib.wasm";
   *
   * const taglib = await TagLibWorkers.initialize(wasmBinary);
   * const file = taglib.open(audioBuffer);
   * const metadata = file.tag();
   * ```
   */
  static async initialize(
    wasmBinary: Uint8Array,
    config?: TagLibWorkersConfig,
  ): Promise<TagLibWorkers> {
    const module = await loadTagLibModuleForWorkers(wasmBinary, config);
    return new TagLibWorkers(module);
  }

  /**
   * Open an audio file from a buffer.
   *
   * @param buffer - Audio file data as Uint8Array
   * @returns AudioFileWorkers instance
   * @throws {Error} If Wasm module is not initialized
   * @throws {Error} If file format is invalid or unsupported
   * @throws {Error} If Workers API C-style functions are not available
   *
   * @example
   * ```typescript
   * const audioData = new Uint8Array(await request.arrayBuffer());
   * const file = taglib.open(audioData);
   * ```
   */
  open(buffer: Uint8Array): AudioFileWorkers {
    if (!this.module.HEAPU8) {
      throw new MemoryError(
        "Wasm module not properly initialized: missing HEAPU8. " +
          "The module may not have loaded correctly in the Workers environment.",
      );
    }

    if (!this.module._taglib_file_new_from_buffer) {
      throw new EnvironmentError(
        "Workers",
        "requires C-style functions which are not available. Use the Full API instead for this environment",
        "C-style function exports",
      );
    }

    using alloc = new WasmAlloc(
      emscriptenToWasmExports(this.module),
      buffer.length,
    );
    alloc.write(buffer);

    const fileId = this.module._taglib_file_new_from_buffer(
      alloc.ptr,
      buffer.length,
    );

    if (fileId === 0) {
      throw new InvalidFormatError(
        "Failed to open audio file. File format may be invalid or not supported",
        buffer.length,
      );
    }

    return new AudioFileWorkers(this.module, fileId);
  }

  /**
   * Open an audio file from a buffer (backward compatibility).
   * Consider using `open()` for consistency with the Full API.
   * @param buffer Audio file data as Uint8Array
   * @returns Audio file instance
   */
  openFile(buffer: Uint8Array): AudioFileWorkers {
    return this.open(buffer);
  }

  /**
   * Get the underlying Wasm module for advanced usage.
   * @returns The initialized TagLib Wasm module
   */
  getModule(): TagLibModule {
    return this.module;
  }
}

/**
 * Utility function to process audio metadata in a Cloudflare Worker
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request): Promise<Response> {
 *     if (request.method === "POST") {
 *       const audioData = new Uint8Array(await request.arrayBuffer());
 *       const metadata = await processAudioMetadata(wasmBinary, audioData);
 *       return Response.json(metadata);
 *     }
 *     return new Response("Method not allowed", { status: 405 });
 *   }
 * };
 * ```
 */
export async function processAudioMetadata(
  wasmBinary: Uint8Array,
  audioData: Uint8Array,
  config?: TagLibWorkersConfig,
): Promise<
  { tag: Tag; properties: AudioProperties | null; format: AudioFormat }
> {
  const taglib = await TagLibWorkers.initialize(wasmBinary, config);
  using file = taglib.open(audioData);

  return {
    tag: file.tag(),
    properties: file.audioProperties(),
    format: file.format(),
  };
}
