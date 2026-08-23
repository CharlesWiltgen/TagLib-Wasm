/**
 * Internal key classification for the WASI tag-data snapshot.
 *
 * AUDIO_KEYS and INTERNAL_KEYS are excluded from the property surface
 * (getProperties); preserveEmptyValues keeps empty-string fields alive for
 * the save round-trip (taglib-yc1x). Extracted from file-handle.ts in the
 * taglib-1dfc split.
 */

/** Audio metrics emitted by the C++ read path, not tag properties. */
export const AUDIO_KEYS = new Set([
  "bitrate",
  "bitrateMode",
  "bitsPerSample",
  "channels",
  "codec",
  "containerFormat",
  "formatVersion",
  "isEncrypted",
  "isLossless",
  "duration",
  "length",
  "lengthMs",
  "mpegLayer",
  "mpegVersion",
  "outputGainDb",
  "sampleRate",
]);

/** Structured fields and write-time directives, never properties. */
export const INTERNAL_KEYS = new Set([
  "pictures",
  "ratings",
  "lyrics",
  "chapters",
  "_mp4ChapterStyle",
  "bextData",
  "ixml",
  // Exact MP4 atom names for the write path, not a readable property.
  "_mp4ItemNames",
  // Foreign-mean MP4 atom names to delete at save (taglib-65nm): a write-time
  // directive, never a property.
  "_mp4ItemRemovals",
]);

/**
 * A frame that exists holding an empty string is not the same state as no frame
 * at all, and the read snapshot must say so — otherwise the save cannot carry
 * the value back, `setProperties()` sees the field as absent, and TagLib deletes
 * a frame the caller never touched (taglib-yc1x).
 *
 * The C++ encoder emits a single value as a bare string, and both `cleanObject`
 * and `getProperties` drop a bare `""`. An ARRAY containing `""` already
 * survives every one of those layers, so promoting the bare form to `[""]` here
 * carries the value end to end without touching the encoder or the decoder.
 *
 * This only concerns readable tag properties: audio metrics and the internal
 * write-time channels keep their own shapes.
 */
export function preserveEmptyValues(
  data: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(data)) {
    if (value !== "") continue;
    if (AUDIO_KEYS.has(key) || INTERNAL_KEYS.has(key)) continue;
    if (key.startsWith("----:")) continue;
    data[key] = [""];
  }
  return data;
}
