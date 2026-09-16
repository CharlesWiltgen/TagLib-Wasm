/**
 * @fileoverview Cross-runtime Simple API smoke test.
 *
 * Runs UNCHANGED on Deno, Bun and Node (via `tsx`), so it must stay
 * dependency-free: `node:` builtins and relative imports only — no test
 * framework, no `jsr:`/`npm:` specifiers, no cwd assumptions. Fixtures resolve
 * from `import.meta.url`, which is what the previous harness got wrong (it
 * generated a file importing a path that had moved, so every runtime failed
 * before asserting anything).
 *
 * Driven by `tests/cross-runtime/run.sh` locally and by CI's Package
 * Compatibility job. Exits non-zero on the first failing expectation, so a
 * runtime whose Simple API silently regresses fails the run.
 *
 * This uses the DEFAULT backend for the runtime (auto-detected). The explicit
 * WASI/Emscripten matrix lives in `backends.ts`.
 */

import process from "node:process";
import { readFormat, readProperties, readTags } from "../../simple.ts";

const fixture = (dir: string, ext: string): string =>
  new URL(`../test-files/${dir}/kiss-snippet.${ext}`, import.meta.url).pathname;

let checks = 0;
let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) {
    failures++;
    console.error(
      `  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function checkTrue(label: string, value: boolean): void {
  checks++;
  if (!value) {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

const CASES = [
  {
    dir: "mp3",
    ext: "mp3",
    format: "MP3",
    codec: "MP3",
    lossless: false,
    album: "Parade - Music from the Motion Picture Under the Cherry Moon",
  },
  {
    dir: "flac",
    ext: "flac",
    format: "FLAC",
    codec: "FLAC",
    lossless: true,
    album: "Parade - Music from the Motion Picture Under the Cherry Moon",
  },
  {
    dir: "mp4",
    ext: "m4a",
    format: "MP4",
    codec: "AAC",
    lossless: false,
    album: "Kiss (Single)",
  },
] as const;

for (const c of CASES) {
  const path = fixture(c.dir, c.ext);

  check(`${c.ext} format`, await readFormat(path), c.format);

  const tags = await readTags(path);
  check(`${c.ext} title`, tags.title?.[0], "Kiss");
  check(`${c.ext} artist`, tags.artist?.[0], "Prince");
  check(`${c.ext} album`, tags.album?.[0], c.album);

  const props = await readProperties(path);
  check(`${c.ext} codec`, props?.codec, c.codec);
  check(`${c.ext} containerFormat`, props?.containerFormat, c.format);
  check(`${c.ext} isLossless`, props?.isLossless, c.lossless);
  checkTrue(`${c.ext} has a duration`, (props?.duration ?? 0) > 0);
  checkTrue(`${c.ext} has a bitrate`, (props?.bitrate ?? 0) > 0);
  checkTrue(`${c.ext} has a sample rate`, (props?.sampleRate ?? 0) > 0);
}

console.log(
  `simple-api: ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);
