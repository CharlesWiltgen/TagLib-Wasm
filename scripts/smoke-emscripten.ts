#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * Hard smoke test for the Emscripten backend.
 *
 * Unlike the unit suite (which SKIPS the Emscripten backend when it fails to
 * load, so a broken wasm still shows green), this FAILS the build: it forces
 * the Emscripten backend, instantiates the freshly-built `build/taglib-web.wasm`,
 * and reads a fixture. It guards against shipping a wasm/glue mismatch like the
 * 1.4.1 `./a` regression. Run in CI right after `build:wasm`.
 */
import { TagLib } from "../src/taglib.ts";

const wasmBinary = await Deno.readFile(
  new URL("../build/taglib-web.wasm", import.meta.url),
);

let bitrate = 0;
let title: string | undefined;
try {
  const taglib = await TagLib.initialize({
    wasmBinary,
    forceWasmType: "emscripten",
  });
  const audio = await Deno.readFile(
    new URL("../tests/test-files/mp3/kiss-snippet.mp3", import.meta.url),
  );
  const file = await taglib.open(audio);
  bitrate = file.audioProperties()?.bitrate ?? 0;
  title = file.tag().title;
  file.dispose();
} catch (err) {
  console.error(
    "❌ Emscripten smoke test FAILED: the backend could not instantiate/read.\n" +
      "   This usually means a wasm/glue import mismatch (e.g. a skewed wasm-opt).\n" +
      `   ${err instanceof Error ? err.message : err}`,
  );
  Deno.exit(1);
}

if (bitrate <= 0) {
  console.error(
    `❌ Emscripten smoke test: instantiated but audioProperties().bitrate=${bitrate}`,
  );
  Deno.exit(1);
}

console.log(
  `✅ Emscripten smoke test passed: initialize() + open() + read ` +
    `(bitrate=${bitrate}kbps, title="${title}")`,
);
