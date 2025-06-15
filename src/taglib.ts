import type { TagLibModule, WasmModule } from "./wasm.ts";
import type {
  AudioProperties,
  FileType,
  PropertyMap,
  Tag as BasicTag,
} from "./types.ts";

/**
 * Extended Tag interface with read/write capabilities for audio metadata.
 * Extends the basic Tag interface with setter methods for modifying metadata.
 *
 * @example
 * ```typescript
 * const file = await taglib.openFile(buffer);
 * const tag = file.tag();
 *
 * // Read metadata
 * console.log(tag.title);
 *
 * // Write metadata
 * tag.setTitle("New Title");
 * tag.setArtist("New Artist");
 * file.save();
 * ```
 */
export interface Tag extends BasicTag {
  /** Set the track title */
  setTitle(value: string): void;
  /** Set the artist name */
  setArtist(value: string): void;
  /** Set the album name */
  setAlbum(value: string): void;
  /** Set the comment */
  setComment(value: string): void;
  /** Set the genre */
  setGenre(value: string): void;
  /** Set the release year */
  setYear(value: number): void;
  /** Set the track number */
  setTrack(value: number): void;
}

/**
 * Represents an audio file with metadata and audio properties.
 * Provides methods for reading and writing metadata, accessing audio properties,
 * and managing format-specific features.
 *
 * @example
 * ```typescript
 * const file = await taglib.openFile(audioBuffer);
 *
 * // Check if valid
 * if (!file.isValid()) {
 *   throw new Error("Invalid audio file");
 * }
 *
 * // Read metadata
 * const tag = file.tag();
 * const props = file.audioProperties();
 *
 * // Modify and save
 * tag.setTitle("New Title");
 * file.save();
 *
 * // Get modified buffer
 * const modifiedBuffer = file.getFileBuffer();
 *
 * // Clean up
 * file.dispose();
 * ```
 */
export interface AudioFile {
  /**
   * Get the audio file format.
   * @returns The detected file type (e.g., "MP3", "FLAC", "MP4")
   */
  getFormat(): FileType;

  /**
   * Get the tag object for reading/writing basic metadata.
   * @returns Tag object with getters and setters for metadata fields
   * @throws {Error} If unable to get tag from file
   */
  tag(): Tag;

  /**
   * Get audio properties (duration, bitrate, sample rate, etc.).
   * @returns Audio properties or null if unavailable
   */
  audioProperties(): AudioProperties | null;

  /**
   * Get all metadata properties as a key-value map.
   * Includes both standard and format-specific properties.
   * @returns PropertyMap with all available metadata
   */
  properties(): PropertyMap;

  /**
   * Set multiple properties at once from a PropertyMap.
   * @param properties - Map of property names to values
   */
  setProperties(properties: PropertyMap): void;

  /**
   * Get a single property value by key.
   * @param key - Property name (e.g., "ALBUMARTIST", "ACOUSTID_ID")
   * @returns Property value or undefined if not found
   */
  getProperty(key: string): string | undefined;

  /**
   * Set a single property value.
   * @param key - Property name
   * @param value - Property value
   */
  setProperty(key: string, value: string): void;

  /**
   * Check if this is an MP4/M4A file.
   * @returns true if the file is MP4/M4A format
   */
  isMP4(): boolean;

  /**
   * Get an MP4-specific metadata item.
   * @param key - MP4 atom name (e.g., "----:com.apple.iTunes:iTunNORM")
   * @returns Item value or undefined if not found
   * @throws {Error} If not an MP4 file
   */
  getMP4Item(key: string): string | undefined;

  /**
   * Set an MP4-specific metadata item.
   * @param key - MP4 atom name
   * @param value - Item value
   * @throws {Error} If not an MP4 file
   */
  setMP4Item(key: string, value: string): void;

  /**
   * Remove an MP4-specific metadata item.
   * @param key - MP4 atom name to remove
   * @throws {Error} If not an MP4 file
   */
  removeMP4Item(key: string): void;

  /**
   * Save all changes to the in-memory buffer.
   * Note: This does not write to disk, but updates the internal buffer.
   * Use getFileBuffer() to retrieve the modified data.
   * @returns true if save was successful
   */
  save(): boolean;

  /**
   * Get the current file data as a buffer, including any modifications.
   * Call this after save() to get the updated file data.
   * @returns Uint8Array containing the complete file data
   */
  getFileBuffer(): Uint8Array;

  /**
   * Check if the file was loaded successfully and is valid.
   * @returns true if the file is valid and can be processed
   */
  isValid(): boolean;

  /**
   * Release all resources associated with this file.
   * Always call this when done to prevent memory leaks.
   */
  dispose(): void;
}

/**
 * Implementation of AudioFile interface using Embind API.
 * Wraps the native TagLib C++ FileHandle object.
 *
 * @internal This class is not meant to be instantiated directly.
 * Use TagLib.openFile() to create instances.
 */
export class AudioFileImpl implements AudioFile {
  private fileHandle: any;
  private cachedTag: Tag | null = null;
  private cachedAudioProperties: AudioProperties | null = null;

  constructor(
    private module: TagLibModule,
    fileHandle: any,
  ) {
    this.fileHandle = fileHandle;
  }

  /** @inheritdoc */
  getFormat(): FileType {
    return this.fileHandle.getFormat() as FileType;
  }

  /** @inheritdoc */
  tag(): Tag {
    const tagWrapper = this.fileHandle.getTag();
    if (!tagWrapper) {
      throw new Error("Failed to get tag from file");
    }

    return {
      title: tagWrapper.title(),
      artist: tagWrapper.artist(),
      album: tagWrapper.album(),
      comment: tagWrapper.comment(),
      genre: tagWrapper.genre(),
      year: tagWrapper.year(),
      track: tagWrapper.track(),

      setTitle: (value: string) => tagWrapper.setTitle(value),
      setArtist: (value: string) => tagWrapper.setArtist(value),
      setAlbum: (value: string) => tagWrapper.setAlbum(value),
      setComment: (value: string) => tagWrapper.setComment(value),
      setGenre: (value: string) => tagWrapper.setGenre(value),
      setYear: (value: number) => tagWrapper.setYear(value),
      setTrack: (value: number) => tagWrapper.setTrack(value),
    };
  }

  /** @inheritdoc */
  audioProperties(): AudioProperties | null {
    if (!this.cachedAudioProperties) {
      const propsWrapper = this.fileHandle.getAudioProperties();
      if (!propsWrapper) {
        return null;
      }

      this.cachedAudioProperties = {
        length: propsWrapper.lengthInSeconds(),
        bitrate: propsWrapper.bitrate(),
        sampleRate: propsWrapper.sampleRate(),
        channels: propsWrapper.channels(),
      };
    }

    return this.cachedAudioProperties;
  }

  /** @inheritdoc */
  properties(): PropertyMap {
    const jsObj = this.fileHandle.getProperties();
    const result: PropertyMap = {};

    // Convert from Emscripten val to plain object
    const keys = Object.keys(jsObj);
    for (const key of keys) {
      result[key] = jsObj[key];
    }

    return result;
  }

  /** @inheritdoc */
  setProperties(properties: PropertyMap): void {
    this.fileHandle.setProperties(properties);
  }

  /** @inheritdoc */
  getProperty(key: string): string | undefined {
    const value = this.fileHandle.getProperty(key);
    return value === "" ? undefined : value;
  }

  /** @inheritdoc */
  setProperty(key: string, value: string): void {
    this.fileHandle.setProperty(key, value);
  }

  /** @inheritdoc */
  isMP4(): boolean {
    return this.fileHandle.isMP4();
  }

  /** @inheritdoc */
  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    const value = this.fileHandle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  /** @inheritdoc */
  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    this.fileHandle.setMP4Item(key, value);
  }

  /** @inheritdoc */
  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    this.fileHandle.removeMP4Item(key);
  }

  /** @inheritdoc */
  save(): boolean {
    // Clear caches since values may have changed
    this.cachedTag = null;
    this.cachedAudioProperties = null;

    return this.fileHandle.save();
  }

  /** @inheritdoc */
  getFileBuffer(): Uint8Array {
    const bufferString = this.fileHandle.getBuffer();
    if (!bufferString) {
      return new Uint8Array(0);
    }

    // Convert string to Uint8Array
    const buffer = new Uint8Array(bufferString.length);
    for (let i = 0; i < bufferString.length; i++) {
      buffer[i] = bufferString.charCodeAt(i);
    }
    return buffer;
  }

  /** @inheritdoc */
  isValid(): boolean {
    return this.fileHandle.isValid();
  }

  /** @inheritdoc */
  dispose(): void {
    if (this.fileHandle) {
      // Embind will handle cleanup when the object goes out of scope
      // But we can help by clearing our references
      this.fileHandle = null;
      this.cachedTag = null;
      this.cachedAudioProperties = null;
    }
  }
}

/**
 * Main TagLib interface for audio metadata operations.
 * Provides methods to open audio files and access TagLib functionality.
 *
 * @example
 * ```typescript
 * // Option 1: Auto-initialize
 * const taglib = await TagLib.initialize();
 *
 * // Option 2: Manual initialization
 * import { loadTagLibModule } from "taglib-wasm";
 * const module = await loadTagLibModule();
 * const taglib = new TagLib(module);
 *
 * // Open and process a file
 * const file = await taglib.openFile(audioBuffer);
 * const tag = file.tag();
 * console.log(`Title: ${tag.title}`);
 * file.dispose();
 * ```
 */
export class TagLib {
  private module: TagLibModule;

  constructor(module: WasmModule) {
    this.module = module as TagLibModule;
  }

  /**
   * Initialize TagLib with default configuration.
   * This is the recommended way to create a TagLib instance.
   *
   * @returns Promise resolving to initialized TagLib instance
   *
   * @example
   * ```typescript
   * const taglib = await TagLib.initialize();
   * const file = await taglib.openFile(buffer);
   * ```
   */
  static async initialize(): Promise<TagLib> {
    // Use the loadTagLibModule function
    const { loadTagLibModule } = await import("../index.ts");
    const module = await loadTagLibModule();
    return new TagLib(module);
  }

  /**
   * Open an audio file from a buffer.
   * Automatically detects the file format based on content.
   *
   * @param buffer - Audio file data as ArrayBuffer or typed array
   * @returns Promise resolving to AudioFile instance
   * @throws {Error} If the file format is invalid or unsupported
   * @throws {Error} If the module is not properly initialized
   *
   * @example
   * ```typescript
   * // From ArrayBuffer
   * const file = await taglib.openFile(arrayBuffer);
   *
   * // From Uint8Array
   * const uint8Array = new Uint8Array(buffer);
   * const file = await taglib.openFile(uint8Array.buffer);
   *
   * // Remember to dispose when done
   * file.dispose();
   * ```
   */
  async openFile(buffer: ArrayBuffer): Promise<AudioFile> {
    // Check if Embind is available
    if (!this.module.createFileHandle) {
      throw new Error(
        "TagLib module not properly initialized - createFileHandle not found",
      );
    }

    // Convert ArrayBuffer to Uint8Array for Embind
    const uint8Array = new Uint8Array(buffer);

    // Create a new FileHandle
    const fileHandle = this.module.createFileHandle();

    // Load the buffer - Embind should handle Uint8Array conversion
    const success = fileHandle.loadFromBuffer(uint8Array);
    if (!success) {
      throw new Error("Failed to load file from buffer");
    }

    return new AudioFileImpl(this.module, fileHandle);
  }

  /**
   * Get the TagLib version.
   * @returns Version string (e.g., "2.1.0")
   */
  version(): string {
    return "2.1.0"; // TagLib version we're using
  }
}

/**
 * Create a TagLib instance from a pre-loaded Wasm module.
 * For advanced users who need custom module configuration.
 *
 * @param module - Pre-loaded Wasm module from loadTagLibModule()
 * @returns Promise resolving to TagLib instance
 *
 * @example
 * ```typescript
 * import { loadTagLibModule, createTagLib } from "taglib-wasm";
 *
 * const module = await loadTagLibModule();
 * const taglib = await createTagLib(module);
 * ```
 */
export async function createTagLib(module: WasmModule): Promise<TagLib> {
  return new TagLib(module);
}
