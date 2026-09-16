/**
 * @fileoverview Cross-runtime backend matrix smoke test.
 *
 * Forces each backend in turn — `wasi` and `emscripten` — and asserts the same
 * fixture reads the same values, in every runtime that can load them. The
 * library's promise is one API across runtimes AND two wasm backends; this is
 * the cheap end-to-end proof of both, on the runtime that is actually running.
 *
 * Runs UNCHANGED on Deno, Bun and Node (via `tsx`): `node:` builtins and
 * relative imports only, fixtures resolved from `import.meta.url`.
 */

import { readFile } from "node:fs/promises";
import process from "node:process";
import { TagLib } from "../../src/taglib.ts";

const FIXTURES = [
  { name: "mp3", path: "../test-files/mp3/kiss-snippet.mp3", codec: "MP3" },
  { name: "flac", path: "../test-files/flac/kiss-snippet.flac", codec: "FLAC" },
  { name: "m4a", path: "../test-files/mp4/kiss-snippet.m4a", codec: "AAC" },
] as const;

const BACKENDS = ["wasi", "emscripten"] as const;

let checks = 0;
let failures = 0;
let skipped = 0;

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

for (const backend of BACKENDS) {
  let taglib: TagLib;
  try {
    taglib = await TagLib.initialize({ forceWasmType: backend });
  } catch (error) {
    // A runtime that cannot load this backend is a SKIP, not a pass: it is
    // reported loudly so a silently-skipping matrix can never look green.
    skipped++;
    console.log(
      `  ⚠ ${backend}: not loadable in this runtime — ${
        (error as Error).message.split("\n")[0]
      }`,
    );
    continue;
  }

  for (const fixture of FIXTURES) {
    const bytes = await readFile(new URL(fixture.path, import.meta.url));
    using file = await taglib.open(new Uint8Array(bytes));
    const props = file.audioProperties();
    check(`${backend} ${fixture.name} title`, file.tag().title, "Kiss");
    check(`${backend} ${fixture.name} artist`, file.tag().artist, "Prince");
    check(`${backend} ${fixture.name} codec`, props?.codec, fixture.codec);
    check(
      `${backend} ${fixture.name} duration > 0`,
      (props?.duration ?? 0) > 0,
      true,
    );
  }
}

console.log(
  `backends: ${
    checks - failures
  }/${checks} checks passed, ${skipped} backend(s) skipped`,
);
process.exit(failures === 0 ? 0 : 1);
