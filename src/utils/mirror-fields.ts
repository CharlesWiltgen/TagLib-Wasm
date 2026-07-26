/**
 * @fileoverview Raw-string / numeric-mirror field pairs.
 *
 * Two tag fields are stored twice: a RAW string that is authoritative and can
 * hold what a number cannot ("1975-10-31", "3/12", "03"), and a narrowed numeric
 * MIRROR that the typed `tag()` surface promises (`year`, `track`). Both map to
 * the same TagLib wire key, so exactly one of them may cross the boundary.
 *
 * The rules are few but easy to get subtly wrong, and they were previously
 * hand-written at seven sites across two files. The copies drifted, and the
 * drift was not cosmetic — every bug below came from one site knowing a rule its
 * twin did not:
 *
 *   - taglib-qpl: `setProperty` left a stale mirror when the new raw value did
 *     not parse, so `tag().track` reported the previous number.
 *   - taglib-qpl: `setProperty("")` did not clear, so a deletion was a silent
 *     no-op and the old number was written back to disk.
 *   - taglib-iyfr: both of the above were still live for `date`/`year`, because
 *     only the `trackNumber`/`track` copy had been fixed.
 *
 * So the rules live here once, and adding a third pair is a one-line change.
 */

/** A raw-string field and the numeric mirror derived from it. */
export type MirrorField = {
  /** camelCase key holding the raw string. Authoritative. */
  readonly raw: string;
  /** camelCase key holding the narrowed number. Derived, never authoritative. */
  readonly numeric: string;
};

export const MIRROR_FIELDS: readonly MirrorField[] = [
  { raw: "date", numeric: "year" },
  { raw: "trackNumber", numeric: "track" },
];

/**
 * Leading integer of a raw field value, or `undefined` when it does not parse.
 * The single definition of the narrowing convention: `parseInt` semantics, so
 * "3/12" is 3 and "03" is 3, and a non-numeric value has no mirror at all.
 */
export function parseLeadingInt(raw: string): number | undefined {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** The pair whose raw key is `key`, if any. */
export function mirrorForRawKey(key: string): MirrorField | undefined {
  return MIRROR_FIELDS.find((f) => f.raw === key);
}

/** The pair whose numeric key is `key`, if any. */
export function mirrorForNumericKey(key: string): MirrorField | undefined {
  return MIRROR_FIELDS.find((f) => f.numeric === key);
}

/** True when a value is present — tolerates the scalar/array shapes tagData mixes. */
function hasValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== "";
}

/** First element of an array value, or the scalar itself, as a string. */
export function firstValueString(v: unknown): string {
  if (Array.isArray(v)) return (v[0] as string) ?? "";
  return v === undefined || v === null ? "" : String(v);
}

/**
 * True when `key` is a numeric mirror whose raw partner currently holds a value.
 *
 * Both keys translate to one wire key, so emitting both would collide — the raw
 * string wins because it carries strictly more information. Used by the WASI
 * property snapshot and by the msgpack encoder, which previously each inlined
 * their own copy of this test.
 */
export function isShadowedNumericMirror(
  data: Record<string, unknown>,
  key: string,
): boolean {
  const field = mirrorForNumericKey(key);
  return field !== undefined && hasValue(data[field.raw]);
}

/**
 * Stage a RAW write: store the string and re-derive the mirror. An empty value
 * list clears the field, which is what lets `clearTags()` remove it under WASI's
 * merge model; an unparseable value drops the mirror rather than leaving a stale
 * number behind. Mutates `target`.
 */
export function stageRawWrite(
  target: Record<string, unknown>,
  field: MirrorField,
  values: readonly string[],
): void {
  const first = values[0] ?? "";
  if (values.length === 0 || first === "") {
    delete target[field.raw];
    delete target[field.numeric];
    return;
  }
  target[field.raw] = [...values];
  const narrowed = parseLeadingInt(first);
  if (narrowed === undefined) delete target[field.numeric];
  else target[field.numeric] = narrowed;
}

/**
 * Stage a NUMERIC write from the typed `tag()` surface: the number is
 * authoritative, so the raw mirror is replaced rather than merged — a stale
 * "3/12" must not shadow a newly set 7. A non-positive value is a clear, not a
 * renumbering. Mutates `target`.
 */
export function stageNumericWrite(
  target: Record<string, unknown>,
  field: MirrorField,
  value: number,
): void {
  if (value > 0) {
    target[field.numeric] = value;
    target[field.raw] = [String(value)];
  } else {
    delete target[field.numeric];
    delete target[field.raw];
  }
}

/**
 * Numeric value for the typed surface: the mirror when present, otherwise
 * narrowed from the raw string so a handle that only ever saw the raw value
 * still reports a number.
 */
export function readNumericMirror(
  data: Record<string, unknown>,
  field: MirrorField,
): number {
  const mirror = data[field.numeric];
  if (typeof mirror === "number" && mirror !== 0) return mirror;
  return parseLeadingInt(firstValueString(data[field.raw])) ?? 0;
}
