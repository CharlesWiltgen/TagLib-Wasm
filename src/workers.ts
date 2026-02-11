/**
 * @fileoverview Cloudflare Workers-specific TagLib API
 *
 * This module provides a specialized API for using TagLib in Cloudflare Workers
 * and other edge computing environments where the standard Emscripten module
 * loading may not work. It uses C-style function exports for compatibility.
 *
 * @module taglib-wasm/workers
 */

import type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  Tag,
  TagLibWorkersConfig,
} from "./types.ts";
import {
  cStringToJS,
  emscriptenToWasmExports,
  loadTagLibModuleForWorkers,
  type TagLibModule,
  WasmAlloc,
} from "./wasm-workers.ts";
import type { WasmExports } from "./runtime/wasi-memory.ts";
import { EnvironmentError, InvalidFormatError, MemoryError } from "./errors.ts";

/**
 * Represents an audio file with metadata and properties (Workers-compatible).
 * This implementation uses C-style function calls for Cloudflare Workers compatibility.
 *
 * @example
 * ```typescript
 * using file = taglib.open(audioBuffer);
 *
 * // Get metadata
 * const tag = file.tag();
 * console.log(tag.title);
 *
 * // Modify metadata
 * file.setTitle("New Title");
 * file.save();
 * // automatically cleaned up at scope exit
 * ```
 */
export class AudioFileWorkers {
  private readonly module: TagLibModule;
  private readonly wasmExports: WasmExports;
  private fileId: number;
  private readonly tagPtr: number;
  private readonly propsPtr: number;

  constructor(module: TagLibModule, fileId: number) {
    this.module = module;
    this.wasmExports = emscriptenToWasmExports(module);
    this.fileId = fileId;
    this.tagPtr = module._taglib_file_tag?.(fileId) ?? 0;
    this.propsPtr = module._taglib_file_audioproperties?.(fileId) ?? 0;
  }

  private setStringTag(
    setter: ((tagPtr: number, strPtr: number) => void) | undefined,
    value: string,
  ): void {
    if (this.tagPtr === 0) return;
    const encoded = new TextEncoder().encode(value);
    using alloc = new WasmAlloc(this.wasmExports, encoded.length + 1);
    alloc.writeCString(encoded);
    setter?.(this.tagPtr, alloc.ptr);
  }

  /**
   * Check if the file is valid and was loaded successfully.
   * @returns true if the file is valid and can be processed
   */
  isValid(): boolean {
    return this.module._taglib_file_is_valid?.(this.fileId) !== 0;
  }

  /**
   * Get the file format.
   * @returns Audio format (e.g., "MP3", "FLAC", "OGG")
   */
  format(): AudioFormat {
    const formatPtr = this.module._taglib_file_format?.(this.fileId) ?? 0;
    if (formatPtr === 0) return "MP3"; // fallback
    const formatStr = cStringToJS(this.module, formatPtr);
    return formatStr as AudioFormat;
  }

  /**
   * Get basic tag information.
   * @returns Object containing title, artist, album, etc.
   */
  tag(): Tag {
    if (this.tagPtr === 0) return {};

    const title = this.module._taglib_tag_title?.(this.tagPtr) ?? 0;
    const artist = this.module._taglib_tag_artist?.(this.tagPtr) ?? 0;
    const album = this.module._taglib_tag_album?.(this.tagPtr) ?? 0;
    const comment = this.module._taglib_tag_comment?.(this.tagPtr) ?? 0;
    const genre = this.module._taglib_tag_genre?.(this.tagPtr) ?? 0;
    const year = this.module._taglib_tag_year?.(this.tagPtr) ?? 0;
    const track = this.module._taglib_tag_track?.(this.tagPtr) ?? 0;

    return {
      title: title ? cStringToJS(this.module, title) : undefined,
      artist: artist ? cStringToJS(this.module, artist) : undefined,
      album: album ? cStringToJS(this.module, album) : undefined,
      comment: comment ? cStringToJS(this.module, comment) : undefined,
      genre: genre ? cStringToJS(this.module, genre) : undefined,
      year: year ?? undefined,
      track: track ?? undefined,
    };
  }

  /**
   * Get audio properties (duration, bitrate, etc.).
   * @returns Audio properties or null if unavailable
   */
  audioProperties(): AudioProperties | null {
    if (this.propsPtr === 0) return null;

    const length =
      this.module._taglib_audioproperties_length?.(this.propsPtr) ?? 0;
    const bitrate =
      this.module._taglib_audioproperties_bitrate?.(this.propsPtr) ?? 0;
    const sampleRate = this.module._taglib_audioproperties_samplerate?.(
      this.propsPtr,
    ) ?? 0;
    const channels = this.module._taglib_audioproperties_channels?.(
      this.propsPtr,
    ) ?? 0;

    return {
      length,
      bitrate,
      sampleRate,
      channels,
      bitsPerSample: 0, // Not available in C API compatibility mode
      codec: "Unknown", // Not available in C API compatibility mode
      containerFormat: "UNKNOWN", // Not available in C API compatibility mode
      isLossless: false, // Not available in C API compatibility mode
    };
  }

  /**
   * Set the title tag.
   * @param title - New title value
   */
  setTitle(title: string): void {
    this.setStringTag(this.module._taglib_tag_set_title, title);
  }

  /**
   * Set the artist tag.
   * @param artist - New artist value
   */
  setArtist(artist: string): void {
    this.setStringTag(this.module._taglib_tag_set_artist, artist);
  }

  /**
   * Set the album tag.
   * @param album - New album value
   */
  setAlbum(album: string): void {
    this.setStringTag(this.module._taglib_tag_set_album, album);
  }

  /**
   * Set the comment tag.
   * @param comment - New comment value
   */
  setComment(comment: string): void {
    this.setStringTag(this.module._taglib_tag_set_comment, comment);
  }

  /**
   * Set the genre tag.
   * @param genre - New genre value
   */
  setGenre(genre: string): void {
    this.setStringTag(this.module._taglib_tag_set_genre, genre);
  }

  /**
   * Set the year tag.
   * @param year - Release year
   */
  setYear(year: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_year?.(this.tagPtr, year);
  }

  /**
   * Set the track number tag.
   * @param track - Track number
   */
  setTrack(track: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_track?.(this.tagPtr, track);
  }

  /**
   * Save changes to the file.
   * Note: In Workers context, this saves to the in-memory buffer only.
   * @returns true if save was successful
   */
  save(): boolean {
    if (this.fileId !== 0) {
      return this.module._taglib_file_save?.(this.fileId) !== 0;
    }
    return false;
  }

  /**
   * Get the current file buffer after modifications.
   * Note: This is not implemented in the Workers API.
   * @returns Empty Uint8Array (not implemented)
   * @throws {Error} Consider using the Full API for this functionality
   */
  getFileBuffer(): Uint8Array {
    console.warn(
      "getFileBuffer() is not implemented in Workers API. Use Full API for this functionality.",
    );
    return new Uint8Array(0);
  }

  /**
   * Get extended metadata with format-agnostic field names.
   * Note: Currently returns only basic fields in Workers API.
   * @returns Extended tag object with basic fields populated
   */
  extendedTag(): ExtendedTag {
    const basicTag = this.tag();

    return {
      ...basicTag,
      // Advanced fields placeholder - would be populated by PropertyMap reading
      acoustidFingerprint: undefined,
      acoustidId: undefined,
      musicbrainzTrackId: undefined,
      musicbrainzReleaseId: undefined,
      musicbrainzArtistId: undefined,
      musicbrainzReleaseGroupId: undefined,
      albumArtist: undefined,
      composer: undefined,
      discNumber: undefined,
      totalTracks: undefined,
      totalDiscs: undefined,
      bpm: undefined,
      compilation: undefined,
      titleSort: undefined,
      artistSort: undefined,
      albumSort: undefined,
      replayGainTrackGain: undefined,
      replayGainTrackPeak: undefined,
      replayGainAlbumGain: undefined,
      replayGainAlbumPeak: undefined,
      appleSoundCheck: undefined,
    };
  }

  /**
   * Set extended metadata using format-agnostic field names.
   * Note: Currently only supports basic fields in Workers API.
   * @param tag - Partial extended tag object with fields to update
   */
  setExtendedTag(tag: Partial<ExtendedTag>): void {
    if (tag.title !== undefined) this.setTitle(tag.title);
    if (tag.artist !== undefined) this.setArtist(tag.artist);
    if (tag.album !== undefined) this.setAlbum(tag.album);
    if (tag.comment !== undefined) this.setComment(tag.comment);
    if (tag.genre !== undefined) this.setGenre(tag.genre);
    if (tag.year !== undefined) this.setYear(tag.year);
    if (tag.track !== undefined) this.setTrack(tag.track);
  }

  /**
   * Clean up resources.
   * Always call this when done to prevent memory leaks.
   */
  dispose(): void {
    if (this.fileId !== 0) {
      this.module._taglib_file_delete?.(this.fileId);
      this.fileId = 0;
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

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

/**
 * Re-export commonly used types for convenience.
 * These types define the structure of metadata, audio properties,
 * and configuration options.
 */
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  Tag,
  TagLibWorkersConfig,
};
