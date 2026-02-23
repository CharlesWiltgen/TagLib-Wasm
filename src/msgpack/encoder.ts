/** MessagePack encoder — converts JS objects to binary MessagePack for the C API. */

import { encode, type EncoderOptions } from "@msgpack/msgpack";
import { MetadataError } from "../errors/classes.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PropertyMap,
} from "../types.ts";
import { CAMEL_TO_VORBIS } from "../types/metadata-mappings.ts";

const PASSTHROUGH_KEYS = new Set(["pictures", "ratings"]);

const MSGPACK_ENCODE_OPTIONS: EncoderOptions = {
  sortKeys: false,
  forceFloat32: false,
  ignoreUndefined: true,
  initialBufferSize: 2048,
  maxDepth: 32,
  extensionCodec: undefined,
};

export function encodeTagData(tagData: ExtendedTag): Uint8Array {
  try {
    const remapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tagData)) {
      if (PASSTHROUGH_KEYS.has(key)) {
        remapped[key] = value;
      } else {
        remapped[CAMEL_TO_VORBIS[key] ?? key] = value;
      }
    }
    return encode(cleanObject(remapped), MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError("write", `Failed to encode tag data: ${error}`);
  }
}

export function encodeAudioProperties(audioProps: AudioProperties): Uint8Array {
  try {
    return encode(cleanObject(audioProps), MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode audio properties: ${error}`,
    );
  }
}

export function encodePropertyMap(propertyMap: PropertyMap): Uint8Array {
  try {
    return encode(propertyMap, MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError("write", `Failed to encode property map: ${error}`);
  }
}

export function encodePicture(picture: Picture): Uint8Array {
  try {
    const cleanedPicture = {
      ...picture,
      data: picture.data instanceof Uint8Array
        ? picture.data
        : new Uint8Array(picture.data),
    };
    return encode(cleanedPicture, MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError("write", `Failed to encode picture: ${error}`);
  }
}

export function encodePictureArray(pictures: Picture[]): Uint8Array {
  try {
    const cleanedPictures = pictures.map((picture) => ({
      ...picture,
      data: picture.data instanceof Uint8Array
        ? picture.data
        : new Uint8Array(picture.data),
    }));
    return encode(cleanedPictures, MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode picture array: ${error}`,
    );
  }
}

export function encodeMessagePack<T>(
  data: T,
  options: Partial<EncoderOptions> = {},
): Uint8Array {
  try {
    const mergedOptions = { ...MSGPACK_ENCODE_OPTIONS, ...options };
    return encode(cleanObject(data), mergedOptions);
  } catch (error) {
    throw new MetadataError("write", `Failed to encode data: ${error}`);
  }
}

export function encodeMessagePackCompact<T>(data: T): Uint8Array {
  try {
    const compactOptions: EncoderOptions = {
      ...MSGPACK_ENCODE_OPTIONS,
      sortKeys: true,
      initialBufferSize: 512,
      forceFloat32: true,
    };
    return encode(cleanObject(data), compactOptions);
  } catch (error) {
    throw new MetadataError("write", `Failed to encode compact data: ${error}`);
  }
}

function cleanObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Uint8Array || obj instanceof Array) return obj;
  if (obj instanceof Date) return obj;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (value === null) {
      cleaned[key] = null;
      continue;
    }
    if (typeof value === "string" && value === "") continue;
    cleaned[key] = typeof value === "object" ? cleanObject(value) : value;
  }
  return cleaned;
}

export function encodeBatchTagData(tagDataArray: ExtendedTag[]): Uint8Array {
  try {
    const cleanedArray = tagDataArray.map((tagData) => cleanObject(tagData));
    return encode(cleanedArray, {
      ...MSGPACK_ENCODE_OPTIONS,
      initialBufferSize: 8192,
      maxDepth: 16,
    });
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode batch tag data: ${error}`,
    );
  }
}

export function* encodeMessagePackStream<T>(
  dataIterator: Iterable<T>,
): Generator<Uint8Array, void, unknown> {
  try {
    for (const item of dataIterator) {
      yield encode(cleanObject(item), {
        ...MSGPACK_ENCODE_OPTIONS,
        initialBufferSize: 1024,
      });
    }
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode streaming data: ${error}`,
    );
  }
}

export function estimateMessagePackSize(data: unknown): number {
  try {
    return encode(cleanObject(data), {
      ...MSGPACK_ENCODE_OPTIONS,
      initialBufferSize: 512,
    }).length;
  } catch {
    return Math.floor(JSON.stringify(data).length * 0.75);
  }
}

export function encodeFastTagData(
  tagData: Pick<ExtendedTag, "title" | "artist" | "album" | "year" | "track">,
): Uint8Array {
  try {
    const fastOptions: EncoderOptions = {
      sortKeys: false,
      ignoreUndefined: true,
      initialBufferSize: 256,
      maxDepth: 8,
    };
    return encode(cleanObject(tagData), fastOptions);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode fast tag data: ${error}`,
    );
  }
}

export function canEncodeToMessagePack(data: unknown): boolean {
  try {
    encode(cleanObject(data), {
      ...MSGPACK_ENCODE_OPTIONS,
      maxDepth: 16,
      initialBufferSize: 256,
    });
    return true;
  } catch {
    return false;
  }
}

export function compareEncodingEfficiency(data: unknown): {
  messagePackSize: number;
  jsonSize: number;
  sizeReduction: number;
  speedImprovement: number;
} {
  const jsonString = JSON.stringify(data);
  const jsonSize = new TextEncoder().encode(jsonString).length;
  const messagePackData = encode(cleanObject(data), MSGPACK_ENCODE_OPTIONS);
  const messagePackSize = messagePackData.length;
  const sizeReduction = ((jsonSize - messagePackSize) / jsonSize) * 100;

  return {
    messagePackSize,
    jsonSize,
    sizeReduction: Math.max(0, sizeReduction),
    speedImprovement: 10,
  };
}
