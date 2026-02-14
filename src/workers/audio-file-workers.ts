/**
 * @fileoverview AudioFileWorkers class for Cloudflare Workers environments
 */

import type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  Tag,
} from "../types.ts";
import {
  cStringToJS,
  emscriptenToWasmExports,
  type TagLibModule,
  WasmAlloc,
} from "../wasm-workers.ts";
import type { WasmExports } from "../runtime/wasi-memory.ts";

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

  /** Set the title tag. */
  setTitle(title: string): void {
    this.setStringTag(this.module._taglib_tag_set_title, title);
  }

  /** Set the artist tag. */
  setArtist(artist: string): void {
    this.setStringTag(this.module._taglib_tag_set_artist, artist);
  }

  /** Set the album tag. */
  setAlbum(album: string): void {
    this.setStringTag(this.module._taglib_tag_set_album, album);
  }

  /** Set the comment tag. */
  setComment(comment: string): void {
    this.setStringTag(this.module._taglib_tag_set_comment, comment);
  }

  /** Set the genre tag. */
  setGenre(genre: string): void {
    this.setStringTag(this.module._taglib_tag_set_genre, genre);
  }

  /** Set the year tag. */
  setYear(year: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_year?.(this.tagPtr, year);
  }

  /** Set the track number tag. */
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
   * Not implemented in the Workers API; use the Full API instead.
   */
  getFileBuffer(): Uint8Array {
    console.warn(
      "getFileBuffer() is not implemented in Workers API. Use Full API for this functionality.",
    );
    return new Uint8Array(0);
  }

  /** Get extended metadata with format-agnostic field names. */
  extendedTag(): ExtendedTag {
    const basicTag = this.tag();

    return {
      ...basicTag,
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

  /** Set extended metadata using format-agnostic field names. */
  setExtendedTag(tag: Partial<ExtendedTag>): void {
    if (tag.title !== undefined) this.setTitle(tag.title);
    if (tag.artist !== undefined) this.setArtist(tag.artist);
    if (tag.album !== undefined) this.setAlbum(tag.album);
    if (tag.comment !== undefined) this.setComment(tag.comment);
    if (tag.genre !== undefined) this.setGenre(tag.genre);
    if (tag.year !== undefined) this.setYear(tag.year);
    if (tag.track !== undefined) this.setTrack(tag.track);
  }

  /** Clean up resources. Always call this when done to prevent memory leaks. */
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
