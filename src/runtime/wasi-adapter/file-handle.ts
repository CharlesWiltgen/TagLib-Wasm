/**
 * @fileoverview WASI-based FileHandle implementation
 */

import type {
  FileHandle,
  RawChapter,
  RawId3v2Frame,
  RawLyrics,
  RawPicture,
} from "../../wasm.ts";
import type { BasicTagData } from "../../types/tags.ts";
import type {
  AudioCodec,
  AudioProperties,
  ContainerFormat,
} from "../../types.ts";
import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import { WasmerExecutionError } from "../wasmer-sdk-loader/types.ts";
import { decodeTagData } from "../../msgpack/decoder.ts";
import {
  fromTagLibKey,
  mp4AtomWireKey,
  toTagLibKey,
} from "../../constants/properties.ts";
import {
  DATE_MIRROR,
  firstValueString,
  isShadowedNumericMirror,
  mirrorForRawKey,
  readNumericMirror,
  stageNumericWrite,
  stageRawWrite,
  TRACK_MIRROR,
} from "../../utils/mirror-fields.ts";
import {
  readId3v2FramesFromWasm,
  readTagsFromWasm,
  readTagsFromWasmPath,
  writeTagsToWasm,
  writeTagsToWasmPath,
} from "./wasm-io.ts";

const AUDIO_KEYS = new Set([
  "bitrate",
  "bitrateMode",
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
  "outputGainDb",
  "sampleRate",
]);

const INTERNAL_KEYS = new Set([
  "pictures",
  "ratings",
  "lyrics",
  "chapters",
  "_mp4ChapterStyle",
  "bextData",
  "ixml",
  // Exact MP4 atom names for the write path, not a readable property.
  "_mp4ItemNames",
]);

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

/**
 * Normalize an MP4 item key for the PropertyMap path. TagLib's MP4 PropertyMap
 * keys a freeform `----:mean:NAME` atom by its bare NAME, uppercased (the usual
 * key remap then maps known atoms like iTunNORM -> appleSoundCheck). WASI MP4
 * items ride the PropertyMap, so the full iTunes atom key that Emscripten's
 * dedicated Item API uses must be normalized or the value is silently dropped on
 * save (taglib-1qn). Non-freeform keys pass through unchanged.
 */
function mp4ItemPropertyKey(key: string): string {
  if (key.startsWith("----:")) {
    return key.slice(key.lastIndexOf(":") + 1).toUpperCase();
  }
  // A STANDARD atom ("trkn", "©nam") is not a PropertyMap key either — TagLib
  // keys it by the corresponding property. Without this, WASI looked up
  // tagData["trkn"] while the value lives under `trackNumber`, so every item
  // operation on a standard atom silently targeted nothing (taglib-0piv).
  return mp4AtomWireKey(key) ?? key;
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
      title: firstValueString(d.title),
      artist: firstValueString(d.artist),
      album: firstValueString(d.album),
      comment: firstValueString(d.comment),
      genre: firstValueString(d.genre),
      year: readNumericMirror(d, DATE_MIRROR),
      track: readNumericMirror(d, TRACK_MIRROR),
    };
  }

  setTagData(data: Partial<BasicTagData>): void {
    this.checkNotDestroyed();
    const merged = { ...this.tagData, ...data } as Record<string, unknown>;
    // setYear()/setTrack() are authoritative for their wire key: the raw mirror
    // is replaced so a stale "1975-10-31" or "3/12" cannot shadow the new
    // number, and a non-positive value clears the field outright (taglib-bk7,
    // taglib-qpl).
    if (data.year !== undefined) {
      stageNumericWrite(merged, DATE_MIRROR, data.year);
    }
    if (data.track !== undefined) {
      stageNumericWrite(merged, TRACK_MIRROR, data.track);
    }
    this.tagData = merged;
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
      ...(d.outputGainDb !== undefined
        ? { outputGainDb: d.outputGainDb as number }
        : {}),
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
      // `year` is a numeric mirror of the DATE property; when the full `date`
      // string is present it carries DATE, so skip `year` to avoid both mapping
      // to the same "DATE" wire key (taglib-bk7).
      // A numeric mirror and its raw partner share one wire key, so emitting
      // both would collide; the raw string carries more information and wins.
      if (isShadowedNumericMirror(data, key)) continue;
      if (value === undefined || value === null) continue;
      // `0` is a numeric-mirror artefact and never a property in its own right.
      // An empty STRING is different: TagLib reported a property whose value
      // projects to nothing — a numeric-only TCON is the common case — and
      // hiding it meant the snapshot could not carry it and clearTags() could
      // not name it, so an ordinary save deleted the frame (taglib-yc1x).
      if (value === 0) continue;

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
    const next = { ...this.tagData } as Record<string, unknown>;
    for (const [key, values] of Object.entries(props)) {
      const camelKey = fromTagLibKey(key);
      if (camelKey === "_mp4ItemNames") {
        // Accumulate: a setMP4Item earlier in this handle's life may already
        // have registered a name that this call does not mention.
        const existing = (next._mp4ItemNames as string[] | undefined) ?? [];
        next._mp4ItemNames = [...new Set([...existing, ...values])];
        continue;
      }
      const mirror = mirrorForRawKey(camelKey);
      if (mirror !== undefined) {
        // Raw string verbatim, mirror re-derived; an empty list clears both.
        stageRawWrite(next, mirror, values);
      } else if (values.length === 0) {
        // An empty value list clears the property (TagLib PropertyMap
        // semantics). This is what lets clearTags() actually remove a field
        // under WASI's merge model, matching Emscripten's replace-style
        // setProperties (taglib-nc5).
        delete next[camelKey];
      } else {
        next[camelKey] = values;
      }
    }
    this.tagData = next;
  }

  getProperty(key: string): string {
    this.checkNotDestroyed();
    const mappedKey = fromTagLibKey(key);
    const stored = this.tagData?.[mappedKey];
    return Array.isArray(stored)
      ? (stored[0]?.toString() ?? "")
      : (stored?.toString() ?? "");
  }

  setProperty(key: string, value: string): void {
    this.checkNotDestroyed();
    const mappedKey = fromTagLibKey(key);
    const mirror = mirrorForRawKey(mappedKey);
    if (mirror !== undefined) {
      // The mirror must never outlive the raw string: an empty value is a clear,
      // and an unparseable one has no valid mirror. Leaving a stale number made
      // a delete a silent no-op and let tag() contradict the file (taglib-qpl,
      // taglib-iyfr).
      const next = { ...this.tagData } as Record<string, unknown>;
      stageRawWrite(next, mirror, value === "" ? [] : [value]);
      this.tagData = next;
    } else if (value === "") {
      // Deleting has to be explicit now that an empty string round-trips as a
      // real value rather than being dropped on the way out (taglib-yc1x).
      const next = { ...this.tagData } as Record<string, unknown>;
      delete next[mappedKey];
      this.tagData = next;
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
    return this.getProperty(mp4ItemPropertyKey(key));
  }

  setMP4Item(key: string, value: string): void {
    this.checkNotDestroyed();
    this.setProperty(mp4ItemPropertyKey(key), value);
    // The property slot above is keyed by the UPPERCASED bare name, which is
    // what TagLib's PropertyMap will hand back. Register the caller's exact
    // spelling so the C++ write path can restore it (taglib-bnhl).
    if (key.startsWith("----:")) this.registerMp4ItemName(key);
  }

  /** Record an exact atom name to be repaired after the PropertyMap write. */
  private registerMp4ItemName(name: string): void {
    const existing = (this.tagData?._mp4ItemNames as string[] | undefined) ??
      [];
    if (existing.includes(name)) return;
    this.tagData = {
      ...this.tagData,
      _mp4ItemNames: [...existing, name],
    } as Record<string, unknown>;
  }

  removeMP4Item(key: string): void {
    this.checkNotDestroyed();
    if (this.tagData) {
      // "trkn" now resolves to TRACKNUMBER, so the numeric mirror IS reachable
      // here and must go with the raw value — otherwise tag().track keeps
      // reporting a removed track (taglib-qpl mirror invariant).
      const mappedKey = fromTagLibKey(mp4ItemPropertyKey(key));
      delete this.tagData[mappedKey];
      const mirror = mirrorForRawKey(mappedKey);
      if (mirror !== undefined) delete this.tagData[mirror.numeric];
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

  getChapters(): RawChapter[] {
    this.checkNotDestroyed();
    return (this.tagData?.chapters as RawChapter[] | undefined) ?? [];
  }

  setChapters(chapters: RawChapter[], mp4ChapterStyle: string): void {
    this.checkNotDestroyed();
    this.tagData = {
      ...this.tagData,
      _mp4ChapterStyle: mp4ChapterStyle,
      chapters,
    } as Record<string, unknown>;
  }

  getBextData(): Uint8Array | undefined {
    this.checkNotDestroyed();
    return (this.tagData?.bextData as Uint8Array | undefined) ?? undefined;
  }

  setBextData(data: Uint8Array | null): void {
    this.checkNotDestroyed();
    // Store `null` (not delete) so the encoder emits msgpack nil => C++ removes.
    this.tagData = { ...this.tagData, bextData: data } as Record<
      string,
      unknown
    >;
  }

  getIxml(): string | undefined {
    this.checkNotDestroyed();
    const v = this.tagData?.ixml;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  }

  setIxml(data: string | null): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, ixml: data } as Record<string, unknown>;
  }

  hasId3Tags(): { v1: boolean; v2: boolean } {
    this.checkNotDestroyed();
    const t = this.tagData?.id3Tags as
      | { v1?: boolean; v2?: boolean }
      | undefined;
    return { v1: t?.v1 ?? false, v2: t?.v2 ?? false };
  }

  stripId3Tags(opts: { v1: boolean; v2: boolean }): void {
    this.checkNotDestroyed();
    // id3Tags is only emitted by the read path on FLAC files that have any
    // ID3 attached. Skip the directive entirely on non-FLAC handles so the
    // optimistic cache update doesn't synthesize a key the read path would
    // never have written. hasId3Tags() returns {false,false} either way.
    const current = this.tagData?.id3Tags as
      | { v1?: boolean; v2?: boolean }
      | undefined;
    if (!current) return;
    // _stripId3 is a write-time directive consumed by the C++ shim. OR-merge
    // with any prior directive so successive calls accumulate (Embind applies
    // strip immediately and naturally composes; WASI must mirror that).
    const prior = this.tagData?._stripId3 as
      | { v1?: boolean; v2?: boolean }
      | undefined;
    const stripV1 = (prior?.v1 ?? false) || opts.v1;
    const stripV2 = (prior?.v2 ?? false) || opts.v2;
    // Optimistically reflect the post-strip state in the local cache so that
    // hasId3Tags() on the same handle matches Embind semantics without a
    // round-trip through save+reload.
    this.tagData = {
      ...this.tagData,
      _stripId3: { v1: stripV1, v2: stripV2 },
      id3Tags: {
        v1: (current.v1 ?? false) && !stripV1,
        v2: (current.v2 ?? false) && !stripV2,
      },
    } as Record<string, unknown>;
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

  getLyrics(): RawLyrics[] {
    this.checkNotDestroyed();
    const value = this.tagData?.lyrics;
    if (value === undefined || value === null) return [];
    // A fresh read surfaces lyrics as the "LYRICS" text property (a string, or a
    // string[] for multi-value); setLyrics stores a RawLyrics[]. Normalize all
    // shapes — description/language are not persisted via the PropertyMap so
    // they read back empty (taglib-gq9).
    const entries = Array.isArray(value) ? value : [value];
    return entries.map((entry) =>
      typeof entry === "string"
        ? { text: entry, description: "", language: "" }
        : {
          text: (entry as RawLyrics)?.text ?? "",
          description: (entry as RawLyrics)?.description ?? "",
          language: (entry as RawLyrics)?.language ?? "",
        }
    );
  }

  setLyrics(lyrics: RawLyrics[]): void {
    this.checkNotDestroyed();
    this.tagData = { ...this.tagData, lyrics } as Record<string, unknown>;
  }

  getId3v2Frames(id: string): RawId3v2Frame[] {
    this.checkNotDestroyed();
    const filter = id === "" ? undefined : id;
    const source = this.filePath ?? this.fileData;
    let frames: RawId3v2Frame[] = [];
    if (source) {
      frames = readId3v2FramesFromWasm(this.wasi, source, filter);
    }
    const staged = this.getStagedId3v2Frames();
    if (!staged) return frames;
    // Staged per-ID replacements win over (possibly stale) file state.
    const stagedIds = new Set(Object.keys(staged));
    frames = frames.filter((f) => !stagedIds.has(f.id));
    for (const [sid, bodies] of Object.entries(staged)) {
      if (filter && sid !== filter) continue;
      // Copy: callers must not be able to mutate staged state by mutating
      // the returned array (Embind's getId3v2Frames already returns copies).
      for (const data of bodies) frames.push({ id: sid, data: data.slice() });
    }
    return frames;
  }

  setId3v2Frames(id: string, data: Uint8Array[]): void {
    this.checkNotDestroyed();
    const staged = { ...(this.getStagedId3v2Frames() ?? {}) };
    staged[id] = data.map((d) => new Uint8Array(d));
    this.tagData = {
      ...this.tagData,
      id3v2Frames: staged,
    } as Record<string, unknown>;
  }

  removeId3v2Frames(id: string): void {
    this.setId3v2Frames(id, []);
  }

  getStagedId3v2Frames(): Record<string, Uint8Array[]> | undefined {
    return this.tagData?.id3v2Frames as
      | Record<string, Uint8Array[]>
      | undefined;
  }

  destroy(): void {
    this.fileData = null;
    this.tagData = null;
    this.destroyed = true;
  }
}
