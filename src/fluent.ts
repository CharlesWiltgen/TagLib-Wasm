/**
 * @fileoverview Fluent API for taglib-wasm with method chaining
 * 
 * This module provides a fluent, chainable API for working with audio metadata,
 * making common operations more concise and readable.
 * 
 * @example
 * ```typescript
 * import { TagLib } from "taglib-wasm/fluent";
 * 
 * // Chain multiple operations
 * await TagLib
 *   .fromFile("song.mp3")
 *   .setTitle("New Title")
 *   .setArtist("New Artist")
 *   .setAlbum("New Album")
 *   .save();
 * 
 * // Read and log tags
 * const tags = await TagLib
 *   .fromFile("song.mp3")
 *   .getTags();
 * ```
 */

import { TagLib as BaseTagLib } from "./taglib.ts";
import type { AudioFile as BaseAudioFile } from "./taglib.ts";
import type { Tag, AudioProperties, ExtendedTag } from "./types.ts";

// Cached TagLib instance
let cachedTagLib: BaseTagLib | null = null;

/**
 * Get or create a TagLib instance
 */
async function getTagLib(): Promise<BaseTagLib> {
  if (!cachedTagLib) {
    cachedTagLib = await BaseTagLib.initialize({
      debug: false,
      memory: {
        initial: 16 * 1024 * 1024,
        maximum: 64 * 1024 * 1024,
      },
    });
  }
  return cachedTagLib;
}

/**
 * Read file data from various sources
 */
async function readFileData(file: string | Uint8Array | ArrayBuffer | File): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  if (typeof File !== 'undefined' && file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  
  if (typeof file === 'string') {
    if (typeof Deno !== 'undefined') return await Deno.readFile(file);
    if (typeof process !== 'undefined' && process.versions?.node) {
      const { readFile } = await import('fs/promises');
      return new Uint8Array(await readFile(file));
    }
    if (typeof (globalThis as any).Bun !== 'undefined') {
      return new Uint8Array(await (globalThis as any).Bun.file(file).arrayBuffer());
    }
    throw new Error('File path reading not supported in this environment');
  }
  
  throw new Error('Invalid file input type');
}

/**
 * Fluent wrapper around AudioFile for method chaining
 */
export class FluentAudioFile {
  private audioFile: BaseAudioFile;
  private disposed: boolean = false;
  
  constructor(audioFile: BaseAudioFile) {
    this.audioFile = audioFile;
  }
  
  /**
   * Ensure the file hasn't been disposed
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('AudioFile has been disposed');
    }
  }
  
  /**
   * Set the title
   */
  setTitle(title: string): this {
    this.checkDisposed();
    this.audioFile.setTitle(title);
    return this;
  }
  
  /**
   * Set the artist
   */
  setArtist(artist: string): this {
    this.checkDisposed();
    this.audioFile.setArtist(artist);
    return this;
  }
  
  /**
   * Set the album
   */
  setAlbum(album: string): this {
    this.checkDisposed();
    this.audioFile.setAlbum(album);
    return this;
  }
  
  /**
   * Set the comment
   */
  setComment(comment: string): this {
    this.checkDisposed();
    this.audioFile.setComment(comment);
    return this;
  }
  
  /**
   * Set the genre
   */
  setGenre(genre: string): this {
    this.checkDisposed();
    this.audioFile.setGenre(genre);
    return this;
  }
  
  /**
   * Set the year
   */
  setYear(year: number): this {
    this.checkDisposed();
    this.audioFile.setYear(year);
    return this;
  }
  
  /**
   * Set the track number
   */
  setTrack(track: number): this {
    this.checkDisposed();
    this.audioFile.setTrack(track);
    return this;
  }
  
  /**
   * Set multiple tags at once
   */
  setTags(tags: Partial<Tag>): this {
    this.checkDisposed();
    if (tags.title !== undefined) this.audioFile.setTitle(tags.title);
    if (tags.artist !== undefined) this.audioFile.setArtist(tags.artist);
    if (tags.album !== undefined) this.audioFile.setAlbum(tags.album);
    if (tags.comment !== undefined) this.audioFile.setComment(tags.comment);
    if (tags.genre !== undefined) this.audioFile.setGenre(tags.genre);
    if (tags.year !== undefined) this.audioFile.setYear(tags.year);
    if (tags.track !== undefined) this.audioFile.setTrack(tags.track);
    return this;
  }
  
  /**
   * Set extended tags
   */
  setExtendedTags(tags: Partial<ExtendedTag>): this {
    this.checkDisposed();
    this.audioFile.setExtendedTag(tags);
    return this;
  }
  
  /**
   * Set AcoustID fingerprint
   */
  setAcoustidFingerprint(fingerprint: string): this {
    this.checkDisposed();
    this.audioFile.setAcoustidFingerprint(fingerprint);
    return this;
  }
  
  /**
   * Set AcoustID ID
   */
  setAcoustidId(id: string): this {
    this.checkDisposed();
    this.audioFile.setAcoustidId(id);
    return this;
  }
  
  /**
   * Set MusicBrainz track ID
   */
  setMusicBrainzTrackId(id: string): this {
    this.checkDisposed();
    this.audioFile.setMusicBrainzTrackId(id);
    return this;
  }
  
  /**
   * Clear all tags
   */
  clearTags(): this {
    this.checkDisposed();
    this.setTags({
      title: "",
      artist: "",
      album: "",
      comment: "",
      genre: "",
      year: 0,
      track: 0,
    });
    return this;
  }
  
  /**
   * Get all tags (terminal operation)
   */
  async getTags(): Promise<Tag> {
    this.checkDisposed();
    const tags = this.audioFile.tag();
    this.dispose();
    return tags;
  }
  
  /**
   * Get extended tags (terminal operation)
   */
  async getExtendedTags(): Promise<ExtendedTag> {
    this.checkDisposed();
    const tags = this.audioFile.extendedTag();
    this.dispose();
    return tags;
  }
  
  /**
   * Get audio properties (terminal operation)
   */
  async getProperties(): Promise<AudioProperties> {
    this.checkDisposed();
    const props = this.audioFile.audioProperties();
    this.dispose();
    if (!props) {
      throw new Error('Failed to read audio properties');
    }
    return props;
  }
  
  /**
   * Get the format (terminal operation)
   */
  async getFormat(): Promise<string | undefined> {
    this.checkDisposed();
    const format = this.audioFile.format();
    this.dispose();
    return format;
  }
  
  /**
   * Check if valid (terminal operation)
   */
  async isValid(): Promise<boolean> {
    this.checkDisposed();
    const valid = this.audioFile.isValid();
    this.dispose();
    return valid;
  }
  
  /**
   * Save changes (terminal operation)
   */
  async save(): Promise<boolean> {
    this.checkDisposed();
    const result = this.audioFile.save();
    this.dispose();
    return result;
  }
  
  /**
   * Execute a custom operation and continue chaining
   */
  tap(operation: (file: BaseAudioFile) => void | Promise<void>): this {
    this.checkDisposed();
    const result = operation(this.audioFile);
    if (result instanceof Promise) {
      throw new Error('Async operations not supported in tap(). Use execute() instead.');
    }
    return this;
  }
  
  /**
   * Execute a custom async operation (terminal operation)
   */
  async execute<T>(operation: (file: BaseAudioFile) => T | Promise<T>): Promise<T> {
    this.checkDisposed();
    try {
      return await operation(this.audioFile);
    } finally {
      this.dispose();
    }
  }
  
  /**
   * Get the underlying AudioFile (advanced usage)
   */
  getAudioFile(): BaseAudioFile {
    this.checkDisposed();
    return this.audioFile;
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    if (!this.disposed) {
      this.audioFile.dispose();
      this.disposed = true;
    }
  }
}

/**
 * Main fluent API entry point
 */
export class TagLib {
  /**
   * Create a fluent wrapper from a file
   * 
   * @example
   * ```typescript
   * await TagLib
   *   .fromFile("song.mp3")
   *   .setTitle("New Title")
   *   .setArtist("New Artist")
   *   .save();
   * ```
   */
  static async fromFile(file: string | Uint8Array | ArrayBuffer | File): Promise<FluentAudioFile> {
    const taglib = await getTagLib();
    const audioData = await readFileData(file);
    const audioFile = taglib.openFile(audioData);
    
    if (!audioFile.isValid()) {
      audioFile.dispose();
      throw new Error('Invalid audio file');
    }
    
    return new FluentAudioFile(audioFile);
  }
  
  /**
   * Create a fluent wrapper from a buffer
   */
  static async fromBuffer(buffer: Uint8Array): Promise<FluentAudioFile> {
    return TagLib.fromFile(buffer);
  }
  
  /**
   * Quick read operation
   * 
   * @example
   * ```typescript
   * const tags = await TagLib.read("song.mp3");
   * console.log(tags.title, tags.artist);
   * ```
   */
  static async read(file: string | Uint8Array | ArrayBuffer | File): Promise<Tag> {
    return TagLib.fromFile(file).then(f => f.getTags());
  }
  
  /**
   * Quick properties operation
   * 
   * @example
   * ```typescript
   * const props = await TagLib.properties("song.mp3");
   * console.log(`Duration: ${props.length}s`);
   * ```
   */
  static async properties(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioProperties> {
    return TagLib.fromFile(file).then(f => f.getProperties());
  }
  
  /**
   * Quick write operation
   * 
   * @example
   * ```typescript
   * await TagLib.write("song.mp3", {
   *   title: "New Title",
   *   artist: "New Artist"
   * });
   * ```
   */
  static async write(file: string | Uint8Array | ArrayBuffer | File, tags: Partial<Tag>): Promise<boolean> {
    return TagLib
      .fromFile(file)
      .then(f => f.setTags(tags).save());
  }
  
  /**
   * Quick format check
   * 
   * @example
   * ```typescript
   * const format = await TagLib.format("song.mp3");
   * console.log(`Format: ${format}`); // "MP3"
   * ```
   */
  static async format(file: string | Uint8Array | ArrayBuffer | File): Promise<string | undefined> {
    return TagLib.fromFile(file).then(f => f.getFormat());
  }
  
  /**
   * Batch process multiple files
   * 
   * @example
   * ```typescript
   * const results = await TagLib.batch([
   *   "song1.mp3",
   *   "song2.mp3",
   *   "song3.mp3"
   * ], async file => {
   *   await file.setArtist("Various Artists").save();
   *   return file.getTags();
   * });
   * ```
   */
  static async batch<T>(
    files: Array<string | Uint8Array | ArrayBuffer | File>,
    operation: (file: FluentAudioFile) => Promise<T>
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (const file of files) {
      try {
        const fluentFile = await TagLib.fromFile(file);
        results.push(await operation(fluentFile));
      } catch (error) {
        console.error(`Error processing file:`, error);
        results.push(undefined as any);
      }
    }
    
    return results;
  }
}

// Export types for convenience
export type { Tag, AudioProperties, ExtendedTag } from "./types.ts";