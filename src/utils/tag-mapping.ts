import type { AudioFile } from "../taglib/audio-file-interface.ts";
import type { ExtendedTag, PropertyMap, TagInput } from "../types.ts";
import { fromTagLibKey, toTagLibKey } from "../constants/properties.ts";

const BASIC_PROPERTY_KEYS: Record<string, string> = {
  title: "title",
  artist: "artist",
  album: "album",
  comment: "comment",
  genre: "genre",
  date: "year",
  trackNumber: "track",
};

const TAG_FIELD_TO_PROPERTY: Record<string, string> = {
  title: "title",
  artist: "artist",
  album: "album",
  comment: "comment",
  genre: "genre",
  year: "date",
  track: "trackNumber",
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
  "year",
  "track",
  "discNumber",
  "totalTracks",
  "totalDiscs",
  "bpm",
]);

function parseNumeric(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function mapPropertiesToExtendedTag(props: PropertyMap): ExtendedTag {
  const tag: Record<string, unknown> = {};

  for (const [propKey, tagField] of Object.entries(BASIC_PROPERTY_KEYS)) {
    const values = props[propKey];
    if (!values || values.length === 0) continue;
    if (tagField === "year" || tagField === "track") {
      const num = parseNumeric(values[0]);
      if (num !== undefined) tag[tagField] = num;
    } else {
      tag[tagField] = values;
    }
  }

  for (const [key, values] of Object.entries(props)) {
    if (BASIC_PROPERTY_KEYS[key]) continue;
    if (values.length === 0) continue;
    // camelCase PropertyKeys pass through; ALL_CAPS pass-through keys get mapped
    const camelKey = fromTagLibKey(key);
    if (!camelKey) continue;

    if (NUMERIC_FIELDS.has(camelKey)) {
      const num = parseNumeric(values[0]);
      if (num !== undefined) tag[camelKey] = num;
    } else if (camelKey === "compilation") {
      tag[camelKey] = values[0] === "1";
    } else {
      tag[camelKey] = values;
    }
  }

  return tag as ExtendedTag;
}

export function mergeTagUpdates(
  file: AudioFile,
  tags: Partial<TagInput>,
): void {
  const currentProps = file.properties();
  const newProps = normalizeTagInput(tags);
  file.setProperties({ ...currentProps, ...newProps });
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
    props.date = [String(input.year)];
  }
  if (input.track !== undefined) {
    props.trackNumber = [String(input.track)];
  }

  for (const [field, val] of Object.entries(input)) {
    if (BASIC_FIELDS.has(field) || val === undefined) continue;
    const propKey = toTagLibKey(field);
    if (propKey === field) continue;

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
