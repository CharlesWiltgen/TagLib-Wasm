import type { TagLibModule, WasmModule } from "./wasm";
import type {
  AudioProperties,
  FileType,
  PropertyMap,
  Tag as BasicTag,
  Picture,
} from "./types";
import {
  InvalidFormatError,
  MetadataError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "./errors";
import { readFileData } from "./utils/file";
import { writeFileData } from "./utils/write";

/**
 * Extended Tag interface with read/write capabilities for audio metadata.
 * Extends the basic Tag interface with setter methods for modifying metadata.
 *
 * @example
 * ```typescript
 * const file = await taglib.open("song.mp3");
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
 * const file = await taglib.open("song.mp3");
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
   * Save all changes to a file on disk.
   * This first saves changes to the in-memory buffer, then writes to the specified path.
   * @param path - Optional file path. If not provided, saves to the original path (if opened from a file).
   * @throws {Error} If no path is available or write fails
   */
  saveToFile(path?: string): Promise<void>;

  /**
   * Check if the file was loaded successfully and is valid.
   * @returns true if the file is valid and can be processed
   */
  isValid(): boolean;

  /**
   * Get all pictures/cover art from the audio file.
   * @returns Array of Picture objects
   */
  getPictures(): Picture[];

  /**
   * Set pictures/cover art in the audio file (replaces all existing).
   * @param pictures - Array of Picture objects to set
   */
  setPictures(pictures: Picture[]): void;

  /**
   * Add a single picture to the audio file.
   * @param picture - Picture object to add
   */
  addPicture(picture: Picture): void;

  /**
   * Remove all pictures from the audio file.
   */
  removePictures(): void;

  /**
   * Release all resources associated with this file.
   * Always call this when done to prevent memory leaks.
   */
  dispose(): void;

  // Extended metadata helper methods

  /**
   * Get MusicBrainz Track ID.
   * @returns MusicBrainz Track ID or undefined if not set
   */
  getMusicBrainzTrackId(): string | undefined;

  /**
   * Set MusicBrainz Track ID.
   * @param id - MusicBrainz Track ID (UUID format)
   */
  setMusicBrainzTrackId(id: string): void;

  /**
   * Get MusicBrainz Release ID.
   * @returns MusicBrainz Release ID or undefined if not set
   */
  getMusicBrainzReleaseId(): string | undefined;

  /**
   * Set MusicBrainz Release ID.
   * @param id - MusicBrainz Release ID (UUID format)
   */
  setMusicBrainzReleaseId(id: string): void;

  /**
   * Get MusicBrainz Artist ID.
   * @returns MusicBrainz Artist ID or undefined if not set
   */
  getMusicBrainzArtistId(): string | undefined;

  /**
   * Set MusicBrainz Artist ID.
   * @param id - MusicBrainz Artist ID (UUID format)
   */
  setMusicBrainzArtistId(id: string): void;

  /**
   * Get AcoustID fingerprint.
   * @returns AcoustID fingerprint or undefined if not set
   */
  getAcoustIdFingerprint(): string | undefined;

  /**
   * Set AcoustID fingerprint.
   * @param fingerprint - AcoustID fingerprint
   */
  setAcoustIdFingerprint(fingerprint: string): void;

  /**
   * Get AcoustID ID.
   * @returns AcoustID ID or undefined if not set
   */
  getAcoustIdId(): string | undefined;

  /**
   * Set AcoustID ID.
   * @param id - AcoustID ID
   */
  setAcoustIdId(id: string): void;

  /**
   * Get ReplayGain track gain.
   * @returns ReplayGain track gain (e.g., "-6.54 dB") or undefined
   */
  getReplayGainTrackGain(): string | undefined;

  /**
   * Set ReplayGain track gain.
   * @param gain - ReplayGain track gain (e.g., "-6.54 dB")
   */
  setReplayGainTrackGain(gain: string): void;

  /**
   * Get ReplayGain track peak.
   * @returns ReplayGain track peak (0.0-1.0) or undefined
   */
  getReplayGainTrackPeak(): string | undefined;

  /**
   * Set ReplayGain track peak.
   * @param peak - ReplayGain track peak (0.0-1.0)
   */
  setReplayGainTrackPeak(peak: string): void;

  /**
   * Get ReplayGain album gain.
   * @returns ReplayGain album gain (e.g., "-7.89 dB") or undefined
   */
  getReplayGainAlbumGain(): string | undefined;

  /**
   * Set ReplayGain album gain.
   * @param gain - ReplayGain album gain (e.g., "-7.89 dB")
   */
  setReplayGainAlbumGain(gain: string): void;

  /**
   * Get ReplayGain album peak.
   * @returns ReplayGain album peak (0.0-1.0) or undefined
   */
  getReplayGainAlbumPeak(): string | undefined;

  /**
   * Set ReplayGain album peak.
   * @param peak - ReplayGain album peak (0.0-1.0)
   */
  setReplayGainAlbumPeak(peak: string): void;

  /**
   * Get Apple Sound Check normalization data.
   * @returns Apple Sound Check data (iTunNORM) or undefined
   */
  getAppleSoundCheck(): string | undefined;

  /**
   * Set Apple Sound Check normalization data.
   * @param data - Apple Sound Check data (iTunNORM format)
   */
  setAppleSoundCheck(data: string): void;
}

/**
 * Implementation of AudioFile interface using Embind API.
 * Wraps the native TagLib C++ FileHandle object.
 *
 * @internal This class is not meant to be instantiated directly.
 * Use TagLib.open() to create instances.
 */
export class AudioFileImpl implements AudioFile {
  private fileHandle: any;
  private cachedTag: Tag | null = null;
  private cachedAudioProperties: AudioProperties | null = null;
  private sourcePath?: string;

  constructor(
    private module: TagLibModule,
    fileHandle: any,
    sourcePath?: string,
  ) {
    this.fileHandle = fileHandle;
    this.sourcePath = sourcePath;
  }

  /** @inheritdoc */
  getFormat(): FileType {
    return this.fileHandle.getFormat() as FileType;
  }

  /** @inheritdoc */
  tag(): Tag {
    const tagWrapper = this.fileHandle.getTag();
    if (!tagWrapper) {
      throw new MetadataError(
        "read",
        "Tag may be corrupted or format not fully supported"
      );
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
      const format = this.getFormat();
      throw new UnsupportedFormatError(
        format,
        ["MP4", "M4A"]
      );
    }
    const value = this.fileHandle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  /** @inheritdoc */
  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      const format = this.getFormat();
      throw new UnsupportedFormatError(
        format,
        ["MP4", "M4A"]
      );
    }
    this.fileHandle.setMP4Item(key, value);
  }

  /** @inheritdoc */
  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      const format = this.getFormat();
      throw new UnsupportedFormatError(
        format,
        ["MP4", "M4A"]
      );
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
    const buffer = this.fileHandle.getBuffer();
    if (!buffer) {
      return new Uint8Array(0);
    }

    // The buffer is already a Uint8Array from the C++ side
    return buffer;
  }

  /** @inheritdoc */
  async saveToFile(path?: string): Promise<void> {
    // Determine the target path
    const targetPath = path || this.sourcePath;
    if (!targetPath) {
      throw new Error(
        "No file path available. Either provide a path or open the file from a path."
      );
    }

    // First save to in-memory buffer
    if (!this.save()) {
      throw new Error("Failed to save changes to in-memory buffer");
    }

    // Get the updated buffer and write to file
    const buffer = this.getFileBuffer();
    await writeFileData(targetPath, buffer);
  }

  /** @inheritdoc */
  isValid(): boolean {
    return this.fileHandle.isValid();
  }

  /** @inheritdoc */
  getPictures(): Picture[] {
    const picturesArray = this.fileHandle.getPictures();
    const pictures: Picture[] = [];
    
    // Convert from Emscripten array to TypeScript array
    for (let i = 0; i < picturesArray.length; i++) {
      const pic = picturesArray[i];
      pictures.push({
        mimeType: pic.mimeType,
        data: pic.data,
        type: pic.type,
        description: pic.description
      });
    }
    
    return pictures;
  }

  /** @inheritdoc */
  setPictures(pictures: Picture[]): void {
    // Convert TypeScript array to format expected by C++
    const picturesArray = pictures.map(pic => ({
      mimeType: pic.mimeType,
      data: pic.data,
      type: pic.type,
      description: pic.description || ""
    }));
    
    this.fileHandle.setPictures(picturesArray);
  }

  /** @inheritdoc */
  addPicture(picture: Picture): void {
    const pic = {
      mimeType: picture.mimeType,
      data: picture.data,
      type: picture.type,
      description: picture.description || ""
    };
    
    this.fileHandle.addPicture(pic);
  }

  /** @inheritdoc */
  removePictures(): void {
    this.fileHandle.removePictures();
  }

  /** @inheritdoc */
  dispose(): void {
    if (this.fileHandle) {
      // Explicitly destroy the C++ object to free memory immediately
      if (typeof this.fileHandle.destroy === 'function') {
        this.fileHandle.destroy();
      }
      // Clear all references
      this.fileHandle = null;
      this.cachedTag = null;
      this.cachedAudioProperties = null;
    }
  }

  // Extended metadata implementations

  /** @inheritdoc */
  getMusicBrainzTrackId(): string | undefined {
    const value = this.getProperty("MUSICBRAINZ_TRACKID");
    return value || undefined;
  }

  /** @inheritdoc */
  setMusicBrainzTrackId(id: string): void {
    this.setProperty("MUSICBRAINZ_TRACKID", id);
  }

  /** @inheritdoc */
  getMusicBrainzReleaseId(): string | undefined {
    const value = this.getProperty("MUSICBRAINZ_ALBUMID");
    return value || undefined;
  }

  /** @inheritdoc */
  setMusicBrainzReleaseId(id: string): void {
    this.setProperty("MUSICBRAINZ_ALBUMID", id);
  }

  /** @inheritdoc */
  getMusicBrainzArtistId(): string | undefined {
    const value = this.getProperty("MUSICBRAINZ_ARTISTID");
    return value || undefined;
  }

  /** @inheritdoc */
  setMusicBrainzArtistId(id: string): void {
    this.setProperty("MUSICBRAINZ_ARTISTID", id);
  }

  /** @inheritdoc */
  getAcoustIdFingerprint(): string | undefined {
    const value = this.getProperty("ACOUSTID_FINGERPRINT");
    return value || undefined;
  }

  /** @inheritdoc */
  setAcoustIdFingerprint(fingerprint: string): void {
    this.setProperty("ACOUSTID_FINGERPRINT", fingerprint);
  }

  /** @inheritdoc */
  getAcoustIdId(): string | undefined {
    const value = this.getProperty("ACOUSTID_ID");
    return value || undefined;
  }

  /** @inheritdoc */
  setAcoustIdId(id: string): void {
    this.setProperty("ACOUSTID_ID", id);
  }

  /** @inheritdoc */
  getReplayGainTrackGain(): string | undefined {
    const value = this.getProperty("REPLAYGAIN_TRACK_GAIN");
    return value || undefined;
  }

  /** @inheritdoc */
  setReplayGainTrackGain(gain: string): void {
    this.setProperty("REPLAYGAIN_TRACK_GAIN", gain);
  }

  /** @inheritdoc */
  getReplayGainTrackPeak(): string | undefined {
    const value = this.getProperty("REPLAYGAIN_TRACK_PEAK");
    return value || undefined;
  }

  /** @inheritdoc */
  setReplayGainTrackPeak(peak: string): void {
    this.setProperty("REPLAYGAIN_TRACK_PEAK", peak);
  }

  /** @inheritdoc */
  getReplayGainAlbumGain(): string | undefined {
    const value = this.getProperty("REPLAYGAIN_ALBUM_GAIN");
    return value || undefined;
  }

  /** @inheritdoc */
  setReplayGainAlbumGain(gain: string): void {
    this.setProperty("REPLAYGAIN_ALBUM_GAIN", gain);
  }

  /** @inheritdoc */
  getReplayGainAlbumPeak(): string | undefined {
    const value = this.getProperty("REPLAYGAIN_ALBUM_PEAK");
    return value || undefined;
  }

  /** @inheritdoc */
  setReplayGainAlbumPeak(peak: string): void {
    this.setProperty("REPLAYGAIN_ALBUM_PEAK", peak);
  }

  /** @inheritdoc */
  getAppleSoundCheck(): string | undefined {
    // Apple Sound Check is stored differently in MP4 files
    if (this.isMP4()) {
      return this.getMP4Item("iTunNORM");
    }
    // For other formats, it might be in properties
    const value = this.getProperty("ITUNESOUNDCHECK");
    return value || undefined;
  }

  /** @inheritdoc */
  setAppleSoundCheck(data: string): void {
    // Apple Sound Check is stored differently in MP4 files
    if (this.isMP4()) {
      this.setMP4Item("iTunNORM", data);
    } else {
      // For other formats, store in properties
      this.setProperty("ITUNESOUNDCHECK", data);
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
 * const file = await taglib.open("song.mp3");
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
   * const file = await taglib.open("song.mp3");
   * ```
   */
  static async initialize(): Promise<TagLib> {
    // Use the loadTagLibModule function
    const { loadTagLibModule } = await import("../index");
    const module = await Promise.resolve(loadTagLibModule());
    return new TagLib(module);
  }

  /**
   * Open an audio file from various sources.
   * Automatically detects the file format based on content.
   *
   * @param input - File path (string), ArrayBuffer, Uint8Array, or File object
   * @returns Promise resolving to AudioFile instance
   * @throws {Error} If the file format is invalid or unsupported
   * @throws {Error} If the module is not properly initialized
   *
   * @example
   * ```typescript
   * // From file path
   * const file = await taglib.open("song.mp3");
   *
   * // From ArrayBuffer
   * const file = await taglib.open(arrayBuffer);
   *
   * // From Uint8Array
   * const file = await taglib.open(uint8Array);
   *
   * // From File object (browser)
   * const file = await taglib.open(fileObject);
   *
   * // Remember to dispose when done
   * file.dispose();
   * ```
   */
  async open(input: string | ArrayBuffer | Uint8Array | File): Promise<AudioFile> {
    // Check if Embind is available
    if (!this.module.createFileHandle) {
      throw new TagLibInitializationError(
        "TagLib module not properly initialized: createFileHandle not found. " +
          "Make sure the module is fully loaded before calling open."
      );
    }

    // Track the source path if input is a string
    const sourcePath = typeof input === "string" ? input : undefined;

    // Read file data if input is a path or File object
    const audioData = await readFileData(input);
    
    // Ensure we pass the correct slice of the buffer
    const buffer = audioData.buffer.slice(
      audioData.byteOffset,
      audioData.byteOffset + audioData.byteLength
    );

    // Convert ArrayBuffer to Uint8Array for Embind
    const uint8Array = new Uint8Array(buffer);

    // Create a new FileHandle
    const fileHandle = this.module.createFileHandle();

    // Load the buffer - Embind should handle Uint8Array conversion
    const success = fileHandle.loadFromBuffer(uint8Array);
    if (!success) {
      throw new InvalidFormatError(
        "Failed to load audio file. File may be corrupted or in an unsupported format",
        buffer.byteLength
      );
    }

    return new AudioFileImpl(this.module, fileHandle, sourcePath);
  }

  /**
   * Update tags in a file and save changes to disk in one operation.
   * This is a convenience method that opens, modifies, saves, and closes the file.
   *
   * @param path - File path to update
   * @param tags - Object containing tags to update
   * @throws {Error} If file operations fail
   *
   * @example
   * ```typescript
   * await taglib.updateFile("song.mp3", {
   *   title: "New Title",
   *   artist: "New Artist"
   * });
   * ```
   */
  async updateFile(path: string, tags: Partial<BasicTag>): Promise<void> {
    const file = await this.open(path);
    try {
      const tag = file.tag();
      
      // Apply tag updates
      if (tags.title !== undefined) tag.setTitle(tags.title);
      if (tags.artist !== undefined) tag.setArtist(tags.artist);
      if (tags.album !== undefined) tag.setAlbum(tags.album);
      if (tags.year !== undefined) tag.setYear(tags.year);
      if (tags.track !== undefined) tag.setTrack(tags.track);
      if (tags.genre !== undefined) tag.setGenre(tags.genre);
      if (tags.comment !== undefined) tag.setComment(tags.comment);
      
      // Save to file
      await file.saveToFile();
    } finally {
      file.dispose();
    }
  }

  /**
   * Copy a file with new tags.
   * Opens the source file, applies new tags, and saves to a new location.
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param tags - Object containing tags to apply
   * @throws {Error} If file operations fail
   *
   * @example
   * ```typescript
   * await taglib.copyWithTags("original.mp3", "copy.mp3", {
   *   title: "Copy of Song",
   *   comment: "This is a copy"
   * });
   * ```
   */
  async copyWithTags(
    sourcePath: string,
    destPath: string,
    tags: Partial<BasicTag>
  ): Promise<void> {
    const file = await this.open(sourcePath);
    try {
      const tag = file.tag();
      
      // Apply tag updates
      if (tags.title !== undefined) tag.setTitle(tags.title);
      if (tags.artist !== undefined) tag.setArtist(tags.artist);
      if (tags.album !== undefined) tag.setAlbum(tags.album);
      if (tags.year !== undefined) tag.setYear(tags.year);
      if (tags.track !== undefined) tag.setTrack(tags.track);
      if (tags.genre !== undefined) tag.setGenre(tags.genre);
      if (tags.comment !== undefined) tag.setComment(tags.comment);
      
      // Save to new location
      await file.saveToFile(destPath);
    } finally {
      file.dispose();
    }
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

/**
 * Re-export error types for convenient error handling
 */
export {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
  MemoryError,
  MetadataError,
  SUPPORTED_FORMATS,
  TagLibError,
  TagLibErrorCode,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "./errors";
