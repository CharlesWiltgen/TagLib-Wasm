import type { PropertyMap, Tag, TagInput } from "../types.ts";

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

export function mapPropertiesToTag(props: PropertyMap): Tag {
  const tag: Record<string, unknown> = {};
  for (const [propKey, tagField] of Object.entries(TAG_PROPERTY_KEYS)) {
    const values = props[propKey];
    if (!values || values.length === 0) continue;
    if (tagField === "year" || tagField === "track") {
      tag[tagField] = parseInt(values[0], 10) || 0;
    } else {
      tag[tagField] = values;
    }
  }
  return tag as Tag;
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
  return props;
}
