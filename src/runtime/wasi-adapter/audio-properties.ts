/**
 * Audio metrics and format detection over the WASI tag-data snapshot.
 *
 * Pure functions over (tagData, fileData): the WasiFileHandle wrappers add
 * destruction guards and pass their fields. Extracted from file-handle.ts in
 * the taglib-1dfc split.
 */

import type {
  AudioCodec,
  AudioProperties,
  ContainerFormat,
} from "../../types.ts";

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

/** The audio-properties block of the C++ snapshot, null when absent. */
export function getAudioProperties(
  tagData: Record<string, unknown> | null,
): AudioProperties | null {
  if (!tagData || !("sampleRate" in tagData)) return null;
  const d = tagData;
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

/** OGG codec sniffing: "OpusHead" in the first page payload, else OGG. */
export function detectOggCodec(fileData: Uint8Array): string {
  if (fileData.length < 37) return "OGG";
  // OGG page header: "OggS" at 0, then header_type(1), granule(8),
  // serial(4), seq(4), crc(4), segments(1), segment_table(variable).
  // First page payload starts after 27 + segment_count bytes.
  const segCount = fileData[26];
  if (segCount === undefined) return "OGG";
  const payloadStart = 27 + segCount;
  if (fileData.length < payloadStart + 8) return "OGG";
  // Opus: payload starts with "OpusHead"
  const sig = String.fromCharCode(
    ...fileData.slice(payloadStart, payloadStart + 8),
  );
  if (sig === "OpusHead") return "OPUS";
  return "OGG";
}

/**
 * Format detection: container-based first (works for path and buffer modes),
 * magic-byte fallback for buffers.
 */
export function getFormat(
  tagData: Record<string, unknown> | null,
  fileData: Uint8Array | null,
): string {
  // Container-based detection works for both path and buffer modes
  const container = tagData?.containerFormat as string | undefined;
  if (container) {
    const codec = tagData?.codec as string | undefined;
    if (container === "OGG" && codec === "Opus") return "OPUS";
    if (CONTAINER_TO_FORMAT[container]) return CONTAINER_TO_FORMAT[container];
  }

  // Magic byte fallback requires buffer data
  if (!fileData || fileData.length < 8) return "unknown";
  const magic = fileData.slice(0, 4);
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
  ) return detectOggCodec(fileData);
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
    fileData.length >= 16 &&
    magic[0] === 0x30 && magic[1] === 0x26 &&
    magic[2] === 0xB2 && magic[3] === 0x75
  ) return "ASF";
  // Matroska/WebM: EBML signature
  if (
    magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF &&
    magic[3] === 0xA3
  ) return "MATROSKA";
  const ftyp = fileData.slice(4, 8);
  if (
    ftyp[0] === 0x66 && ftyp[1] === 0x74 && ftyp[2] === 0x79 &&
    ftyp[3] === 0x70
  ) return "MP4";
  return "unknown";
}

/** MP4 detection: containerFormat (path mode) or ftyp box (buffer mode). */
export function isMP4(
  tagData: Record<string, unknown> | null,
  fileData: Uint8Array | null,
): boolean {
  if (!fileData) {
    return (tagData?.containerFormat as string | undefined) === "MP4";
  }
  if (fileData.length < 8) return false;
  const magic = fileData.slice(4, 8);
  return (
    magic[0] === 0x66 &&
    magic[1] === 0x74 &&
    magic[2] === 0x79 &&
    magic[3] === 0x70
  );
}
