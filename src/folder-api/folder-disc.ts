/**
 * Disc-folder name recognition (pure grammar, taglib-ys7m split).
 *
 * Standalone recognizer: classifies a directory name as a disc folder and
 * corroborates gated names against siblings. No Wasm, no I/O — this module
 * is part of the disc-folder subpath's pure graph (taglib-cd7b).
 */

import type {
  DiscConfidence,
  DiscFolderInfo,
  DiscParse,
} from "./album-types.ts";

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i === -1 ? path : path.slice(0, i);
}

// Medium-label markers. Unconditional ones (CD, DVD, SACD, ...) are not
// plausible album-title words, so "CD1" alone is a disc. Title-word markers
// (tape, vinyl, cassette, LP, record) collide with real album titles ("Tape 4"
// by Sleep/Felbm) and are GATED: a lone "Tape 4" folder is an album title,
// while "Tape 1" + "Tape 2" siblings still fold as discs (2026-08-04 feedback).
const UNCONDITIONAL_MARKERS = [
  "cd",
  "disc",
  "disk",
  "dvd",
  "sacd",
  "blu-ray",
  "bd",
  "digital media",
];
const GATED_MARKERS = ["tape", "vinyl", "cassette", "lp", "record"];
const MARKERS = [...UNCONDITIONAL_MARKERS, ...GATED_MARKERS];
const GATED_MARKER_SET = new Set(GATED_MARKERS);

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function romanToInt(s: string): number {
  const values: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = values[s[i]];
    if (v === undefined) return NaN;
    total += v < prev ? -v : v;
    prev = v;
  }
  return total;
}

function parseNumberToken(token: string): number | undefined {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  const word = WORD_NUMBERS[token.toLowerCase()];
  if (word) return word;
  const roman = romanToInt(token.toLowerCase());
  return Number.isFinite(roman) ? roman : undefined;
}

const SEP = String.raw`[\s._#-]*`;
// A number token: arabic, roman, word — or a SINGLE letter, which is a side
// label ("CD A", "Album (CD D)") parsed as a gated, numberless token.
// Non-digit tokens need a right word boundary: without it, "Recordings 1"
// matched "record" + the first letter of "ings" (2026-08-04 report).
const NUM = String
  .raw`(?:\d+|(?:[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[a-z])(?![a-z]))`;

/**
 * Parse a directory name as a disc folder. Returns undefined for non-disc
 * names. Plain "Bonus" and "Extras" are NEVER discs by name (tuneup rule;
 * the low-tier table's "Extras" row was the flagged divergence).
 */
export function parseDiscName(name: string): DiscParse | undefined {
  const trimmed = name.trim();
  if (/^(?:extras?|bonus)$/i.test(trimmed)) return undefined;

  for (const marker of MARKERS) {
    // Word-delimited on the LEFT (start or a non-alphanumeric char) and on
    // the RIGHT (the marker must not run into a letter — "Recordings" is not
    // "record" + "ings"), so "Help 1", "Abcd1", "Scalp 1", "Recordings 1"
    // and "The Complete Recordings (41 Tracks)" are never LP 1 / CD 1 /
    // record discs.
    const left = String.raw`(?:^|[^a-z0-9])`;
    const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      left + String.raw`(${esc})(?![a-z])${SEP}(${NUM})`,
      "i",
    );
    const m = trimmed.match(re);
    if (!m) continue;

    // A single-letter token ("CD D", "CD A") is a side label, not a number —
    // gated like the bare-letter tier, no disc number (box-set convention).
    const sideLetter = /^[a-z]$/i.test(m[2]);
    const number = sideLetter ? undefined : parseNumberToken(m[2]);
    if (number === undefined && !sideLetter) continue;
    // Multi-letter roman tokens must be plausible disc numbers: all-roman-
    // letter words ("Mic" = 1099, "Mix" = 1011) are titles, not numerals
    // (2026-08-04 review — same word-collision class as the Recordings bug).
    if (
      !sideLetter && /^[ivxlcdm]{2,}$/i.test(m[2]) && (number ?? 0) > 100
    ) continue;

    const isGated = GATED_MARKER_SET.has(marker.toLowerCase()) || sideLetter;

    // Title text = everything before the marker's first character.
    const markerStart = m.index! + m[1].length - marker.length;
    const rawPrefix = trimmed.slice(0, markerStart).trim();
    const title = rawPrefix.replace(/[()[\]]/g, "").replace(/[\s._#-]+$/, "") ||
      undefined;
    const isExact = title === undefined;

    // Trailing text after the number becomes the disc title.
    const after = trimmed.slice(m.index! + m[0].length).trim();
    const discTitle = after
      .replace(/^[()[\],:;\-–—\s]+/, "")
      .replace(/[)\]\[,:;\-–—\s]+$/, "")
      .trim() || undefined;

    // "of N" total from "CD 1 of 2".
    const ofMatch = after.trim().match(/^of\s+(\d+)\b/i);
    const total = ofMatch ? parseInt(ofMatch[1], 10) : undefined;

    return {
      kind: isExact ? "exact" : "embedded",
      number: sideLetter ? undefined : number,
      total,
      title,
      discTitle,
      gated: isGated,
      sideLetter,
      digit: /^\d+$/.test(m[2]),
    };
  }

  // Volume / Part (medium).
  const volume = trimmed.match(
    /^(?:volume|vol\.?|part|pt\.?)\s*(\d+)(?:\s*of\s*(\d+))?$/i,
  );
  if (volume) {
    return {
      kind: "volume",
      number: parseInt(volume[1], 10),
      total: volume[2] ? parseInt(volume[2], 10) : undefined,
      title: undefined,
      discTitle: undefined,
      gated: false,
      sideLetter: false,
      digit: true,
    };
  }

  // Bonus Disc (low; needs corroboration).
  if (/^bonus\s+disc$/i.test(trimmed)) {
    return {
      kind: "bonus",
      number: undefined,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      gated: true,
      sideLetter: false,
      digit: false,
    };
  }

  // Bare numbers / letters / V1 / P2 (low; needs corroboration).
  if (/^(?:\d+|v\d+|p\d+|[ab])$/i.test(trimmed)) {
    return {
      kind: "bare",
      number: /^\d+$/i.test(trimmed) ? parseInt(trimmed, 10) : undefined,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      gated: true,
      sideLetter: false,
      digit: false,
    };
  }

  return undefined;
}

export function baseConfidence(parse: DiscParse): DiscConfidence {
  switch (parse.kind) {
    case "exact":
      // Word/roman numerals are only low-confidence evidence.
      return parse.digit ? "high" : "low";
    case "embedded":
      return "medium";
    case "volume":
      return "medium";
    case "bonus":
    case "bare":
      return "low";
  }
}

/**
 * Recognize a directory name as a disc folder. Standalone — it only
 * classifies the name; it does not resolve the folder to its parent (use
 * the album result's per-file `albumDir` for that). Returns undefined for
 * non-disc names. Plain "Bonus" and "Extras" are never discs by name.
 */
export function discFolderInfo(name: string): DiscFolderInfo | undefined {
  const parse = parseDiscName(name);
  if (!parse) return undefined;
  return {
    kind: parse.kind,
    gated: parse.gated,
    number: parse.number,
    total: parse.total,
    title: parse.title,
    discTitle: parse.discTitle,
    confidence: parse.gated ? "low" : baseConfidence(parse),
  };
}
