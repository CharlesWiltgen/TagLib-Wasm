/** MessagePack decoder — converts binary MessagePack from the C API to JS objects. */

import { decode, type DecoderOptions } from "@msgpack/msgpack";
import { MetadataError } from "../errors/classes.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PropertyMap,
} from "../types.ts";
import type { MessagePackDataType } from "./types.ts";
import { VORBIS_TO_CAMEL } from "../types/metadata-mappings.ts";

const MSGPACK_DECODE_OPTIONS: DecoderOptions = {
  useBigInt64: false,
  extensionCodec: undefined,
  maxStrLength: 1_000_000,
  maxBinLength: 50_000_000,
  maxArrayLength: 10_000,
  maxMapLength: 1_000,
  maxExtLength: 50_000_000,
};

export function decodeTagData(msgpackBuffer: Uint8Array): ExtendedTag {
  try {
    const raw = decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS) as Record<
      string,
      unknown
    >;
    return normalizeTagKeys(raw) as unknown as ExtendedTag;
  } catch (error) {
    throw new MetadataError("read", `Failed to decode tag data: ${error}`);
  }
}

export function decodeAudioProperties(
  msgpackBuffer: Uint8Array,
): AudioProperties {
  try {
    const raw = decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS) as Record<
      string,
      unknown
    >;
    if ("length" in raw && !("duration" in raw)) {
      raw.duration = raw.length;
      delete raw.length;
    }
    return raw as unknown as AudioProperties;
  } catch (error) {
    throw new MetadataError(
      "read",
      `Failed to decode audio properties: ${error}`,
    );
  }
}

export function decodePropertyMap(msgpackBuffer: Uint8Array): PropertyMap {
  try {
    return decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS) as PropertyMap;
  } catch (error) {
    throw new MetadataError("read", `Failed to decode property map: ${error}`);
  }
}

export function decodePicture(msgpackBuffer: Uint8Array): Picture {
  try {
    const picture = decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS) as any;
    coercePictureData(picture);
    return picture as Picture;
  } catch (error) {
    throw new MetadataError("read", `Failed to decode picture data: ${error}`);
  }
}

export function decodePictureArray(msgpackBuffer: Uint8Array): Picture[] {
  try {
    const pictures = decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS) as any[];
    return pictures.map((picture) => {
      coercePictureData(picture);
      return picture as Picture;
    });
  } catch (error) {
    throw new MetadataError("read", `Failed to decode picture array: ${error}`);
  }
}

export function decodeMessagePack<T = unknown>(
  msgpackBuffer: Uint8Array,
  options: Partial<DecoderOptions> = {},
): T {
  try {
    const mergedOptions = { ...MSGPACK_DECODE_OPTIONS, ...options };
    return decode(msgpackBuffer, mergedOptions) as T;
  } catch (error) {
    throw new MetadataError("read", `Failed to decode data: ${error}`);
  }
}

function isAudioProperties(obj: Record<string, unknown>): boolean {
  return "bitrate" in obj && "sampleRate" in obj &&
    ("length" in obj || "duration" in obj);
}

function isPicture(obj: Record<string, unknown>): boolean {
  return "mimeType" in obj && "data" in obj;
}

function coercePictureData(obj: Record<string, unknown>): void {
  if (obj.data && !(obj.data instanceof Uint8Array)) {
    obj.data = new Uint8Array(obj.data as ArrayLike<number>);
  }
}

function isTagLike(obj: Record<string, unknown>): boolean {
  return "title" in obj || "artist" in obj || "album" in obj ||
    "TITLE" in obj || "ARTIST" in obj || "ALBUM" in obj;
}

function normalizeTagKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    normalized[VORBIS_TO_CAMEL[key] ?? key] = value;
  }
  return normalized;
}

function isPropertyMap(obj: Record<string, unknown>): boolean {
  const values = Object.values(obj);
  return values.length > 0 && values.every((value) => Array.isArray(value));
}

export function decodeMessagePackAuto(
  msgpackBuffer: Uint8Array,
): ExtendedTag | AudioProperties | Picture | PropertyMap {
  try {
    const decoded = decode(msgpackBuffer, MSGPACK_DECODE_OPTIONS);
    if (decoded && typeof decoded === "object") {
      const obj = decoded as Record<string, unknown>;
      if (isAudioProperties(obj)) {
        if ("length" in obj && !("duration" in obj)) {
          obj.duration = obj.length;
          delete obj.length;
        }
        return obj as unknown as AudioProperties;
      }
      if (isPicture(obj)) {
        coercePictureData(obj);
        return obj as unknown as Picture;
      }
      // PropertyMap before TagLike: UPPERCASE-keyed PropertyMaps (e.g. {TITLE: ["Song"]})
      // would match isTagLike's UPPERCASE check and get incorrectly normalized.
      if (isPropertyMap(obj)) return obj as unknown as PropertyMap;
      if (isTagLike(obj)) {
        return normalizeTagKeys(obj) as unknown as ExtendedTag;
      }
    }
    return decoded as ExtendedTag;
  } catch (error) {
    throw new MetadataError(
      "read",
      `Failed to decode data with auto-detection: ${error}`,
    );
  }
}

export function isValidMessagePack(buffer: Uint8Array): boolean {
  try {
    decode(buffer, {
      ...MSGPACK_DECODE_OPTIONS,
      maxStrLength: 1000,
      maxBinLength: 1000,
      maxArrayLength: 100,
      maxMapLength: 100,
      maxExtLength: 1000,
    });
    return true;
  } catch {
    return false;
  }
}

function detectType(decoded: unknown): MessagePackDataType {
  if (Array.isArray(decoded)) return "array";
  if (decoded instanceof Uint8Array) return "binary";
  if (typeof decoded === "object" && decoded !== null) return "map";
  if (typeof decoded === "string") return "string";
  if (typeof decoded === "number") return "number";
  if (typeof decoded === "boolean") return "boolean";
  if (decoded === null) return "null";
  return "unknown";
}

export function getMessagePackInfo(buffer: Uint8Array): {
  isValid: boolean;
  approximateSize: number;
  type: MessagePackDataType;
} {
  const info = {
    isValid: false,
    approximateSize: buffer.length,
    type: "unknown" as MessagePackDataType,
  };
  if (buffer.length === 0) return info;

  try {
    const decoded = decode(buffer, {
      ...MSGPACK_DECODE_OPTIONS,
      maxStrLength: 100,
      maxBinLength: 100,
      maxArrayLength: 10,
      maxMapLength: 10,
      maxExtLength: 100,
    });
    info.isValid = true;
    info.type = detectType(decoded);
  } catch {
    // Keep isValid as false
  }
  return info;
}

export function decodeFastTagData(
  msgpackBuffer: Uint8Array,
): Pick<ExtendedTag, "title" | "artist" | "album" | "year" | "track"> {
  try {
    const decoded = decode(msgpackBuffer, {
      ...MSGPACK_DECODE_OPTIONS,
      maxStrLength: 10_000,
      maxArrayLength: 100,
      maxMapLength: 50,
    }) as ExtendedTag;
    return {
      title: decoded.title,
      artist: decoded.artist,
      album: decoded.album,
      year: decoded.year,
      track: decoded.track,
    };
  } catch (error) {
    throw new MetadataError("read", `Failed to decode fast tag data: ${error}`);
  }
}
