import type { TagLibModule, WasmModule } from "./wasm.ts";
import type { AudioProperties, FileType, PropertyMap, Tag as BasicTag } from "./types.ts";

// Extended Tag interface with setters
export interface Tag extends BasicTag {
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setComment(value: string): void;
  setGenre(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
}

export interface AudioFile {
  getFormat(): FileType;
  tag(): Tag;
  audioProperties(): AudioProperties | null;
  properties(): PropertyMap;
  setProperties(properties: PropertyMap): void;
  getProperty(key: string): string | undefined;
  setProperty(key: string, value: string): void;
  isMP4(): boolean;
  getMP4Item(key: string): string | undefined;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;
  save(): boolean;
  isValid(): boolean;
  dispose(): void;
}

/**
 * Audio file wrapper using Embind API
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

  /**
   * Get file format
   */
  getFormat(): FileType {
    return this.fileHandle.getFormat() as FileType;
  }

  /**
   * Get tag object for reading/writing metadata
   */
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

  /**
   * Get audio properties
   */
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

  /**
   * Get all properties as a PropertyMap
   */
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

  /**
   * Set properties from a PropertyMap
   */
  setProperties(properties: PropertyMap): void {
    this.fileHandle.setProperties(properties);
  }

  /**
   * Get a single property value
   */
  getProperty(key: string): string | undefined {
    const value = this.fileHandle.getProperty(key);
    return value === "" ? undefined : value;
  }

  /**
   * Set a single property value
   */
  setProperty(key: string, value: string): void {
    this.fileHandle.setProperty(key, value);
  }

  /**
   * Check if this is an MP4 file
   */
  isMP4(): boolean {
    return this.fileHandle.isMP4();
  }

  /**
   * Get MP4-specific item
   */
  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    const value = this.fileHandle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  /**
   * Set MP4-specific item
   */
  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    this.fileHandle.setMP4Item(key, value);
  }

  /**
   * Remove MP4-specific item
   */
  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      throw new Error("Not an MP4 file");
    }
    this.fileHandle.removeMP4Item(key);
  }

  /**
   * Save changes to the file
   */
  save(): boolean {
    // Clear caches since values may have changed
    this.cachedTag = null;
    this.cachedAudioProperties = null;
    
    return this.fileHandle.save();
  }

  /**
   * Check if the file is valid
   */
  isValid(): boolean {
    return this.fileHandle.isValid();
  }

  /**
   * Free resources
   */
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
 * Main TagLib interface using Embind
 */
export class TagLib {
  private module: TagLibModule;

  constructor(module: WasmModule) {
    this.module = module as TagLibModule;
  }

  /**
   * Open a file from a buffer
   */
  async openFile(buffer: ArrayBuffer): Promise<AudioFile> {
    // Convert ArrayBuffer to string for Embind
    const uint8Array = new Uint8Array(buffer);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    
    // Create a new FileHandle
    const fileHandle = this.module.createFileHandle();
    
    // Load the buffer
    const success = fileHandle.loadFromBuffer(binaryString);
    if (!success) {
      throw new Error("Failed to load file from buffer");
    }
    
    return new AudioFileImpl(this.module, fileHandle);
  }

  /**
   * Get version information
   */
  version(): string {
    return "2.1.0"; // TagLib version we're using
  }
}

/**
 * Create a TagLib instance
 */
export async function createTagLib(module: WasmModule): Promise<TagLib> {
  return new TagLib(module);
}