/**
 * @fileoverview Cloudflare Workers-specific TagLib API
 */

import type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  Tag,
  TagLibConfig,
} from "./types.ts";
import {
  cStringToJS,
  jsToCString,
  loadTagLibModuleForWorkers,
  type TagLibModule,
} from "./wasm-workers.ts";

/**
 * Represents an audio file with metadata and properties (Workers-compatible)
 */
export class AudioFileWorkers {
  private module: TagLibModule;
  private fileId: number;
  private tagPtr: number;
  private propsPtr: number;

  constructor(module: TagLibModule, fileId: number) {
    this.module = module;
    this.fileId = fileId;
    this.tagPtr = module._taglib_file_tag?.(fileId) || 0;
    this.propsPtr = module._taglib_file_audioproperties?.(fileId) || 0;
  }

  /**
   * Check if the file is valid and was loaded successfully
   */
  isValid(): boolean {
    return this.module._taglib_file_is_valid?.(this.fileId) !== 0;
  }

  /**
   * Get the file format
   */
  format(): AudioFormat {
    const formatPtr = this.module._taglib_file_format?.(this.fileId) || 0;
    if (formatPtr === 0) return "MP3"; // fallback
    const formatStr = cStringToJS(this.module, formatPtr);
    return formatStr as AudioFormat;
  }

  /**
   * Get basic tag information
   */
  tag(): Tag {
    if (this.tagPtr === 0) return {};

    const title = this.module._taglib_tag_title?.(this.tagPtr) || 0;
    const artist = this.module._taglib_tag_artist?.(this.tagPtr) || 0;
    const album = this.module._taglib_tag_album?.(this.tagPtr) || 0;
    const comment = this.module._taglib_tag_comment?.(this.tagPtr) || 0;
    const genre = this.module._taglib_tag_genre?.(this.tagPtr) || 0;
    const year = this.module._taglib_tag_year?.(this.tagPtr) || 0;
    const track = this.module._taglib_tag_track?.(this.tagPtr) || 0;

    return {
      title: title ? cStringToJS(this.module, title) : undefined,
      artist: artist ? cStringToJS(this.module, artist) : undefined,
      album: album ? cStringToJS(this.module, album) : undefined,
      comment: comment ? cStringToJS(this.module, comment) : undefined,
      genre: genre ? cStringToJS(this.module, genre) : undefined,
      year: year || undefined,
      track: track || undefined,
    };
  }

  /**
   * Get audio properties (duration, bitrate, etc.)
   */
  audioProperties(): AudioProperties | null {
    if (this.propsPtr === 0) return null;

    const length = this.module._taglib_audioproperties_length?.(this.propsPtr) || 0;
    const bitrate = this.module._taglib_audioproperties_bitrate?.(this.propsPtr) || 0;
    const sampleRate = this.module._taglib_audioproperties_samplerate?.(
      this.propsPtr,
    ) || 0;
    const channels = this.module._taglib_audioproperties_channels?.(
      this.propsPtr,
    ) || 0;

    return {
      length,
      bitrate,
      sampleRate,
      channels,
      format: this.format(),
    };
  }

  /**
   * Set the title tag
   */
  setTitle(title: string): void {
    if (this.tagPtr === 0) return;
    const titlePtr = jsToCString(this.module, title);
    this.module._taglib_tag_set_title?.(this.tagPtr, titlePtr);
    this.module._free(titlePtr);
  }

  /**
   * Set the artist tag
   */
  setArtist(artist: string): void {
    if (this.tagPtr === 0) return;
    const artistPtr = jsToCString(this.module, artist);
    this.module._taglib_tag_set_artist?.(this.tagPtr, artistPtr);
    this.module._free(artistPtr);
  }

  /**
   * Set the album tag
   */
  setAlbum(album: string): void {
    if (this.tagPtr === 0) return;
    const albumPtr = jsToCString(this.module, album);
    this.module._taglib_tag_set_album?.(this.tagPtr, albumPtr);
    this.module._free(albumPtr);
  }

  /**
   * Set the comment tag
   */
  setComment(comment: string): void {
    if (this.tagPtr === 0) return;
    const commentPtr = jsToCString(this.module, comment);
    this.module._taglib_tag_set_comment?.(this.tagPtr, commentPtr);
    this.module._free(commentPtr);
  }

  /**
   * Set the genre tag
   */
  setGenre(genre: string): void {
    if (this.tagPtr === 0) return;
    const genrePtr = jsToCString(this.module, genre);
    this.module._taglib_tag_set_genre?.(this.tagPtr, genrePtr);
    this.module._free(genrePtr);
  }

  /**
   * Set the year tag
   */
  setYear(year: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_year?.(this.tagPtr, year);
  }

  /**
   * Set the track number tag
   */
  setTrack(track: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_track?.(this.tagPtr, track);
  }

  /**
   * Save changes to the file
   * Note: In Workers context, this saves to the in-memory buffer only
   */
  save(): boolean {
    if (this.fileId !== 0) {
      return this.module._taglib_file_save?.(this.fileId) !== 0;
    }
    return false;
  }

  /**
   * Get the current file buffer after modifications
   * Note: This is not implemented in the Workers API
   */
  getFileBuffer(): Uint8Array {
    console.warn("getFileBuffer() is not implemented in Workers API. Use Core API for this functionality.");
    return new Uint8Array(0);
  }

  /**
   * Get extended metadata with format-agnostic field names
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
   * Set extended metadata using format-agnostic field names
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
   * Clean up resources
   */
  dispose(): void {
    if (this.fileId !== 0) {
      this.module._taglib_file_delete?.(this.fileId);
      this.fileId = 0;
    }
  }
}

/**
 * Main TagLib class for Cloudflare Workers
 */
export class TagLibWorkers {
  private module: TagLibModule;

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
   * const file = taglib.openFile(audioBuffer);
   * const metadata = file.tag();
   * ```
   */
  static async initialize(
    wasmBinary: Uint8Array,
    config?: TagLibConfig,
  ): Promise<TagLibWorkers> {
    const module = await loadTagLibModuleForWorkers(wasmBinary, config);
    return new TagLibWorkers(module);
  }

  /**
   * Open an audio file from a buffer
   */
  openFile(buffer: Uint8Array): AudioFileWorkers {
    if (!this.module.HEAPU8) {
      throw new Error("Wasm module not properly initialized - missing HEAPU8");
    }

    // Use Emscripten's allocate function for proper memory management
    let dataPtr: number;
    if (this.module.allocate && this.module.ALLOC_NORMAL !== undefined) {
      dataPtr = this.module.allocate(buffer, this.module.ALLOC_NORMAL);
    } else {
      dataPtr = this.module._malloc(buffer.length);
      this.module.HEAPU8.set(buffer, dataPtr);
    }

    if (!this.module._taglib_file_new_from_buffer) {
      throw new Error("Workers API requires C-style functions. Use Core API instead.");
    }
    
    const fileId = this.module._taglib_file_new_from_buffer(
      dataPtr,
      buffer.length,
    );

    if (fileId === 0) {
      console.log(
        `DEBUG: File creation failed, not freeing memory at ${dataPtr}`,
      );
      throw new Error(
        "Failed to open audio file - invalid format or corrupted data",
      );
    }

    // Free the temporary buffer copy (TagLib has made its own copy in ByteVector)
    this.module._free(dataPtr);

    return new AudioFileWorkers(this.module, fileId);
  }

  /**
   * Get the underlying Wasm module (for advanced usage)
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
  config?: TagLibConfig,
): Promise<
  { tag: Tag; properties: AudioProperties | null; format: AudioFormat }
> {
  const taglib = await TagLibWorkers.initialize(wasmBinary, config);
  const file = taglib.openFile(audioData);

  try {
    const tag = file.tag();
    const properties = file.audioProperties();
    const format = file.format();

    return { tag, properties, format };
  } finally {
    file.dispose();
  }
}

// Export types for convenience
export type { AudioFormat, AudioProperties, ExtendedTag, Tag, TagLibConfig };
