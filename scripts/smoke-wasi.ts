#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * Hard smoke test for the WASI backend (the default in Deno/Node).
 *
 * Like scripts/smoke-emscripten.ts but forces the WASI backend and reads the
 * freshly-built `build/taglib-wasi.wasm`. Fails (does not skip) if the backend
 * can't instantiate — guarding against a wasm/host import mismatch such as
 * Deno's publish-time unfurl (`wasi_snapshot_preview1` -> `./wasi_snapshot_preview1`).
 */
import { TagLib } from "../src/taglib.ts";

let bitrate = 0;
let title: string | undefined;
try {
  const taglib = await TagLib.initialize({ forceWasmType: "wasi" });
  const audio = await Deno.readFile(
    new URL("../tests/test-files/mp3/kiss-snippet.mp3", import.meta.url),
  );
  const file = await taglib.open(audio);
  bitrate = file.audioProperties()?.bitrate ?? 0;
  title = file.tag().title;
  file.dispose();
} catch (err) {
  console.error(
    "❌ WASI smoke test FAILED: the backend could not instantiate/read.\n" +
      `   ${err instanceof Error ? err.message : err}`,
  );
  Deno.exit(1);
}

if (bitrate <= 0) {
  console.error(`❌ WASI smoke test: instantiated but bitrate=${bitrate}`);
  Deno.exit(1);
}

console.log(
  `✅ WASI smoke test passed: initialize({wasi}) + open() + read ` +
    `(bitrate=${bitrate}kbps, title="${title}")`,
);
