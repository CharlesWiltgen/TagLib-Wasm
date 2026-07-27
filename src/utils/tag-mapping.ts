import type { AudioFile } from "../taglib/audio-file-interface.ts";
import type { ExtendedTag, PropertyMap, TagInput } from "../types.ts";
import { fromTagLibKey } from "../constants/properties.ts";
// One definition of the narrowing convention, shared with the WASI handle so
// the handle and readTags() cannot disagree about what "3/12" narrows to.
import { parseLeadingInt as parseNumeric } from "./mirror-fields.ts";

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
  "trackNumber",
]);

const NUMERIC_FIELDS = new Set([
  "year",
  "track",
  "discNumber",
  "totalTracks",
  "totalDiscs",
  "bpm",
]);

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
      // Same for TRACKNUMBER: the numeric `track` cannot represent "3/12" or
      // "03", so without the raw string a readTags() -> applyTags() round-trip
      // (the documented copy-tags-between-formats flow) writes back a bare "3"
      // and destroys the total. taglib-qpl fixed the wire boundary; this is the
      // same loss one layer up.
      if (propKey === "trackNumber") {
        tag.trackNumber = values.length === 1 ? values[0] : values;
      }
    } else {
      tag[tagField] = values;
    }
  }

  // A pair written as "n/total" in ONE field is narrowed into number + total on
  // the typed surface only. The shim no longer splits it on the PropertyMap
  // (taglib-asg: the two backends disagreed, and the raw string is canonical
  // now), but `totalTracks`/`totalDiscs` remain useful, and deriving them here is
  // additive — `properties().trackNumber` keeps the raw "3/12".
  for (
    const [propKey, totalField] of [
      ["trackNumber", "totalTracks"],
      ["discNumber", "totalDiscs"],
    ] as const
  ) {
    if (tag[totalField] !== undefined) continue;
    const raw = props[propKey]?.[0];
    const slash = raw?.indexOf("/") ?? -1;
    if (raw === undefined || slash === -1) continue;
    const total = parseNumeric(raw.slice(slash + 1));
    if (total !== undefined) tag[totalField] = total;
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
  reconcilePairFields(currentProps, newProps, tags);
  file.setProperties({ ...currentProps, ...newProps });
}

/**
 * Reconcile the two ways a track/disc pair can be expressed, against the value
 * the file already has. Only this function has all three inputs — the current
 * properties, the normalized update, and the caller's original intent — which is
 * why neither `normalizeTagInput` (a pure transform, blind to the file) nor the
 * `tag()` surface (blind to the update) can do it.
 *
 * Two rules, both learned from getting them wrong:
 *
 *  - Setting only the NUMBER preserves an existing total. `tag().setTrack(5)` on
 *    a "3/12" yields "5/12", and `applyTags({track: 5})` used to yield "5" — the
 *    same intent producing different files.
 *  - A new raw pair supersedes any existing separate total. Spreading
 *    `currentProps` first meant a stale `totalTracks` of 5 could survive next to
 *    a new "3/12" and contradict it.
 */
function reconcilePairFields(
  currentProps: PropertyMap,
  newProps: Record<string, string[] | undefined>,
  input: Partial<TagInput>,
): void {
  const pairs = [
    ["trackNumber", "totalTracks", "track"],
    ["discNumber", "totalDiscs", "discNumber"],
  ] as const;

  for (const [rawKey, totalKey, numericKey] of pairs) {
    const incoming = newProps[rawKey]?.[0];

    if (incoming?.includes("/")) {
      // The incoming pair is authoritative, so the separate total must be
      // REMOVED, not merely omitted: under WASI's merge model an absent key means
      // "unchanged", so dropping it would leave the file's stale total in place to
      // contradict the new pair. An empty list is the explicit clear.
      newProps[totalKey] = [];
      continue;
    }

    // Only the bare number was given, so inherit the total the file already has.
    const numericOnly = input[numericKey] !== undefined &&
      input[rawKey as keyof TagInput] === undefined;
    if (!numericOnly || incoming === undefined) continue;
    const existing = currentProps[rawKey]?.[0];
    const slash = existing?.indexOf("/") ?? -1;
    if (existing !== undefined && slash !== -1) {
      newProps[rawKey] = [`${incoming}${existing.slice(slash)}`];
    }
  }
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
    const values = Array.isArray(val) ? val : [val];
    // "" from a CALLER means remove the field. An empty value the file already
    // holds — a numeric-only TCON reads back as "" — means keep it, and reaches
    // setProperties as [""] via the spread of current properties. Both looked
    // identical there, so protecting the second stopped the first from clearing
    // (MP4 and WAV kept an empty field). Only here are the caller's intent and
    // the file's state both in scope, so this is where they are told apart: an
    // all-empty update becomes the empty list setProperties already treats as a
    // delete.
    props[field] = values.every((v) => v === "") ? [] : values;
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
  // `trackNumber` carries the raw string ("03", "3/12") and wins over the
  // numeric `track` when both are set, exactly as `date` wins over `year`.
  // Explicit rather than relying on the generic loop below running later.
  if (input.trackNumber !== undefined) {
    props.trackNumber = Array.isArray(input.trackNumber)
      ? input.trackNumber
      : [input.trackNumber];
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

  // A raw "n/total" already carries the total, so do NOT also emit the derived
  // `totalTracks`/`totalDiscs`: that would store the total twice (in the pair AND
  // in a separate tag) on a readTags() -> applyTags() round-trip, since the typed
  // read derives them. Raw wins, as it does for date-over-year (taglib-asg).
  for (
    const [rawField, totalField] of [
      ["trackNumber", "totalTracks"],
      ["discNumber", "totalDiscs"],
    ] as const
  ) {
    if (props[rawField]?.[0]?.includes("/")) delete props[totalField];
  }

  return props as PropertyMap;
}
