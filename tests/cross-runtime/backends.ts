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
    // A backend that cannot be loaded in a supported runtime is reported with
    // its reason and FAILS the run (see the exit below): a silently-skipping
    // matrix can never look green.
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

// A backend that cannot be loaded in a runtime this library claims to support
// is a FAILURE, not a pass: a silently-skipping matrix is exactly how the WASI
// half of the parity tests stayed dark in CI for months. The skip is printed
// with its reason first, then the run fails (measured: an empty backend list
// used to report "0/0 checks passed" and exit 0; a single skipped backend
// reported "12/12 checks passed, 1 skipped" and also exited 0).
if (checks === 0) {
  console.error(
    `  ✗ no backend could be loaded in this runtime (${skipped} skipped) — nothing was asserted`,
  );
  process.exit(1);
}
if (skipped > 0) {
  console.error(
    `  ✗ ${skipped} backend(s) could not be loaded — the matrix is incomplete`,
  );
}

console.log(
  `backends: ${
    checks - failures
  }/${checks} checks passed, ${skipped} backend(s) skipped`,
);
process.exit(failures === 0 && skipped === 0 ? 0 : 1);
