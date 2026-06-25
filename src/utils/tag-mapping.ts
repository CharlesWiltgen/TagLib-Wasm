import type { AudioFile } from "../taglib/audio-file-interface.ts";
import type { ExtendedTag, PropertyMap, TagInput } from "../types.ts";
import { fromTagLibKey } from "../constants/properties.ts";

const BASIC_PROPERTY_KEYS: Record<string, string> = {
  title: "title",
  artist: "artist",
  album: "album",
  comment: "comment",
  genre: "genre",
  date: "year",
  trackNumber: "track",
};

const BASIC_FIELDS = new Set([
  "title",
  "artist",
  "album",
  "comment",
  "genre",
  "year",
  "date",
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

/**
 * Build a complete ExtendedTag from an open file: the text PropertyMap PLUS the
 * structured fields that ride their own accessors (pictures, ratings, lyrics,
 * chapters, bext/bextData, ixml). readTags and the batch readers share this so
 * the structured ExtendedTag fields are actually populated, not just declared
 * (taglib-0co). Each field is included only when present, mirroring how
 * {@link mapPropertiesToExtendedTag} omits absent text properties.
 */
export function readExtendedTag(audioFile: AudioFile): ExtendedTag {
  const tag = mapPropertiesToExtendedTag(audioFile.properties()) as Record<
    string,
    unknown
  >;

  const pictures = audioFile.getPictures();
  if (pictures.length > 0) tag.pictures = pictures;
  const ratings = audioFile.getRatings();
  if (ratings.length > 0) tag.ratings = ratings;
  const lyrics = audioFile.getLyrics();
  if (lyrics.length > 0) tag.lyrics = lyrics;
  const chapters = audioFile.getChapters();
  if (chapters.length > 0) tag.chapters = chapters;

  const bext = audioFile.getBext();
  if (bext !== undefined) tag.bext = bext;
  const bextData = audioFile.getBextData();
  if (bextData !== undefined) tag.bextData = bextData;
  const ixml = audioFile.getIxml();
  if (ixml !== undefined) tag.ixml = ixml;

  return tag as ExtendedTag;
}

export function mapPropertiesToExtendedTag(props: PropertyMap): ExtendedTag {
  const tag: Record<string, unknown> = {};

  for (const [propKey, tagField] of Object.entries(BASIC_PROPERTY_KEYS)) {
    const values = props[propKey];
    if (!values || values.length === 0) continue;
    if (tagField === "year" || tagField === "track") {
      const num = parseNumeric(values[0]);
      if (num !== undefined) tag[tagField] = num;
      // Preserve the full DATE string alongside the numeric year (taglib-bk7).
      if (propKey === "date") {
        tag.date = values.length === 1 ? values[0] : values;
      }
    } else {
      tag[tagField] = values;
    }
  }

  for (const [key, values] of Object.entries(props)) {
    if (BASIC_PROPERTY_KEYS[key]) continue;
    if (!values || values.length === 0) continue;
    // camelCase PropertyKeys pass through; ALL_CAPS pass-through keys get mapped
    const camelKey = fromTagLibKey(key);

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
  const props: Record<string, string[]> = {};
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
    props[field] = Array.isArray(val) ? val : [val];
  }
  if (input.year !== undefined) {
    props.date = [String(input.year)];
  }
  // `date` carries full precision and wins over the numeric `year` when both
  // are set (taglib-bk7).
  if (input.date !== undefined) {
    props.date = Array.isArray(input.date) ? input.date : [input.date];
  }
  if (input.track !== undefined) {
    props.trackNumber = [String(input.track)];
  }

  for (const [field, val] of Object.entries(input)) {
    if (BASIC_FIELDS.has(field) || val === undefined) continue;

    if (field === "compilation") {
      props[field] = [val ? "1" : "0"];
    } else if (NUMERIC_FIELDS.has(field)) {
      props[field] = [String(val)];
    } else if (typeof val === "string") {
      props[field] = [val];
    } else if (Array.isArray(val)) {
      props[field] = val;
    }
  }

  return props as PropertyMap;
}
