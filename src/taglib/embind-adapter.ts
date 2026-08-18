/**
 * @fileoverview Adapts Embind-generated FileHandle to the data-oriented interface.
 *
 * Embind objects store methods on the prototype, so `{ ...raw }` won't copy them.
 * A Proxy forwards all property access to the raw Embind object by default,
 * overriding only getTagData, setTagData, and getAudioProperties.
 */

import type { FileHandle, RawLyrics, WasmFileHandle } from "../wasm.ts";
import type { BasicTagData } from "../types/tags.ts";
import type {
  AudioCodec,
  AudioProperties,
  BitrateMode,
  ContainerFormat,
} from "../types.ts";

/** @internal Type guard for `BitrateMode` strings emitted by the Embind layer. */
function isValidBitrateMode(value: string): value is BitrateMode {
  return value === "CBR" || value === "VBR" || value === "ABR";
}

/** @internal Embind-generated TagWrapper — methods on C++ prototype. */
interface EmbindTagWrapper {
  title(): string;
  artist(): string;
  album(): string;
  comment(): string;
  genre(): string;
  year(): number;
  track(): number;
  setTitle(v: string): void;
  setArtist(v: string): void;
  setAlbum(v: string): void;
  setComment(v: string): void;
  setGenre(v: string): void;
  setYear(v: number): void;
  setTrack(v: number): void;
}

/** @internal Embind-generated AudioPropertiesWrapper — methods on C++ prototype. */
interface EmbindAudioPropertiesWrapper {
  lengthInSeconds(): number;
  lengthInMilliseconds(): number;
  bitrate(): number;
  sampleRate(): number;
  channels(): number;
  bitsPerSample(): number;
  codec(): string;
  containerFormat(): string;
  isLossless(): boolean;
  mpegVersion(): number;
  mpegLayer(): number;
  isEncrypted(): boolean;
  formatVersion(): number;
  bitrateMode(): string;
  outputGainDb(): number;
}

/** @internal The raw Embind FileHandle before adaptation. */
export interface EmbindFileHandle {
  getTag(): EmbindTagWrapper;
  getAudioProperties(): EmbindAudioPropertiesWrapper | null;
  [key: string]: unknown;
}

/** @internal Wrap an Embind FileHandle with a Proxy for the data-oriented interface. */
export function wrapEmbindHandle(raw: EmbindFileHandle): WasmFileHandle {
  // taglib-b67 (C2): Embind applies raw frame writes immediately (no staging
  // buffer of its own), so getStagedId3v2Frames was undefined here — the
  // shared "id3v2Frames" extra-state-registry entry (which copies staged
  // writes across a save-as reconstruct) silently no-op'd on this backend.
  // Track writes in this closure so the registry entry works identically on
  // both backends; the underlying Embind handle still applies each write
  // immediately, this just mirrors that write into `stagedId3v2Frames`.
  const stagedId3v2Frames: Record<string, Uint8Array[]> = {};
  // Mirrors WasiFileHandle.destroyed: destroy() is idempotent, and the flag
  // makes the released state observable for parity tests (taglib-t4sn).
  let destroyed = false;

  const overrides: Record<string, unknown> = {
    getTagData(): BasicTagData {
      const tw = raw.getTag();
      return {
        title: tw.title(),
        artist: tw.artist(),
        album: tw.album(),
        comment: tw.comment(),
        genre: tw.genre(),
        year: tw.year(),
        track: tw.track(),
      };
    },
    setTagData(data: Partial<BasicTagData>) {
      const tw = raw.getTag();
      if (data.title !== undefined) tw.setTitle(data.title);
      if (data.artist !== undefined) tw.setArtist(data.artist);
      if (data.album !== undefined) tw.setAlbum(data.album);
      if (data.comment !== undefined) tw.setComment(data.comment);
      if (data.genre !== undefined) tw.setGenre(data.genre);
      if (data.year !== undefined) tw.setYear(data.year);
      if (data.track !== undefined) tw.setTrack(data.track);
    },
    getBextData(): Uint8Array | undefined {
      const v = (raw as unknown as { getBextData(): unknown }).getBextData();
      if (v === undefined || v === null) return undefined;
      const u8 = v instanceof Uint8Array
        ? v
        : new Uint8Array(v as ArrayLike<number>);
      return u8.length > 0 ? u8 : undefined;
    },
    setBextData(data: Uint8Array | null) {
      (raw as unknown as { setBextData(d: Uint8Array | null): void })
        .setBextData(data ?? null);
    },
    getIxml(): string | undefined {
      const v = (raw as unknown as { getIxml(): unknown }).getIxml();
      return typeof v === "string" && v.length > 0 ? v : undefined;
    },
    setIxml(data: string | null) {
      (raw as unknown as { setIxml(d: string | null): void }).setIxml(
        data ?? null,
      );
    },
    // Emscripten exposes USLT only through the PropertyMap "LYRICS" key (no
    // dedicated Embind binding), so bridge get/setLyrics to get/setProperties.
    // Text only — language/description are not surfaced by the PropertyMap.
    getLyrics(): RawLyrics[] {
      const props = (raw as unknown as {
        getProperties(): Record<string, string[]>;
      }).getProperties();
      return (props["LYRICS"] ?? []).map((text) => ({
        text,
        description: "",
        language: "",
      }));
    },
    setLyrics(lyrics: RawLyrics[]) {
      const handle = raw as unknown as {
        getProperties(): Record<string, string[]>;
        setProperties(p: Record<string, string[]>): void;
      };
      const props = handle.getProperties();
      if (lyrics.length > 0) props["LYRICS"] = lyrics.map((l) => l.text);
      else delete props["LYRICS"];
      handle.setProperties(props);
    },
    setId3v2Frames(id: string, data: Uint8Array[]) {
      stagedId3v2Frames[id] = data.map((d) => new Uint8Array(d));
      (raw as unknown as {
        setId3v2Frames(id: string, data: Uint8Array[]): void;
      }).setId3v2Frames(id, data);
    },
    removeId3v2Frames(id: string) {
      stagedId3v2Frames[id] = [];
      (raw as unknown as { removeId3v2Frames(id: string): void })
        .removeId3v2Frames(id);
    },
    getStagedId3v2Frames(): Record<string, Uint8Array[]> | undefined {
      return Object.keys(stagedId3v2Frames).length > 0
        ? { ...stagedId3v2Frames }
        : undefined;
    },
    hasId3Tags(): { v1: boolean; v2: boolean } {
      const v = (raw as unknown as { hasId3Tags(): unknown }).hasId3Tags();
      if (!v || typeof v !== "object") return { v1: false, v2: false };
      const o = v as { v1?: unknown; v2?: unknown };
      return { v1: o.v1 === true, v2: o.v2 === true };
    },
    stripId3Tags(opts: { v1: boolean; v2: boolean }) {
      (raw as unknown as {
        stripId3Tags(o: { v1: boolean; v2: boolean }): void;
      }).stripId3Tags(opts);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      (raw as unknown as { destroy(): void }).destroy();
    },
    get destroyed(): boolean {
      return destroyed;
    },
    // taglib-qyw2: the PropertyMap erase pass computes freeform item names
    // from the property table (upper-cased) and misses the restored exact-case
    // atom (taglib-bnhl), so clears queue the exact name here; the imperative
    // Embind model applies removeItem immediately, before setProperties.
    setMp4ItemRemovals(removals: string[]): void {
      const handle = raw as unknown as { removeMP4Item(name: string): void };
      for (const name of removals) handle.removeMP4Item(name);
    },
    getAudioProperties(): AudioProperties | null {
      const pw = raw.getAudioProperties();
      if (!pw) return null;
      const containerFormat =
        (pw.containerFormat() || "unknown") as ContainerFormat;
      const codec = (pw.codec() || "unknown") as AudioCodec;
      const mpegVersion = pw.mpegVersion();
      const formatVersion = pw.formatVersion();
      const bitrateMode = pw.bitrateMode();
      return {
        duration: pw.lengthInSeconds(),
        durationMs: pw.lengthInMilliseconds(),
        bitrate: pw.bitrate(),
        sampleRate: pw.sampleRate(),
        channels: pw.channels(),
        bitsPerSample: pw.bitsPerSample(),
        codec,
        containerFormat,
        isLossless: pw.isLossless(),
        ...(mpegVersion > 0 ? { mpegVersion, mpegLayer: pw.mpegLayer() } : {}),
        ...(containerFormat === "MP4" || containerFormat === "ASF"
          ? { isEncrypted: pw.isEncrypted() }
          : {}),
        ...(formatVersion > 0 ? { formatVersion } : {}),
        ...(isValidBitrateMode(bitrateMode) ? { bitrateMode } : {}),
        ...(codec === "Opus" ? { outputGainDb: pw.outputGainDb() } : {}),
      };
    },
  };

  // The brand is asserted exactly here: this is the single boundary where a
  // raw Embind handle becomes a library-owned WasmFileHandle (taglib-0te).
  return new Proxy(raw as unknown as FileHandle, {
    get(target, prop, receiver) {
      if (prop in overrides) return overrides[prop as string];
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  }) as unknown as WasmFileHandle;
}
