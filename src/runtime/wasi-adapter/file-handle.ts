/**
 * @fileoverview WASI-based FileHandle implementation
 */

import type { FileHandle, RawPicture } from "../../wasm.ts";
import type { BasicTagData } from "../../types/tags.ts";
import type {
  AudioCodec,
  AudioProperties,
  ContainerFormat,
} from "../../types.ts";
import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import { WasmerExecutionError } from "../wasmer-sdk-loader/types.ts";
import { decodeTagData } from "../../msgpack/decoder.ts";
import { fromTagLibKey, toTagLibKey } from "../../constants/properties.ts";
import {
  readTagsFromWasm,
  readTagsFromWasmPath,
  writeTagsToWasm,
  writeTagsToWasmPath,
} from "./wasm-io.ts";

const AUDIO_KEYS = new Set([
  "bitrate",
  "bitsPerSample",
  "channels",
  "codec",
  "containerFormat",
  "formatVersion",
  "isEncrypted",
  "isLossless",
  "duration",
  "length",
  "lengthMs",
  "mpegLayer",
  "mpegVersion",
  "sampleRate",
]);

const INTERNAL_KEYS = new Set(["pictures", "ratings"]);

const CONTAINER_TO_FORMAT: Record<string, string> = {
  MP3: "MP3",
  MP4: "MP4",
  FLAC: "FLAC",
  OGG: "OGG",
  WAV: "WAV",
  AIFF: "AIFF",
  WavPack: "WV",
  TTA: "TTA",
  ASF: "ASF",
  Matroska: "MATROSKA",
};

const NUMERIC_FIELD_ALIASES: Record<string, string> = {
  date: "year",
  trackNumber: "track",
};

function firstString(v: unknown): string {
  if (Array.isArray(v)) return (v[0] as string) ?? "";
  return (v as string) || "";
}

export class WasiFileHandle implements FileHandle {
  private readonly wasi: WasiModule;
  private fileData: Uint8Array | null = null;
  private filePath: string | null = null;
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

  loadFromPath(path: string): boolean {
    this.checkNotDestroyed();
    this.filePath = path;
    const msgpackData = readTagsFromWasmPath(this.wasi, path);
    this.tagData = decodeTagData(msgpackData) as unknown as Record<
      string,
      unknown
    >;
    return true;
  }

  isValid(): boolean {
    this.checkNotDestroyed();
    return (this.fileData !== null && this.fileData.length > 0) ||
      (this.filePath !== null && this.tagData !== null);
  }

  save(): boolean {
    this.checkNotDestroyed();
    if (!this.tagData) return false;

    if (this.filePath) {
      return writeTagsToWasmPath(
        this.wasi,
        this.filePath,
        this.tagData as import("../../types.ts").ExtendedTag,
      );
    }

    if (!this.fileData) return false;
    const result = writeTagsToWasm(this.wasi, this.fileData, this.tagData);
    if (result) {
      this.fileData = result;
      return true;
    }
    return false;
  }

  getTagData(): BasicTagData {
    this.checkNotDestroyed();
    const d = this.tagData ?? {};
    return {
      title: firstString(d.title),
      artist: firstString(d.artist),
      album: firstString(d.album),
      comment: firstString(d.comment),
      genre: firstString(d.genre),
      year: (d.year as number) || 0,
      track: (d.track as number) || 0,
    };
  }

  setTagData(data: Partial<BasicTagData>): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, ...data } as Record<string, unknown>;
  }

  getAudioProperties(): AudioProperties | null {
    this.checkNotDestroyed();
    if (!this.tagData || !("sampleRate" in this.tagData)) return null;
    const d = this.tagData;
    const containerFormat =
      ((d.containerFormat as string) || "unknown") as ContainerFormat;
    const mpegVersion = (d.mpegVersion as number) ?? 0;
    const formatVersion = (d.formatVersion as number) ?? 0;
    return {
      duration: (d.length as number) ?? 0,
      durationMs: (d.lengthMs as number) ?? 0,
      bitrate: (d.bitrate as number) ?? 0,
      sampleRate: (d.sampleRate as number) ?? 0,
      channels: (d.channels as number) ?? 0,
      bitsPerSample: (d.bitsPerSample as number) ?? 0,
      codec: ((d.codec as string) || "unknown") as AudioCodec,
      containerFormat,
      isLossless: (d.isLossless as boolean) ?? false,
      ...(mpegVersion > 0
        ? { mpegVersion, mpegLayer: (d.mpegLayer as number) ?? 0 }
        : {}),
      ...(containerFormat === "MP4" || containerFormat === "ASF"
        ? { isEncrypted: (d.isEncrypted as boolean) ?? false }
        : {}),
      ...(formatVersion > 0 ? { formatVersion } : {}),
    };
  }

  getFormat(): string {
    this.checkNotDestroyed();

    // Container-based detection works for both path and buffer modes
    const container = this.tagData?.containerFormat as string | undefined;
    if (container) {
      const codec = this.tagData?.codec as string | undefined;
      if (container === "OGG" && codec === "Opus") return "OPUS";
      if (CONTAINER_TO_FORMAT[container]) return CONTAINER_TO_FORMAT[container];
    }

    // Magic byte fallback requires buffer data
    if (!this.fileData || this.fileData.length < 8) return "unknown";
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
    ) return this.detectOggCodec();
    if (
      magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 &&
      magic[3] === 0x46
    ) return "WAV";
    // WavPack: "wvpk"
    if (
      magic[0] === 0x77 && magic[1] === 0x76 && magic[2] === 0x70 &&
      magic[3] === 0x6B
    ) return "WV";
    // TrueAudio: "TTA1"
    if (
      magic[0] === 0x54 && magic[1] === 0x54 && magic[2] === 0x41 &&
      magic[3] === 0x31
    ) return "TTA";
    // ASF/WMA: ASF header object GUID
    if (
      this.fileData.length >= 16 &&
      magic[0] === 0x30 && magic[1] === 0x26 &&
      magic[2] === 0xB2 && magic[3] === 0x75
    ) return "ASF";
    // Matroska/WebM: EBML signature
    if (
      magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF &&
      magic[3] === 0xA3
    ) return "MATROSKA";
    const ftyp = this.fileData.slice(4, 8);
    if (
      ftyp[0] === 0x66 && ftyp[1] === 0x74 && ftyp[2] === 0x79 &&
      ftyp[3] === 0x70
    ) return "MP4";
    return "unknown";
  }

  private detectOggCodec(): string {
    if (!this.fileData || this.fileData.length < 37) return "OGG";
    // OGG page header: "OggS" at 0, then header_type(1), granule(8),
    // serial(4), seq(4), crc(4), segments(1), segment_table(variable).
    // First page payload starts after 27 + segment_count bytes.
    const segCount = this.fileData[26];
    if (segCount === undefined) return "OGG";
    const payloadStart = 27 + segCount;
    if (this.fileData.length < payloadStart + 8) return "OGG";
    // Opus: payload starts with "OpusHead"
    const sig = String.fromCharCode(
      ...this.fileData.slice(payloadStart, payloadStart + 8),
    );
    if (sig === "OpusHead") return "OPUS";
    return "OGG";
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

      const propKey = toTagLibKey(key);
      if (Array.isArray(value)) {
        result[propKey] = value.map(String);
      } else if (typeof value === "object") {
        continue;
      } else {
        result[propKey] = [String(value as string | number | boolean)];
      }
    }

    return result;
  }

  setProperties(props: Record<string, string[]>): void {
    this.checkNotDestroyed();
    const mapped: Record<string, unknown> = {};
    for (const [key, values] of Object.entries(props)) {
      const camelKey = fromTagLibKey(key);
      const storeKey = NUMERIC_FIELD_ALIASES[camelKey] ?? camelKey;
      if (storeKey === "year" || storeKey === "track") {
        const parsed = Number.parseInt(values[0] ?? "", 10);
        if (!Number.isNaN(parsed)) mapped[storeKey] = parsed;
      } else {
        mapped[camelKey] = values;
      }
    }
    this.tagData = { ...this.tagData, ...mapped } as Record<string, unknown>;
  }

  getProperty(key: string): string {
    this.checkNotDestroyed();
    const mappedKey = fromTagLibKey(key);
    const storeKey = NUMERIC_FIELD_ALIASES[mappedKey] ?? mappedKey;
    return this.tagData?.[storeKey]?.toString() ?? "";
  }

  setProperty(key: string, value: string): void {
    this.checkNotDestroyed();
    const mappedKey = fromTagLibKey(key);
    const storeKey = NUMERIC_FIELD_ALIASES[mappedKey] ?? mappedKey;
    if (storeKey === "year" || storeKey === "track") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        this.tagData = { ...this.tagData, [storeKey]: parsed };
      }
    } else {
      this.tagData = { ...this.tagData, [mappedKey]: value };
    }
  }

  isMP4(): boolean {
    this.checkNotDestroyed();
    if (!this.fileData) {
      return (this.tagData?.containerFormat as string | undefined) === "MP4";
    }
    if (this.fileData.length < 8) return false;
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
      const mappedKey = fromTagLibKey(key);
      const storeKey = NUMERIC_FIELD_ALIASES[mappedKey] ?? mappedKey;
      delete this.tagData[storeKey];
    }
  }

  getPictures(): RawPicture[] {
    this.checkNotDestroyed();
    return (this.tagData?.pictures as RawPicture[] | undefined) ?? [];
  }

  setPictures(pictures: RawPicture[]): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, pictures } as Record<string, unknown>;
  }

  addPicture(picture: RawPicture): void {
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
