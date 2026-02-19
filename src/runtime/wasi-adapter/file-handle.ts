/**
 * @fileoverview WASI-based FileHandle implementation
 */

import type {
  AudioPropertiesWrapper,
  FileHandle,
  TagWrapper,
} from "../../wasm.ts";
import type { WasiModule } from "../wasmer-sdk-loader/index.ts";
import { WasmerExecutionError } from "../wasmer-sdk-loader/index.ts";
import { decodeTagData } from "../../msgpack/decoder.ts";
import type { ExtendedTag, Picture } from "../../types.ts";
import { readTagsFromWasm, writeTagsToWasm } from "./wasm-io.ts";

export class WasiFileHandle implements FileHandle {
  private readonly wasi: WasiModule;
  private fileData: Uint8Array | null = null;
  private tagData: ExtendedTag | null = null;
  private destroyed = false;

  constructor(wasiModule: WasiModule) {
    this.wasi = wasiModule;
  }

  private checkNotDestroyed(): void {
    if (this.destroyed) {
      throw new WasmerExecutionError(
        "FileHandle has been destroyed",
      );
    }
  }

  loadFromBuffer(buffer: Uint8Array): boolean {
    this.checkNotDestroyed();
    this.fileData = buffer;
    const msgpackData = readTagsFromWasm(this.wasi, buffer);
    this.tagData = decodeTagData(msgpackData);
    return true;
  }

  loadFromPath(_path: string): boolean {
    this.checkNotDestroyed();
    throw new WasmerExecutionError(
      "loadFromPath not implemented for WASI - use loadFromBuffer",
    );
  }

  isValid(): boolean {
    this.checkNotDestroyed();
    return this.fileData !== null && this.fileData.length > 0;
  }

  save(): boolean {
    this.checkNotDestroyed();
    if (!this.fileData || !this.tagData) {
      return false;
    }

    const result = writeTagsToWasm(this.wasi, this.fileData, this.tagData);
    if (result) {
      this.fileData = result;
      return true;
    }
    return false;
  }

  getTag(): TagWrapper {
    this.checkNotDestroyed();
    if (!this.tagData) {
      return this.createTagWrapper({});
    }

    return this.createTagWrapper(this.tagData);
  }

  private createTagWrapper(data: Partial<ExtendedTag>): TagWrapper {
    return {
      title: () => data.title || "",
      artist: () => data.artist || "",
      album: () => data.album || "",
      comment: () => data.comment || "",
      genre: () => data.genre || "",
      year: () => data.year || 0,
      track: () => data.track || 0,

      setTitle: (value: string) => {
        this.tagData = { ...this.tagData, title: value };
      },
      setArtist: (value: string) => {
        this.tagData = { ...this.tagData, artist: value };
      },
      setAlbum: (value: string) => {
        this.tagData = { ...this.tagData, album: value };
      },
      setComment: (value: string) => {
        this.tagData = { ...this.tagData, comment: value };
      },
      setGenre: (value: string) => {
        this.tagData = { ...this.tagData, genre: value };
      },
      setYear: (value: number) => {
        this.tagData = { ...this.tagData, year: value };
      },
      setTrack: (value: number) => {
        this.tagData = { ...this.tagData, track: value };
      },
    };
  }

  getAudioProperties(): AudioPropertiesWrapper {
    this.checkNotDestroyed();
    return {
      lengthInSeconds: () => 0,
      lengthInMilliseconds: () => 0,
      bitrate: () => 0,
      sampleRate: () => 0,
      channels: () => 0,
      bitsPerSample: () => 0,
      codec: () => "",
      containerFormat: () => "",
      isLossless: () => false,
    };
  }

  getFormat(): string {
    this.checkNotDestroyed();
    if (!this.fileData) return "Unknown";
    const magic = this.fileData.slice(0, 4);
    if (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) return "MP3";
    if (
      magic[0] === 0x66 && magic[1] === 0x4C && magic[2] === 0x61 &&
      magic[3] === 0x43
    ) return "FLAC";
    if (
      magic[0] === 0x4F && magic[1] === 0x67 && magic[2] === 0x67 &&
      magic[3] === 0x53
    ) return "OGG";
    return "Unknown";
  }

  getBuffer(): Uint8Array {
    this.checkNotDestroyed();
    return this.fileData ?? new Uint8Array(0);
  }

  getProperties(): Record<string, string[]> {
    this.checkNotDestroyed();
    return (this.tagData ?? {}) as unknown as Record<string, string[]>;
  }

  setProperties(props: Record<string, string[]>): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, ...props };
  }

  getProperty(key: string): string {
    this.checkNotDestroyed();
    const props = this.tagData as Record<string, unknown>;
    return props?.[key]?.toString() ?? "";
  }

  setProperty(key: string, value: string): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, [key]: value };
  }

  isMP4(): boolean {
    this.checkNotDestroyed();
    if (!this.fileData || this.fileData.length < 8) return false;
    const magic = this.fileData.slice(4, 8);
    return (
      magic[0] === 0x66 &&
      magic[1] === 0x74 &&
      magic[2] === 0x79 &&
      magic[3] === 0x70
    );
  }

  getMP4Item(key: string): string {
    this.checkNotDestroyed();
    return this.getProperty(key);
  }

  setMP4Item(key: string, value: string): void {
    this.checkNotDestroyed();
    this.setProperty(key, value);
  }

  removeMP4Item(key: string): void {
    this.checkNotDestroyed();
    if (this.tagData) {
      const props = this.tagData as Record<string, unknown>;
      delete props[key];
    }
  }

  getPictures(): Picture[] {
    this.checkNotDestroyed();
    return this.tagData?.pictures ?? [];
  }

  setPictures(pictures: Picture[]): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, pictures } as ExtendedTag;
  }

  addPicture(picture: Picture): void {
    this.checkNotDestroyed();
    const pictures = this.getPictures();
    pictures.push(picture);
    this.setPictures(pictures);
  }

  removePictures(): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, pictures: [] } as ExtendedTag;
  }

  getRatings(): { rating: number; email: string; counter: number }[] {
    this.checkNotDestroyed();
    return this.tagData?.ratings ?? [];
  }

  setRatings(
    ratings: { rating: number; email?: string; counter?: number }[],
  ): void {
    this.checkNotDestroyed();
    const normalizedRatings = ratings.map((r) => ({
      rating: r.rating,
      email: r.email ?? "",
      counter: r.counter ?? 0,
    }));
    this.tagData = {
      ...this.tagData,
      ratings: normalizedRatings,
    } as ExtendedTag;
  }

  destroy(): void {
    this.fileData = null;
    this.tagData = null;
    this.destroyed = true;
  }
}
