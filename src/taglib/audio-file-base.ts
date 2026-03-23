import type { FileHandle, TagLibModule } from "../wasm.ts";
import type {
  AudioProperties,
  FileType,
  OpenOptions,
  PropertyMap,
} from "../types.ts";
import { remapKeysFromTagLib, toTagLibKey } from "../constants/properties.ts";
import { MetadataError, UnsupportedFormatError } from "../errors.ts";
import type { MutableTag } from "./mutable-tag.ts";
import type { TypedAudioFile } from "./audio-file-interface.ts";

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
  protected originalSource?: string | Uint8Array | ArrayBuffer | File;
  protected isPartiallyLoaded: boolean = false;
  protected readonly partialLoadOptions?: OpenOptions;

  constructor(
    protected readonly module: TagLibModule,
    fileHandle: FileHandle,
    sourcePath?: string,
    originalSource?: string | Uint8Array | ArrayBuffer | File,
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

  isFormat<F extends FileType>(format: F): this is TypedAudioFile<F> {
    return this.getFormat() === format;
  }

  tag(): MutableTag {
    const handle = this.handle;
    let data = handle.getTagData();
    const tag: MutableTag = {
      get title() {
        return data.title;
      },
      get artist() {
        return data.artist;
      },
      get album() {
        return data.album;
      },
      get comment() {
        return data.comment;
      },
      get genre() {
        return data.genre;
      },
      get year() {
        return data.year;
      },
      get track() {
        return data.track;
      },
      setTitle: (value: string) => {
        handle.setTagData({ title: value });
        data = handle.getTagData();
        return tag;
      },
      setArtist: (value: string) => {
        handle.setTagData({ artist: value });
        data = handle.getTagData();
        return tag;
      },
      setAlbum: (value: string) => {
        handle.setTagData({ album: value });
        data = handle.getTagData();
        return tag;
      },
      setComment: (value: string) => {
        handle.setTagData({ comment: value });
        data = handle.getTagData();
        return tag;
      },
      setGenre: (value: string) => {
        handle.setTagData({ genre: value });
        data = handle.getTagData();
        return tag;
      },
      setYear: (value: number) => {
        handle.setTagData({ year: value });
        data = handle.getTagData();
        return tag;
      },
      setTrack: (value: number) => {
        handle.setTagData({ track: value });
        data = handle.getTagData();
        return tag;
      },
    };
    return tag;
  }

  audioProperties(): AudioProperties | undefined {
    if (!this.cachedAudioProperties) {
      this.cachedAudioProperties = this.handle.getAudioProperties() ?? null;
    }
    return this.cachedAudioProperties ?? undefined;
  }

  properties(): PropertyMap {
    return remapKeysFromTagLib(this.handle.getProperties()) as PropertyMap;
  }

  setProperties(properties: PropertyMap): void {
    const translated: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(properties)) {
      if (values !== undefined) translated[toTagLibKey(key)] = values;
    }
    this.handle.setProperties(translated);
  }

  getProperty(key: string): string | undefined {
    const value = this.handle.getProperty(toTagLibKey(key));
    return value === "" ? undefined : value;
  }

  setProperty(key: string, value: string): void {
    this.handle.setProperty(toTagLibKey(key), value);
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
