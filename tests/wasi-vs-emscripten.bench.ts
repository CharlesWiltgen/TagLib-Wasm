/**
 * @fileoverview Benchmark comparing WASI host (path I/O) vs Emscripten (buffer I/O)
 *
 * Quantifies performance difference between:
 * 1. WASI host: Seek-based filesystem I/O via WASI syscalls (reads only headers/tags)
 * 2. Emscripten: Host reads entire file into memory, passes buffer to Wasm
 *
 * Emscripten benchmarks intentionally include host file I/O (Deno.readFile) to
 * measure end-to-end cost — the real-world workflow requires loading the full
 * file before passing it to the Wasm module.
 *
 * Run with: deno bench --allow-read --allow-write --allow-env tests/wasi-vs-emscripten.bench.ts
 */

import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { TagLib } from "../src/taglib.ts";
import type { WasiModule } from "../src/runtime/wasmer-sdk-loader/index.ts";
import type { MutableTag } from "../src/taglib/mutable-tag.ts";
import { TEST_FILES } from "./test-utils.ts";
import {
  fileExists,
  FORMAT_FILES,
  readTagsViaPath,
  writeTagsWasi,
} from "./wasi-test-helpers.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

const DEEZER_DIR = "/Volumes/T9 (4TB)/Downloads/Deezer";
const REAL_FLAC_SRC =
  `${DEEZER_DIR}/Various Artists - 90s Acoustic Hits/Counting Crows - Mr. Jones.flac`;

async function readTagsEmscripten(
  taglib: TagLib,
  buf: Uint8Array,
): Promise<MutableTag> {
  const file = await taglib.open(buf);
  try {
    return file.tag();
  } finally {
    file.dispose();
  }
}

const HAS_WASM = fileExists(WASM_PATH);
const HAS_DEEZER = fileExists(DEEZER_DIR);

if (!HAS_WASM) {
  console.warn(
    `WASI binary not found at ${WASM_PATH} — all benchmarks skipped`,
  );
}
if (!HAS_DEEZER) {
  console.warn(
    "Deezer volume not mounted — real-file benchmarks skipped",
  );
}

let wasi: (WasiModule & Disposable) | null = null;
if (HAS_WASM) {
  wasi = await loadWasiHost({
    wasmPath: WASM_PATH,
    preopens: { "/test": TEST_FILES_DIR },
  });
}

let emTagLib: TagLib | null = null;
if (HAS_WASM) {
  emTagLib = await TagLib.initialize({ forceBufferMode: true });
}

let realTempDir: string | null = null;
let realWasi: (WasiModule & Disposable) | null = null;

if (HAS_WASM && HAS_DEEZER) {
  realTempDir = await Deno.makeTempDir({ prefix: "taglib-bench-" });
  await Deno.copyFile(REAL_FLAC_SRC, resolve(realTempDir, "real.flac"));

  realWasi = await loadWasiHost({
    wasmPath: WASM_PATH,
    preopens: { "/real": realTempDir },
  });
}

let writeTempDir: string | null = null;
let writeWasi: (WasiModule & Disposable) | null = null;
const WRITE_FLAC_SRC = resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac");

if (HAS_WASM) {
  writeTempDir = await Deno.makeTempDir({ prefix: "taglib-bench-write-" });
  writeWasi = await loadWasiHost({
    wasmPath: WASM_PATH,
    preopens: { "/tmp": writeTempDir },
  });
}

globalThis.addEventListener("unload", () => {
  wasi?.[Symbol.dispose]();
  realWasi?.[Symbol.dispose]();
  writeWasi?.[Symbol.dispose]();
  for (const dir of [realTempDir, writeTempDir]) {
    if (dir) {
      try {
        Deno.removeSync(dir, { recursive: true });
      } catch { /* ignore */ }
    }
  }
});

// --- Per-format benchmarks (data-driven) ---
for (const [format, paths] of Object.entries(FORMAT_FILES)) {
  const group = `read-${format.toLowerCase()}`;
  Deno.bench({
    name: "WASI host (path I/O)",
    group,
    ignore: !HAS_WASM,
    fn() {
      readTagsViaPath(wasi!, paths.virtual);
    },
  });
  Deno.bench({
    name: "Emscripten (buffer I/O)",
    group,
    baseline: true,
    ignore: !HAS_WASM,
    async fn() {
      const key = format.toLowerCase() as keyof typeof TEST_FILES;
      const buf = await Deno.readFile(resolve(PROJECT_ROOT, TEST_FILES[key]));
      await readTagsEmscripten(emTagLib!, buf);
    },
  });
}

// --- Aggregate benchmarks ---

Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-all-formats",
  ignore: !HAS_WASM,
  fn() {
    for (const paths of Object.values(FORMAT_FILES)) {
      readTagsViaPath(wasi!, paths.virtual);
    }
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-all-formats",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    for (const file of Object.values(TEST_FILES)) {
      const buf = await Deno.readFile(resolve(PROJECT_ROOT, file));
      await readTagsEmscripten(emTagLib!, buf);
    }
  },
});

// --- Write roundtrip ---

Deno.bench({
  name: "WASI host (path I/O)",
  group: "write-roundtrip",
  ignore: !HAS_WASM,
  async fn() {
    const dest = resolve(writeTempDir!, "bench-write.flac");
    await Deno.copyFile(WRITE_FLAC_SRC, dest);
    writeTagsWasi(writeWasi!, "/tmp/bench-write.flac", {
      title: "Bench Title",
    });
    readTagsViaPath(writeWasi!, "/tmp/bench-write.flac");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "write-roundtrip",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(WRITE_FLAC_SRC);
    const file = await emTagLib!.open(buf);
    try {
      const tag = file.tag();
      tag.setTitle("Bench Title");
      file.save();
      const modified = file.getFileBuffer();
      const tmpPath = resolve(writeTempDir!, "bench-write-em.flac");
      await Deno.writeFile(tmpPath, modified);
      const readBack = await Deno.readFile(tmpPath);
      await readTagsEmscripten(emTagLib!, readBack);
    } finally {
      file.dispose();
    }
  },
});

// --- Batch scanning ---

Deno.bench({
  name: "WASI host (path I/O)",
  group: "batch-10",
  ignore: !HAS_WASM,
  fn() {
    for (let i = 0; i < 10; i++) {
      readTagsViaPath(wasi!, "/test/flac/kiss-snippet.flac");
    }
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "batch-10",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    for (let i = 0; i < 10; i++) {
      const buf = await Deno.readFile(
        resolve(PROJECT_ROOT, TEST_FILES.flac),
      );
      await readTagsEmscripten(emTagLib!, buf);
    }
  },
});

// --- Real-world FLAC (~33MB) ---

Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-real-flac",
  ignore: !HAS_WASM || !HAS_DEEZER,
  fn() {
    readTagsViaPath(realWasi!, "/real/real.flac");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-real-flac",
  baseline: true,
  ignore: !HAS_WASM || !HAS_DEEZER,
  async fn() {
    const buf = await Deno.readFile(resolve(realTempDir!, "real.flac"));
    await readTagsEmscripten(emTagLib!, buf);
  },
});
