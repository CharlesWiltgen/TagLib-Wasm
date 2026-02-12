import type { TagLibModule } from "../wasm.ts";
import type {
  AudioFileInput,
  AudioProperties,
  FileType,
  OpenOptions,
  PropertyMap,
} from "../types.ts";
import { MetadataError, UnsupportedFormatError } from "../errors.ts";
import type { MutableTag } from "./mutable-tag.ts";

/**
 * Base implementation with core read/property operations.
 * Extended by AudioFileImpl to add save/picture/rating/extended methods.
 *
 * @internal Not exported from the public API.
 */
export abstract class BaseAudioFileImpl {
  protected fileHandle: any;
  protected cachedTag: MutableTag | null = null;
  protected cachedAudioProperties: AudioProperties | null = null;
  protected readonly sourcePath?: string;
  protected originalSource?: AudioFileInput;
  protected isPartiallyLoaded: boolean = false;
  protected readonly partialLoadOptions?: OpenOptions;

  constructor(
    protected readonly module: TagLibModule,
    fileHandle: any,
    sourcePath?: string,
    originalSource?: AudioFileInput,
    isPartiallyLoaded: boolean = false,
    partialLoadOptions?: OpenOptions,
  ) {
    this.fileHandle = fileHandle;
    this.sourcePath = sourcePath;
    this.originalSource = originalSource;
    this.isPartiallyLoaded = isPartiallyLoaded;
    this.partialLoadOptions = partialLoadOptions;
  }

  getFormat(): FileType {
    return this.fileHandle.getFormat() as FileType;
  }

  tag(): MutableTag {
    const tagWrapper = this.fileHandle.getTag();
    if (!tagWrapper) {
      throw new MetadataError(
        "read",
        "Tag may be corrupted or format not fully supported",
      );
    }

    const tag: MutableTag = {
      title: tagWrapper.title(),
      artist: tagWrapper.artist(),
      album: tagWrapper.album(),
      comment: tagWrapper.comment(),
      genre: tagWrapper.genre(),
      year: tagWrapper.year(),
      track: tagWrapper.track(),
      setTitle: (value: string) => {
        tagWrapper.setTitle(value);
        return tag;
      },
      setArtist: (value: string) => {
        tagWrapper.setArtist(value);
        return tag;
      },
      setAlbum: (value: string) => {
        tagWrapper.setAlbum(value);
        return tag;
      },
      setComment: (value: string) => {
        tagWrapper.setComment(value);
        return tag;
      },
      setGenre: (value: string) => {
        tagWrapper.setGenre(value);
        return tag;
      },
      setYear: (value: number) => {
        tagWrapper.setYear(value);
        return tag;
      },
      setTrack: (value: number) => {
        tagWrapper.setTrack(value);
        return tag;
      },
    };
    return tag;
  }

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
        bitsPerSample: propsWrapper.bitsPerSample(),
        codec: propsWrapper.codec(),
        containerFormat: propsWrapper.containerFormat(),
        isLossless: propsWrapper.isLossless(),
      };
    }

    return this.cachedAudioProperties;
  }

  properties(): PropertyMap {
    const jsObj = this.fileHandle.getProperties();
    const result: PropertyMap = {};
    const keys = Object.keys(jsObj);
    for (const key of keys) {
      result[key] = jsObj[key];
    }
    return result;
  }

  setProperties(properties: PropertyMap): void {
    this.fileHandle.setProperties(properties);
  }

  getProperty(key: string): string | undefined {
    const value = this.fileHandle.getProperty(key);
    return value === "" ? undefined : value;
  }

  setProperty(key: string, value: string): void {
    this.fileHandle.setProperty(key, value);
  }

  isMP4(): boolean {
    return this.fileHandle.isMP4();
  }

  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    const value = this.fileHandle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    this.fileHandle.setMP4Item(key, value);
  }

  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    this.fileHandle.removeMP4Item(key);
  }

  isValid(): boolean {
    return this.fileHandle.isValid();
  }

  dispose(): void {
    if (this.fileHandle) {
      if (typeof this.fileHandle.destroy === "function") {
        this.fileHandle.destroy();
      }
      this.fileHandle = null;
      this.cachedTag = null;
      this.cachedAudioProperties = null;
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}
