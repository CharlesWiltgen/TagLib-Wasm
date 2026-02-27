import type { FileHandle, TagLibModule } from "../wasm.ts";
import type {
  AudioCodec,
  AudioFileInput,
  AudioProperties,
  ContainerFormat,
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
  protected fileHandle: FileHandle | null;
  protected cachedAudioProperties: AudioProperties | null = null;
  protected readonly sourcePath?: string;
  protected originalSource?: AudioFileInput;
  protected isPartiallyLoaded: boolean = false;
  protected readonly partialLoadOptions?: OpenOptions;

  constructor(
    protected readonly module: TagLibModule,
    fileHandle: FileHandle,
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

  protected get handle(): FileHandle {
    if (!this.fileHandle) {
      throw new MetadataError("read", "File handle has been disposed");
    }
    return this.fileHandle;
  }

  getFormat(): FileType {
    return this.handle.getFormat() as FileType;
  }

  tag(): MutableTag {
    const tagWrapper = this.handle.getTag();
    if (!tagWrapper) {
      throw new MetadataError(
        "read",
        "Tag may be corrupted or format not fully supported",
      );
    }

    const tag: MutableTag = {
      get title() {
        return tagWrapper.title();
      },
      get artist() {
        return tagWrapper.artist();
      },
      get album() {
        return tagWrapper.album();
      },
      get comment() {
        return tagWrapper.comment();
      },
      get genre() {
        return tagWrapper.genre();
      },
      get year() {
        return tagWrapper.year();
      },
      get track() {
        return tagWrapper.track();
      },
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

  audioProperties(): AudioProperties | undefined {
    if (!this.cachedAudioProperties) {
      const propsWrapper = this.handle.getAudioProperties();
      if (!propsWrapper) {
        return undefined;
      }

      this.cachedAudioProperties = {
        duration: propsWrapper.lengthInSeconds(),
        bitrate: propsWrapper.bitrate(),
        sampleRate: propsWrapper.sampleRate(),
        channels: propsWrapper.channels(),
        bitsPerSample: propsWrapper.bitsPerSample(),
        codec: (propsWrapper.codec() || "Unknown") as AudioCodec,
        containerFormat:
          (propsWrapper.containerFormat() || "UNKNOWN") as ContainerFormat,
        isLossless: propsWrapper.isLossless(),
      };
    }

    return this.cachedAudioProperties;
  }

  properties(): PropertyMap {
    const jsObj = this.handle.getProperties();
    const result: PropertyMap = {};
    const keys = Object.keys(jsObj);
    for (const key of keys) {
      result[key] = jsObj[key];
    }
    return result;
  }

  setProperties(properties: PropertyMap): void {
    this.handle.setProperties(properties);
  }

  getProperty(key: string): string | undefined {
    const value = this.handle.getProperty(key);
    return value === "" ? undefined : value;
  }

  setProperty(key: string, value: string): void {
    this.handle.setProperty(key, value);
  }

  isMP4(): boolean {
    return this.handle.isMP4();
  }

  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    const value = this.handle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    this.handle.setMP4Item(key, value);
  }

  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    this.handle.removeMP4Item(key);
  }

  isValid(): boolean {
    return this.handle.isValid();
  }

  dispose(): void {
    if (this.fileHandle) {
      this.fileHandle.destroy();
      this.fileHandle = null;
      this.cachedAudioProperties = null;
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}
