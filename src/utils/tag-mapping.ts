import type { ExtendedTag, PropertyMap, Tag, TagInput } from "../types.ts";
import {
  CAMEL_TO_VORBIS,
  VORBIS_TO_CAMEL,
} from "../types/metadata-mappings.ts";

const TAG_PROPERTY_KEYS: Record<string, keyof Tag> = {
  TITLE: "title",
  ARTIST: "artist",
  ALBUM: "album",
  COMMENT: "comment",
  GENRE: "genre",
  DATE: "year",
  TRACKNUMBER: "track",
};

const TAG_FIELD_TO_PROPERTY: Record<string, string> = {
  title: "TITLE",
  artist: "ARTIST",
  album: "ALBUM",
  comment: "COMMENT",
  genre: "GENRE",
  year: "DATE",
  track: "TRACKNUMBER",
};

const BASIC_FIELDS = new Set([
  "title",
  "artist",
  "album",
  "comment",
  "genre",
  "year",
  "track",
]);

const NUMERIC_FIELDS = new Set([
  "discNumber",
  "totalTracks",
  "totalDiscs",
  "bpm",
]);

export function mapPropertiesToTag(props: PropertyMap): Tag {
  const tag: Record<string, unknown> = {};
  for (const [propKey, tagField] of Object.entries(TAG_PROPERTY_KEYS)) {
    const values = props[propKey];
    if (!values || values.length === 0) continue;
    if (tagField === "year" || tagField === "track") {
      tag[tagField] = Number.parseInt(values[0], 10) || 0;
    } else {
      tag[tagField] = values;
    }
  }
  return tag as Tag;
}

export function mapPropertiesToExtendedTag(props: PropertyMap): ExtendedTag {
  const tag: Record<string, unknown> = {};

  // Basic fields (same logic as mapPropertiesToTag)
  for (const [propKey, tagField] of Object.entries(TAG_PROPERTY_KEYS)) {
    const values = props[propKey];
    if (!values || values.length === 0) continue;
    if (tagField === "year" || tagField === "track") {
      tag[tagField] = Number.parseInt(values[0], 10) || 0;
    } else {
      tag[tagField] = values;
    }
  }

  // Extended fields via VORBIS_TO_CAMEL mapping
  for (const [vorbisKey, values] of Object.entries(props)) {
    if (TAG_PROPERTY_KEYS[vorbisKey]) continue; // Already handled above
    const camelKey = VORBIS_TO_CAMEL[vorbisKey];
    if (!camelKey) continue;

    if (NUMERIC_FIELDS.has(camelKey)) {
      const parsed = Number.parseInt(values[0], 10);
      if (!Number.isNaN(parsed)) tag[camelKey] = parsed;
    } else if (camelKey === "compilation") {
      tag[camelKey] = values[0] === "1";
    } else {
      tag[camelKey] = values;
    }
  }

  return tag as ExtendedTag;
}

export function normalizeTagInput(
  input: Partial<TagInput>,
): PropertyMap {
  const props: PropertyMap = {};
  for (
    const field of [
      "title",
      "artist",
      "album",
      "comment",
      "genre",
    ] as const
  ) {
    const val = input[field];
    if (val === undefined) continue;
    const propKey = TAG_FIELD_TO_PROPERTY[field];
    props[propKey] = Array.isArray(val) ? val : [val];
  }
  if (input.year !== undefined) {
    props.DATE = [String(input.year)];
  }
  if (input.track !== undefined) {
    props.TRACKNUMBER = [String(input.track)];
  }

  for (const [field, val] of Object.entries(input)) {
    if (BASIC_FIELDS.has(field) || val === undefined) continue;
    const propKey = CAMEL_TO_VORBIS[field];
    if (!propKey) continue;

    if (field === "compilation") {
      props[propKey] = [val ? "1" : "0"];
    } else if (NUMERIC_FIELDS.has(field)) {
      props[propKey] = [String(val)];
    } else if (typeof val === "string") {
      props[propKey] = [val];
    } else if (Array.isArray(val)) {
      props[propKey] = val;
    }
  }

  return props;
}
