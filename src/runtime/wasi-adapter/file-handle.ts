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
import type { Picture } from "../../types.ts";
import {
  CAMEL_TO_VORBIS,
  VORBIS_TO_CAMEL,
} from "../../types/metadata-mappings.ts";
import { readTagsFromWasm, writeTagsToWasm } from "./wasm-io.ts";

const AUDIO_KEYS = new Set([
  "bitrate",
  "bitsPerSample",
  "channels",
  "codec",
  "containerFormat",
  "isLossless",
  "length",
  "lengthMs",
  "sampleRate",
]);

const INTERNAL_KEYS = new Set(["pictures", "ratings"]);

export class WasiFileHandle implements FileHandle {
  private readonly wasi: WasiModule;
  private fileData: Uint8Array | null = null;
  private tagData: Record<string, unknown> | null = null;
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
    this.tagData = decodeTagData(msgpackData) as unknown as Record<
      string,
      unknown
    >;
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

  private createTagWrapper(data: Record<string, unknown>): TagWrapper {
    return {
      title: () => (data.title as string) || "",
      artist: () => (data.artist as string) || "",
      album: () => (data.album as string) || "",
      comment: () => (data.comment as string) || "",
      genre: () => (data.genre as string) || "",
      year: () => (data.year as number) || 0,
      track: () => (data.track as number) || 0,

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

  getAudioProperties(): AudioPropertiesWrapper | null {
    this.checkNotDestroyed();
    if (!this.tagData || !("sampleRate" in this.tagData)) return null;
    const data = this.tagData;
    return {
      lengthInSeconds: () => (data.length as number) ?? 0,
      lengthInMilliseconds: () => (data.lengthMs as number) ?? 0,
      bitrate: () => (data.bitrate as number) ?? 0,
      sampleRate: () => (data.sampleRate as number) ?? 0,
      channels: () => (data.channels as number) ?? 0,
      bitsPerSample: () => (data.bitsPerSample as number) ?? 0,
      codec: () => (data.codec as string) ?? "",
      containerFormat: () => (data.containerFormat as string) ?? "",
      isLossless: () => (data.isLossless as boolean) ?? false,
    };
  }

  getFormat(): string {
    this.checkNotDestroyed();
    if (!this.fileData || this.fileData.length < 8) return "Unknown";
    const magic = this.fileData.slice(0, 4);
    if (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) return "MP3";
    if (magic[0] === 0x49 && magic[1] === 0x44 && magic[2] === 0x33) {
      return "MP3";
    }
    if (
      magic[0] === 0x66 && magic[1] === 0x4C && magic[2] === 0x61 &&
      magic[3] === 0x43
    ) return "FLAC";
    if (
      magic[0] === 0x4F && magic[1] === 0x67 && magic[2] === 0x67 &&
      magic[3] === 0x53
    ) return "OGG";
    if (
      magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 &&
      magic[3] === 0x46
    ) return "WAV";
    const ftyp = this.fileData.slice(4, 8);
    if (
      ftyp[0] === 0x66 && ftyp[1] === 0x74 && ftyp[2] === 0x79 &&
      ftyp[3] === 0x70
    ) return "MP4";
    return "Unknown";
  }

  getBuffer(): Uint8Array {
    this.checkNotDestroyed();
    return this.fileData ?? new Uint8Array(0);
  }

  getProperties(): Record<string, string[]> {
    this.checkNotDestroyed();
    const result: Record<string, string[]> = {};
    const data = this.tagData ?? {};

    for (const [key, value] of Object.entries(data)) {
      if (AUDIO_KEYS.has(key) || INTERNAL_KEYS.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (value === 0 || value === "") continue;

      const propKey = CAMEL_TO_VORBIS[key] ?? key;
      result[propKey] = [String(value)];
    }

    return result;
  }

  setProperties(props: Record<string, string[]>): void {
    this.checkNotDestroyed();
    const mapped: Record<string, unknown> = {};
    for (const [key, values] of Object.entries(props)) {
      const camelKey = VORBIS_TO_CAMEL[key] ?? key;
      const scalar = values[0] ?? "";
      if (camelKey === "year" || camelKey === "track") {
        mapped[camelKey] = parseInt(scalar, 10) || 0;
      } else {
        mapped[camelKey] = scalar;
      }
    }
    this.tagData = { ...this.tagData, ...mapped } as Record<string, unknown>;
  }

  getProperty(key: string): string {
    this.checkNotDestroyed();
    const mappedKey = VORBIS_TO_CAMEL[key] ?? key;
    return this.tagData?.[mappedKey]?.toString() ?? "";
  }

  setProperty(key: string, value: string): void {
    this.checkNotDestroyed();
    const mappedKey = VORBIS_TO_CAMEL[key] ?? key;
    const coerced = (mappedKey === "year" || mappedKey === "track")
      ? (parseInt(value, 10) || 0)
      : value;
    this.tagData = { ...this.tagData, [mappedKey]: coerced };
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
      delete this.tagData[VORBIS_TO_CAMEL[key] ?? key];
    }
  }

  getPictures(): Picture[] {
    this.checkNotDestroyed();
    return (this.tagData?.pictures as Picture[] | undefined) ?? [];
  }

  setPictures(pictures: Picture[]): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, pictures } as Record<string, unknown>;
  }

  addPicture(picture: Picture): void {
    this.checkNotDestroyed();
    const pictures = this.getPictures();
    pictures.push(picture);
    this.setPictures(pictures);
  }

  removePictures(): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, pictures: [] } as Record<string, unknown>;
  }

  getRatings(): { rating: number; email: string; counter: number }[] {
    this.checkNotDestroyed();
    return (this.tagData?.ratings as
      | { rating: number; email: string; counter: number }[]
      | undefined) ?? [];
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
    } as Record<string, unknown>;
  }

  destroy(): void {
    this.fileData = null;
    this.tagData = null;
    this.destroyed = true;
  }
}
