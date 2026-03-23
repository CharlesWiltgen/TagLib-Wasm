/**
 * @fileoverview Adapts Embind-generated FileHandle to the data-oriented interface.
 *
 * Embind objects store methods on the prototype, so `{ ...raw }` won't copy them.
 * A Proxy forwards all property access to the raw Embind object by default,
 * overriding only getTagData, setTagData, and getAudioProperties.
 */

import type { FileHandle } from "../wasm.ts";
import type { BasicTagData } from "../types/tags.ts";
import type { AudioCodec, AudioProperties, ContainerFormat } from "../types.ts";

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
}

/** @internal The raw Embind FileHandle before adaptation. */
export interface EmbindFileHandle {
  getTag(): EmbindTagWrapper;
  getAudioProperties(): EmbindAudioPropertiesWrapper | null;
  [key: string]: unknown;
}

/** @internal Wrap an Embind FileHandle with a Proxy for the data-oriented interface. */
export function wrapEmbindHandle(raw: EmbindFileHandle): FileHandle {
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
    getAudioProperties(): AudioProperties | null {
      const pw = raw.getAudioProperties();
      if (!pw) return null;
      const containerFormat =
        (pw.containerFormat() || "unknown") as ContainerFormat;
      const mpegVersion = pw.mpegVersion();
      const formatVersion = pw.formatVersion();
      return {
        duration: pw.lengthInSeconds(),
        durationMs: pw.lengthInMilliseconds(),
        bitrate: pw.bitrate(),
        sampleRate: pw.sampleRate(),
        channels: pw.channels(),
        bitsPerSample: pw.bitsPerSample(),
        codec: (pw.codec() || "unknown") as AudioCodec,
        containerFormat,
        isLossless: pw.isLossless(),
        ...(mpegVersion > 0 ? { mpegVersion, mpegLayer: pw.mpegLayer() } : {}),
        ...(containerFormat === "MP4" || containerFormat === "ASF"
          ? { isEncrypted: pw.isEncrypted() }
          : {}),
        ...(formatVersion > 0 ? { formatVersion } : {}),
      };
    },
  };

  return new Proxy(raw as unknown as FileHandle, {
    get(target, prop, receiver) {
      if (prop in overrides) return overrides[prop as string];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
