/**
 * @fileoverview Cross-runtime WASI host smoke test
 *
 * Verifies that loadWasiHost() works correctly on Deno, Node.js, and Bun.
 * Run with: deno run, npx tsx, or bun run.
 */

import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyFile, mkdir, rm } from "node:fs/promises";
import process from "node:process";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import { WasmArena, type WasmExports } from "../src/runtime/wasi-memory.ts";
import { decodeTagData } from "../src/msgpack/decoder.ts";
import { encodeTagData } from "../src/msgpack/encoder.ts";
import { detectRuntime } from "../src/runtime/detector.ts";

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "..",
);
const WASM_PATH = join(PROJECT_ROOT, "dist/wasi/taglib_wasi.wasm");
const TEST_FILES_DIR = join(PROJECT_ROOT, "tests/test-files");
const MP3_FILE = "mp3/kiss-snippet.mp3";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

async function main(): Promise<void> {
  const runtime = detectRuntime();
  console.log(
    `Cross-runtime WASI host tests (${runtime.environment})\n`,
  );

  using wasi = await loadWasiHost({
    wasmPath: WASM_PATH,
    preopens: { "/test": TEST_FILES_DIR },
  });

  await test("runtime auto-detected WASI-capable provider", () => {
    assert.ok(
      runtime.wasmType === "wasi",
      `Expected wasi, got ${runtime.wasmType}`,
    );
    return Promise.resolve();
  });

  await test("read tags via path", async () => {
    using arena = new WasmArena(wasi as WasmExports);
    const pathAlloc = arena.allocString(`/test/${MP3_FILE}`);
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(pathAlloc.ptr, 0, 0, outSizePtr.ptr);
    assert.ok(resultPtr !== 0, "tl_read_tags returned null pointer");

    const outSize = outSizePtr.readUint32();
    const u8 = new Uint8Array(wasi.memory.buffer);
    const tags = decodeTagData(u8.slice(resultPtr, resultPtr + outSize));
    assert.ok(tags.title, "Expected non-empty title");
    await Promise.resolve();
  });

  await test("read tags via buffer", async () => {
    const { readFileData } = await import("../src/utils/file.ts");
    const fileData = await readFileData(join(TEST_FILES_DIR, MP3_FILE));

    using arena = new WasmArena(wasi as WasmExports);
    const inputBuf = arena.allocBuffer(fileData);
    const outSizePtr = arena.allocUint32();

    const resultPtr = wasi.tl_read_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      outSizePtr.ptr,
    );
    assert.ok(resultPtr !== 0, "tl_read_tags (buffer) returned null pointer");

    const outSize = outSizePtr.readUint32();
    const u8 = new Uint8Array(wasi.memory.buffer);
    const tags = decodeTagData(u8.slice(resultPtr, resultPtr + outSize));
    assert.ok(tags.title, "Expected non-empty title from buffer read");
  });

  await test("write + read roundtrip via path", async () => {
    const tempDir = join(tmpdir(), `taglib-wasm-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    const tempFile = join(tempDir, "roundtrip.mp3");
    await copyFile(join(TEST_FILES_DIR, MP3_FILE), tempFile);

    try {
      using wasiRt = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/tmp": tempDir },
      });

      const newTags = { title: "Cross-Runtime Test", artist: "taglib-wasm" };
      const tagBytes = encodeTagData(newTags);

      {
        using arena = new WasmArena(wasiRt as WasmExports);
        const pathAlloc = arena.allocString("/tmp/roundtrip.mp3");
        const tagBuf = arena.allocBuffer(tagBytes);
        const outSizePtr = arena.allocUint32();

        const result = wasiRt.tl_write_tags(
          pathAlloc.ptr,
          0,
          0,
          tagBuf.ptr,
          tagBuf.size,
          0,
          outSizePtr.ptr,
        );
        assert.equal(result, 0, `tl_write_tags failed: code ${result}`);
      }

      {
        using arena = new WasmArena(wasiRt as WasmExports);
        const pathAlloc = arena.allocString("/tmp/roundtrip.mp3");
        const outSizePtr = arena.allocUint32();

        const resultPtr = wasiRt.tl_read_tags(
          pathAlloc.ptr,
          0,
          0,
          outSizePtr.ptr,
        );
        assert.ok(resultPtr !== 0, "read-back returned null pointer");

        const outSize = outSizePtr.readUint32();
        const u8 = new Uint8Array(wasiRt.memory.buffer);
        const readBack = decodeTagData(
          u8.slice(resultPtr, resultPtr + outSize),
        );
        assert.equal(readBack.title, "Cross-Runtime Test");
        assert.equal(readBack.artist, "taglib-wasm");
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
