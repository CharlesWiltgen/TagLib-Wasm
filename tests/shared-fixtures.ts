/**
 * @fileoverview Consolidated test fixtures for cross-backend validation.
 *
 * All expected values for the "kiss-snippet" test files, shared between
 * WASI and Emscripten test suites.
 */

import { resolve } from "@std/path";

export const FORMATS = [
  "mp3",
  "flac",
  "ogg",
  "m4a",
  "wav",
  "opus",
  "mp4",
  "oga",
  "wv",
  "tta",
  "wma",
  "mka",
  "mkv",
  "webm",
] as const;
export type Format = (typeof FORMATS)[number];

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");

export const FIXTURE_PATH: Record<Format, string> = {
  mp3: resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
  flac: resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
  ogg: resolve(TEST_FILES_DIR, "ogg/kiss-snippet.ogg"),
  m4a: resolve(TEST_FILES_DIR, "mp4/kiss-snippet.m4a"),
  wav: resolve(TEST_FILES_DIR, "wav/kiss-snippet.wav"),
  opus: resolve(TEST_FILES_DIR, "opus/kiss-snippet.opus"),
  mp4: resolve(TEST_FILES_DIR, "mp4/kiss-snippet.mp4"),
  oga: resolve(TEST_FILES_DIR, "oga/kiss-snippet.oga"),
  wv: resolve(TEST_FILES_DIR, "wv/kiss-snippet.wv"),
  tta: resolve(TEST_FILES_DIR, "tta/kiss-snippet.tta"),
  wma: resolve(TEST_FILES_DIR, "wma/kiss-snippet.wma"),
  mka: resolve(TEST_FILES_DIR, "matroska/kiss-snippet.mka"),
  mkv: resolve(TEST_FILES_DIR, "matroska/kiss-snippet.mkv"),
  webm: resolve(TEST_FILES_DIR, "matroska/kiss-snippet.webm"),
};

/**
 * Expected tags for the kiss-snippet fixtures, PER FORMAT.
 *
 * These files are not identical, and a single format-agnostic constant was
 * wrong for 8 of the 14 (it looked authoritative while asserting nothing).
 * Measured at the file level with readTags over every fixture and corroborated
 * by parsing each container's tag payload directly (ID3, Vorbis, MP4 `ilst`,
 * APE, ASF, Matroska):
 *
 * - mp3/flac/ogg/oga/opus/wav carry the album from the motion-picture soundtrack
 * - mp4/m4a were remuxed from the single and carry "Kiss (Single)"
 * - wv/tta/wma/mka/mkv/webm still carry the older "Prince and The Revolution"
 *   + "Parade" pair
 */
const PARADE = "Parade - Music from the Motion Picture Under the Cherry Moon";
const SOURCE_ALBUM = {
  title: "Kiss",
  artist: "Prince",
  album: PARADE,
} as const;
const SINGLE = {
  title: "Kiss",
  artist: "Prince",
  album: "Kiss (Single)",
} as const;
const LEGACY = {
  title: "Kiss",
  artist: "Prince and The Revolution",
  album: "Parade",
} as const;

export const EXPECTED_KISS_TAGS: Record<
  Format,
  { title: string; artist: string; album: string }
> = {
  mp3: SOURCE_ALBUM,
  flac: SOURCE_ALBUM,
  ogg: SOURCE_ALBUM,
  oga: SOURCE_ALBUM,
  opus: SOURCE_ALBUM,
  wav: SOURCE_ALBUM,
  mp4: SINGLE,
  m4a: SINGLE,
  wv: LEGACY,
  tta: LEGACY,
  wma: LEGACY,
  mka: LEGACY,
  mkv: LEGACY,
  webm: LEGACY,
};

export const EXPECTED_AUDIO_PROPS: Record<
  Format,
  {
    sampleRate: number;
    channels: number;
    bitrateMin: number;
    bitrateMax: number;
    lengthMin: number;
    lengthMax: number;
  }
> = {
  mp3: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 100,
    bitrateMax: 400,
    lengthMin: 1,
    lengthMax: 30,
  },
  flac: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 500,
    bitrateMax: 2000,
    lengthMin: 1,
    lengthMax: 30,
  },
  ogg: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  m4a: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  wav: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 500,
    bitrateMax: 2000,
    lengthMin: 1,
    lengthMax: 30,
  },
  opus: {
    sampleRate: 48000,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 200,
    lengthMin: 1,
    lengthMax: 30,
  },
  mp4: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  oga: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  wv: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 500,
    bitrateMax: 2000,
    lengthMin: 1,
    lengthMax: 30,
  },
  tta: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 500,
    bitrateMax: 2000,
    lengthMin: 1,
    lengthMax: 30,
  },
  wma: {
    sampleRate: 44100,
    channels: 2,
    bitrateMin: 50,
    bitrateMax: 300,
    lengthMin: 1,
    lengthMax: 30,
  },
  mka: {
    sampleRate: 48000,
    channels: 1,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  mkv: {
    sampleRate: 48000,
    channels: 1,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
  webm: {
    sampleRate: 48000,
    channels: 1,
    bitrateMin: 50,
    bitrateMax: 500,
    lengthMin: 1,
    lengthMax: 30,
  },
};

export const TEST_FILES_DIR_PATH = TEST_FILES_DIR;

export function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}
