/**
 * @fileoverview MP4 freeform value codec (taglib-gja).
 *
 * The FileHandle boundary carries one raw entry per data value: mean, name,
 * numeric AtomDataType, and raw bytes. The public API converts `utf8` to a
 * string, `integer` to a number, and leaves every other type as bytes.
 */

import type {
  MP4FreeformItem,
  MP4FreeformType,
  RawMP4FreeformItem,
} from "../types/tags.ts";
import { MetadataError } from "../errors.ts";

type KnownFreeformType = Exclude<MP4FreeformType, "other">;

/** AtomDataType codes from lib/taglib/taglib/mp4/mp4atom.h. */
const TYPE_TO_CODE: Readonly<Record<KnownFreeformType, number>> = {
  implicit: 0,
  utf8: 1,
  utf16: 2,
  jpeg: 13,
  png: 14,
  integer: 21,
  bmp: 27,
  undefined: 255,
};

const CODE_TO_TYPE: Readonly<Record<number, MP4FreeformType>> = {
  0: "implicit",
  1: "utf8",
  2: "utf16",
  13: "jpeg",
  14: "png",
  21: "integer",
  27: "bmp",
  255: "undefined",
};

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export function freeformTypeFromCode(code: number): MP4FreeformType {
  return CODE_TO_TYPE[code] ?? "other";
}

function freeformCode(type: MP4FreeformType, typeCode?: number): number {
  if (type === "other") {
    if (
      typeCode === undefined ||
      !Number.isInteger(typeCode) ||
      typeCode < 0 ||
      typeCode > 255
    ) {
      throw new MetadataError(
        "write",
        'MP4 freeform type "other" requires typeCode 0..255',
      );
    }
    return typeCode;
  }
  return TYPE_TO_CODE[type];
}

function validateAtomPart(label: string, value: string): void {
  if (value.length === 0) {
    throw new MetadataError("write", `MP4 freeform ${label} must not be empty`);
  }
  if (value.includes(":")) {
    throw new MetadataError(
      "write",
      `MP4 freeform ${label} must not contain ":"`,
    );
  }
}

function encodeFreeformValue(
  type: MP4FreeformType,
  value: MP4FreeformItem["value"],
): Uint8Array {
  if (type === "utf8") {
    if (typeof value !== "string") {
      throw new MetadataError(
        "write",
        'MP4 freeform type "utf8" requires a string value',
      );
    }
    return new TextEncoder().encode(value);
  }
  if (type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < INT32_MIN ||
      value > INT32_MAX
    ) {
      throw new MetadataError(
        "write",
        'MP4 freeform type "integer" requires an int32 value',
      );
    }
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setInt32(0, value, false);
    return bytes;
  }
  if (!(value instanceof Uint8Array)) {
    throw new MetadataError(
      "write",
      `MP4 freeform type "${type}" requires a Uint8Array value`,
    );
  }
  return new Uint8Array(value);
}

function decodeFreeformValue(
  type: MP4FreeformType,
  bytes: Uint8Array,
): MP4FreeformItem["value"] {
  if (type === "utf8") return new TextDecoder().decode(bytes);
  if (type === "integer" && bytes.byteLength === 4) {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getInt32(0, false);
  }
  return new Uint8Array(bytes);
}

/**
 * Reject a list that gives one `mean`/`name` atom values of different types.
 * TagLib stores one AtomDataType per item, so a mixed list would silently drop
 * all but the first group when the setter groups equal types (taglib-gja review).
 */
export function validateFreeformItems(items: readonly MP4FreeformItem[]): void {
  const types = new Map<string, string>();
  for (const item of items) {
    const atom = `${item.mean}\u0000${item.name}`;
    const signature =
      item.type === "other" ? `other:${item.typeCode ?? "missing"}` : item.type;
    const previous = types.get(atom);
    if (previous !== undefined && previous !== signature) {
      throw new MetadataError(
        "write",
        `MP4 freeform atom "${item.mean}:${item.name}" cannot mix types "${previous}" and "${signature}"`,
      );
    }
    types.set(atom, signature);
  }
}

/** Public item -> raw FileHandle entry. */
export function toRawFreeformItem(item: MP4FreeformItem): RawMP4FreeformItem {
  validateAtomPart("mean", item.mean);
  validateAtomPart("name", item.name);
  return {
    mean: item.mean,
    name: item.name,
    type: freeformCode(item.type, item.typeCode),
    value: encodeFreeformValue(item.type, item.value),
  };
}

/** Raw FileHandle entry -> public item. */
export function fromRawFreeformItem(raw: RawMP4FreeformItem): MP4FreeformItem {
  const type = freeformTypeFromCode(raw.type);
  if (type === "integer" && raw.value.byteLength !== 4) {
    // AtomDataType 21 legally carries 1/2/3/8-byte payloads, but the public
    // "integer" shape is int32-only. Report the raw bytes as "other" so a
    // getter's output is a value the setter can write back.
    return {
      mean: raw.mean,
      name: raw.name,
      type: "other",
      typeCode: raw.type,
      value: new Uint8Array(raw.value),
    };
  }
  const value = decodeFreeformValue(type, raw.value);
  return type === "other"
    ? { mean: raw.mean, name: raw.name, type, typeCode: raw.type, value }
    : { mean: raw.mean, name: raw.name, type, value };
}
