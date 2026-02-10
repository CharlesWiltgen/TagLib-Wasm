/**
 * @fileoverview Benchmark comparing WASI host (path I/O) vs Emscripten (buffer I/O)
 *
 * Quantifies performance difference between:
 * 1. WASI host: Seek-based filesystem I/O via WASI syscalls (reads only headers/tags)
 * 2. Emscripten: Host reads entire file into memory, passes buffer to Wasm
 *
 * All formats (FLAC, OGG, MP3, WAV, M4A) are supported via the EH-enabled sysroot.
 *
 * Run with: deno bench --allow-read --allow-write --allow-env tests/wasi-vs-emscripten.bench.ts
 */

import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";
import { encodeTagData } from "../src/msgpack/encoder.ts";
import { TagLib } from "../src/taglib.ts";
import type { WasiModule } from "../src/runtime/wasmer-sdk-loader.ts";
import type { ExtendedTag, Tag } from "../src/types.ts";
import { TEST_FILES } from "./test-utils.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");

const DEEZER_DIR = "/Volumes/T9 (4TB)/Downloads/Deezer";
const REAL_FLAC_SRC =
  `${DEEZER_DIR}/Various Artists - 90s Acoustic Hits/Counting Crows - Mr. Jones.flac`;

function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

function readTagsWasi(
  wasi: WasiModule,
  virtualPath: string,
): ReturnType<typeof decodeTagData> {
  using arena = new WasmArena(wasi as WasmExports);
  const pathAlloc = arena.allocString(virtualPath);
  const outSizePtr = arena.allocUint32();

  const resultPtr = wasi.tl_read_tags(pathAlloc.ptr, 0, 0, outSizePtr.ptr);
  if (resultPtr === 0) throw new Error(`WASI read failed: ${virtualPath}`);

  const outSize = outSizePtr.readUint32();
  const u8 = new Uint8Array(wasi.memory.buffer);
  return decodeTagData(
    new Uint8Array(u8.slice(resultPtr, resultPtr + outSize)),
  );
}

function writeTagsWasi(
  wasi: WasiModule,
  virtualPath: string,
  tags: ExtendedTag,
): void {
  using arena = new WasmArena(wasi as WasmExports);
  const pathAlloc = arena.allocString(virtualPath);
  const tagBytes = encodeTagData(tags);
  const tagBuf = arena.allocBuffer(tagBytes);
  const outSizePtr = arena.allocUint32();

  const result = wasi.tl_write_tags(
    pathAlloc.ptr,
    0,
    0,
    tagBuf.ptr,
    tagBuf.size,
    0,
    outSizePtr.ptr,
  );
  if (result !== 0) throw new Error(`WASI write failed: ${virtualPath}`);
}

async function readTagsEmscripten(
  taglib: TagLib,
  buf: Uint8Array,
): Promise<Tag> {
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

// Pre-init WASI host module (reused across bench iterations)
let wasi: (WasiModule & Disposable) | null = null;
if (HAS_WASM) {
  wasi = await loadWasiHost({
    wasmPath: WASM_PATH,
    preopens: { "/test": TEST_FILES_DIR },
  });
}

// Pre-init Emscripten TagLib (legacy mode forces Emscripten binary)
let emTagLib: TagLib | null = null;
if (HAS_WASM) {
  emTagLib = await TagLib.initialize({ legacyMode: true });
}

// Copy real-world FLAC to temp dir (if available)
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

// Write benchmark temp dir
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

// --- Benchmark groups ---

// read-flac (both engines support FLAC)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-flac",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/flac/kiss-snippet.flac");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-flac",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(
      resolve(PROJECT_ROOT, TEST_FILES.flac),
    );
    await readTagsEmscripten(emTagLib!, buf);
  },
});

// read-ogg (both engines support OGG)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-ogg",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/ogg/kiss-snippet.ogg");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-ogg",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(
      resolve(PROJECT_ROOT, TEST_FILES.ogg),
    );
    await readTagsEmscripten(emTagLib!, buf);
  },
});

// read-mp3 (MPEG format)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-mp3",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/mp3/kiss-snippet.mp3");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-mp3",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(
      resolve(PROJECT_ROOT, TEST_FILES.mp3),
    );
    await readTagsEmscripten(emTagLib!, buf);
  },
});

// read-wav (RIFF/WAV format)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-wav",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/wav/kiss-snippet.wav");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-wav",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(
      resolve(PROJECT_ROOT, TEST_FILES.wav),
    );
    await readTagsEmscripten(emTagLib!, buf);
  },
});

// read-m4a (MP4/AAC format)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-m4a",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/mp4/kiss-snippet.m4a");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-m4a",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    const buf = await Deno.readFile(
      resolve(PROJECT_ROOT, TEST_FILES.m4a),
    );
    await readTagsEmscripten(emTagLib!, buf);
  },
});

// read-all-formats (all 5 formats sequentially)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-all-formats",
  ignore: !HAS_WASM,
  fn() {
    readTagsWasi(wasi!, "/test/flac/kiss-snippet.flac");
    readTagsWasi(wasi!, "/test/ogg/kiss-snippet.ogg");
    readTagsWasi(wasi!, "/test/mp3/kiss-snippet.mp3");
    readTagsWasi(wasi!, "/test/wav/kiss-snippet.wav");
    readTagsWasi(wasi!, "/test/mp4/kiss-snippet.m4a");
  },
});

Deno.bench({
  name: "Emscripten (buffer I/O)",
  group: "read-all-formats",
  baseline: true,
  ignore: !HAS_WASM,
  async fn() {
    for (
      const disk of [
        TEST_FILES.flac,
        TEST_FILES.ogg,
        TEST_FILES.mp3,
        TEST_FILES.wav,
        TEST_FILES.m4a,
      ]
    ) {
      const buf = await Deno.readFile(resolve(PROJECT_ROOT, disk));
      await readTagsEmscripten(emTagLib!, buf);
    }
  },
});

// write-roundtrip (FLAC temp copy)
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
    readTagsWasi(writeWasi!, "/tmp/bench-write.flac");
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

// batch-10 (same FLAC x10 — simulates scanning)
Deno.bench({
  name: "WASI host (path I/O)",
  group: "batch-10",
  ignore: !HAS_WASM,
  fn() {
    for (let i = 0; i < 10; i++) {
      readTagsWasi(wasi!, "/test/flac/kiss-snippet.flac");
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

// real-world FLAC (~33MB) — key test: WASI should dominate
Deno.bench({
  name: "WASI host (path I/O)",
  group: "read-real-flac",
  ignore: !HAS_WASM || !HAS_DEEZER,
  fn() {
    readTagsWasi(realWasi!, "/real/real.flac");
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
