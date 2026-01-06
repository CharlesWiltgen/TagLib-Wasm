/**
 * @fileoverview Benchmark tests comparing buffer-based vs sidecar approaches
 *
 * Quantifies performance difference between:
 * 1. Buffer mode: Host reads file, passes buffer to WASM
 * 2. Sidecar mode: WASI subprocess reads file directly from filesystem
 *
 * Requires wasmtime CLI to be installed. Benchmarks are skipped if wasmtime
 * is not available.
 *
 * Run with: deno bench --allow-read --allow-write --allow-run tests/sidecar-benchmark.bench.ts
 */

import { resolve } from "@std/path";
import { WasmtimeSidecar } from "../src/runtime/wasmtime-sidecar.ts";
import { readTags } from "../src/simple.ts";
import { TEST_FILES } from "./test-utils.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const SIDECAR_WASM_PATH = resolve(
  PROJECT_ROOT,
  "dist/wasi/taglib-sidecar.wasm",
);

const TEST_FILE_PATH = resolve(PROJECT_ROOT, TEST_FILES.mp3);
const SIDECAR_VIRTUAL_PATH = "/test/mp3/kiss-snippet.mp3";

async function isWasmtimeAvailable(): Promise<boolean> {
  try {
    const command = new Deno.Command("wasmtime", {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    });
    const { success } = await command.output();
    return success;
  } catch {
    return false;
  }
}

async function sidecarBinaryExists(): Promise<boolean> {
  try {
    await Deno.stat(SIDECAR_WASM_PATH);
    return true;
  } catch {
    return false;
  }
}

const wasmtimeAvailable = await isWasmtimeAvailable();
const sidecarExists = await sidecarBinaryExists();
const canRunBenchmarks = wasmtimeAvailable && sidecarExists;

if (!wasmtimeAvailable) {
  console.warn(
    "wasmtime CLI not available - sidecar benchmarks will be skipped",
  );
}
if (!sidecarExists) {
  console.warn(
    `Sidecar binary not found at ${SIDECAR_WASM_PATH} - benchmarks will be skipped`,
  );
}

const testFilePaths = [
  resolve(PROJECT_ROOT, TEST_FILES.mp3),
  resolve(PROJECT_ROOT, TEST_FILES.flac),
  resolve(PROJECT_ROOT, TEST_FILES.ogg),
];

const sidecarVirtualPaths = [
  "/test/mp3/kiss-snippet.mp3",
  "/test/flac/kiss-snippet.flac",
  "/test/ogg/kiss-snippet.ogg",
];

// Initialize sidecar once at module level if available
let sidecar: WasmtimeSidecar | null = null;

if (canRunBenchmarks) {
  sidecar = new WasmtimeSidecar({
    wasmPath: SIDECAR_WASM_PATH,
    preopens: { "/test": TEST_FILES_DIR },
  });
  await sidecar.start();
}

// Clean up sidecar when benchmarks complete
globalThis.addEventListener("unload", () => {
  sidecar?.shutdown();
});

// Single-file benchmarks
Deno.bench({
  name: "readTags - buffer (host reads file)",
  group: "single-file",
  baseline: true,
  ignore: !canRunBenchmarks,
  async fn() {
    const buffer = await Deno.readFile(TEST_FILE_PATH);
    await readTags(buffer);
  },
});

Deno.bench({
  name: "readTags - sidecar (WASI reads file)",
  group: "single-file",
  ignore: !canRunBenchmarks,
  async fn() {
    await sidecar!.readTags(SIDECAR_VIRTUAL_PATH);
  },
});

// Batch benchmarks (3 files)
Deno.bench({
  name: "batch 3 files - buffer",
  group: "batch-3",
  baseline: true,
  ignore: !canRunBenchmarks,
  async fn() {
    for (const file of testFilePaths) {
      const buffer = await Deno.readFile(file);
      await readTags(buffer);
    }
  },
});

Deno.bench({
  name: "batch 3 files - sidecar",
  group: "batch-3",
  ignore: !canRunBenchmarks,
  async fn() {
    for (const file of sidecarVirtualPaths) {
      await sidecar!.readTags(file);
    }
  },
});

// Batch benchmarks (10 iterations of same file - simulates larger batch)
Deno.bench({
  name: "batch 10 iterations - buffer",
  group: "batch-10",
  baseline: true,
  ignore: !canRunBenchmarks,
  async fn() {
    for (let i = 0; i < 10; i++) {
      const buffer = await Deno.readFile(TEST_FILE_PATH);
      await readTags(buffer);
    }
  },
});

Deno.bench({
  name: "batch 10 iterations - sidecar",
  group: "batch-10",
  ignore: !canRunBenchmarks,
  async fn() {
    for (let i = 0; i < 10; i++) {
      await sidecar!.readTags(SIDECAR_VIRTUAL_PATH);
    }
  },
});
