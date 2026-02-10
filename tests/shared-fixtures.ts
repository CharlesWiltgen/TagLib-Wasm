/**
 * @fileoverview Consolidated test fixtures for cross-backend validation.
 *
 * All expected values for the "kiss-snippet" test files, shared between
 * WASI and Emscripten test suites.
 */

import { resolve } from "@std/path";

export const FORMATS = ["mp3", "flac", "ogg", "m4a", "wav"] as const;
export type Format = (typeof FORMATS)[number];

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");

export const FIXTURE_PATH: Record<Format, string> = {
  mp3: resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
  flac: resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
  ogg: resolve(TEST_FILES_DIR, "ogg/kiss-snippet.ogg"),
  m4a: resolve(TEST_FILES_DIR, "mp4/kiss-snippet.m4a"),
  wav: resolve(TEST_FILES_DIR, "wav/kiss-snippet.wav"),
};

export const WASI_VIRTUAL_PATH: Record<Format, string> = {
  mp3: "/test/mp3/kiss-snippet.mp3",
  flac: "/test/flac/kiss-snippet.flac",
  ogg: "/test/ogg/kiss-snippet.ogg",
  m4a: "/test/mp4/kiss-snippet.m4a",
  wav: "/test/wav/kiss-snippet.wav",
};

export const EXPECTED_KISS_TAGS = {
  title: "Kiss",
  artist: "Prince and The Revolution",
  album: "Parade",
} as const;

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
