/** MessagePack encoder — converts JS objects to binary MessagePack for the C API. */

import { encode, type EncoderOptions } from "@msgpack/msgpack";
import { errorMessage, MetadataError } from "../errors/classes.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PropertyMap,
} from "../types.ts";
import { toTagLibKey } from "../constants/properties.ts";
import { isShadowedNumericMirror } from "../utils/mirror-fields.ts";

/**
 * Structured (non-text-property) keys carried verbatim through the msgpack
 * boundary. The reconstruct registry (`extra-state-registry.ts`) must cover the
 * data fields here; `extra-state-registry.test.ts` enforces that cross-check.
 */
export const PASSTHROUGH_KEYS = new Set([
  "pictures",
  "ratings",
  "id3v2Frames",
  "lyrics",
  "chapters",
  "_mp4ChapterStyle",
  "bextData",
  "ixml",
  "id3Tags",
  "_stripId3",
  // Freeform MP4 atom edits — must reach C++ verbatim, not via toTagLibKey.
  "_mp4Items",
]);

const MSGPACK_ENCODE_OPTIONS: EncoderOptions = {
  sortKeys: false,
  forceFloat32: false,
  ignoreUndefined: true,
  initialBufferSize: 2048,
  maxDepth: 32,
  extensionCodec: undefined,
};

/**
 * Flatten the in-memory lyrics value to the plain text strings the "LYRICS"
 * PropertyMap key accepts. Tolerates the three shapes `tagData.lyrics` can hold:
 * a `RawLyrics[]` (from `setLyrics`), a `string[]` (from `setProperties`), or a
 * bare `string` (from a fresh read of the "LYRICS" property).
 */
function lyricsTexts(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : String((entry as { text?: unknown })?.text ?? "")
    )
    .filter((text) => text !== "");
}

export function encodeTagData(tagData: ExtendedTag): Uint8Array {
  try {
    // A raw field and its numeric mirror (`date`/`year`, `trackNumber`/`track`)
    // translate to ONE wire key, so emitting both collides and the int would win
    // — that is what rewrote "1975-10-31" as "1975" and "3/12" as "3" on save
    // (taglib-bk7, taglib-qpl). The raw string carries more, so it wins.
    const data = tagData as Record<string, unknown>;

    const remapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tagData)) {
      if (isShadowedNumericMirror(data, key)) continue;
      if (key === "lyrics") {
        // TagLib has no LYRICS *complex* property, so unsynchronized lyrics
        // persist only via the text "LYRICS" PropertyMap key (the ID3v2/MP4/Xiph
        // frame factories turn it into USLT/©lyr/etc). Emit the text under the
        // uppercase wire key so it actually writes — the lowercase passthrough
        // key is dropped by the C API's property decoder. description/language
        // are not representable via the PropertyMap on either backend
        // (taglib-gq9).
        const texts = lyricsTexts(value);
        if (texts.length > 0) remapped["LYRICS"] = texts;
        continue;
      }
      if (PASSTHROUGH_KEYS.has(key)) {
        remapped[key] = value;
      } else {
        remapped[toTagLibKey(key)] = value;
      }
    }
    return encode(cleanObject(remapped), MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode tag data: ${errorMessage(error)}`,
    );
  }
}

export function encodeAudioProperties(audioProps: AudioProperties): Uint8Array {
  try {
    return encode(cleanObject(audioProps), MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode audio properties: ${errorMessage(error)}`,
    );
  }
}

export function encodePropertyMap(propertyMap: PropertyMap): Uint8Array {
  try {
    return encode(propertyMap, MSGPACK_ENCODE_OPTIONS);
  } catch (error) {
    throw new MetadataError(
      "write",
      `Failed to encode property map: ${errorMessage(error)}`,
    );
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
    throw new MetadataError(
      "write",
      `Failed to encode picture: ${errorMessage(error)}`,
    );
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
      `Failed to encode picture array: ${errorMessage(error)}`,
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
    throw new MetadataError(
      "write",
      `Failed to encode data: ${errorMessage(error)}`,
    );
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
    throw new MetadataError(
      "write",
      `Failed to encode compact data: ${errorMessage(error)}`,
    );
  }
}

function cleanObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Uint8Array || Array.isArray(obj)) return obj;
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
      `Failed to encode batch tag data: ${errorMessage(error)}`,
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
      `Failed to encode streaming data: ${errorMessage(error)}`,
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
      `Failed to encode fast tag data: ${errorMessage(error)}`,
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
