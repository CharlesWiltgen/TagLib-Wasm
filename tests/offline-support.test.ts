/**
 * @fileoverview Tests for offline support and Deno compile utilities
 */

import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import { loadTagLibModule } from "../index.ts";
import {
  initializeForDenoCompile,
  isDenoCompiled,
  prepareWasmForEmbedding,
} from "../src/deno-compile.ts";
import { join } from "@std/path";

// Check if Emscripten build is available and functional
let emscriptenAvailable = false;
try {
  const wasmPath = new URL("../dist/taglib-web.wasm", import.meta.url);
  const wasmBinary = await Deno.readFile(wasmPath);
  const module = await loadTagLibModule({
    wasmBinary,
    forceBufferMode: true,
  });
  emscriptenAvailable = module != null;
} catch {
  // Emscripten build not available or stale
}

describe("OfflineSupport", () => {
  it("isDenoCompiled detects development environment", () => {
    assertEquals(isDenoCompiled(), false);
  });

  it({
    name: "loadTagLibModule with wasmBinary option",
    ignore: !emscriptenAvailable,
    fn: async () => {
      const wasmPath = new URL("../dist/taglib-web.wasm", import.meta.url);
      const wasmBinary = await Deno.readFile(wasmPath);
      const module = await loadTagLibModule({
        wasmBinary,
        forceBufferMode: true,
      });
      assertExists(module);
      const { createTagLib } = await import("../src/taglib.ts");
      const taglib = await createTagLib(module);
      assertExists(taglib);
      const testFile = await Deno.readFile(
        new URL("./test-files/mp3/kiss-snippet.mp3", import.meta.url),
      );
      const file = await taglib.open(testFile);
      assertExists(file);
      file.dispose();
    },
  });

  it({
    name: "loadTagLibModule with custom wasmUrl",
    ignore: !emscriptenAvailable,
    fn: async () => {
      const wasmUrl = new URL("../dist/taglib-web.wasm", import.meta.url).href;
      const module = await loadTagLibModule({
        wasmUrl,
        forceBufferMode: true,
      });
      assertExists(module);
      const { createTagLib } = await import("../src/taglib.ts");
      const taglib = await createTagLib(module);
      assertExists(taglib);
      const testFile = await Deno.readFile(
        new URL("./test-files/mp3/kiss-snippet.mp3", import.meta.url),
      );
      const file = await taglib.open(testFile);
      assertExists(file);
      file.dispose();
    },
  });

  it({
    name: "TagLib.initialize with wasmBinary",
    ignore: !emscriptenAvailable,
    fn: async () => {
      const wasmPath = new URL("../dist/taglib-web.wasm", import.meta.url);
      const wasmBinary = await Deno.readFile(wasmPath);
      const taglib = await TagLib.initialize({
        wasmBinary,
        forceBufferMode: true,
      });
      assertExists(taglib);
      const testFile = await Deno.readFile(
        new URL("./test-files/mp3/kiss-snippet.mp3", import.meta.url),
      );
      const file = await taglib.open(testFile);
      assertEquals(file.tag().title, "Kiss");
      file.dispose();
    },
  });

  it({
    name: "TagLib.initialize with custom wasmUrl",
    ignore: !emscriptenAvailable,
    fn: async () => {
      const wasmUrl = new URL("../dist/taglib-web.wasm", import.meta.url).href;
      const taglib = await TagLib.initialize({ wasmUrl });
      assertExists(taglib);
      const testFile = await Deno.readFile(
        new URL("./test-files/mp3/kiss-snippet.mp3", import.meta.url),
      );
      const file = await taglib.open(testFile);
      assertExists(file.tag());
      file.dispose();
    },
  });

  it("initializeForDenoCompile in development mode", async () => {
    // In development, should fall back to network initialization
    const taglib = await initializeForDenoCompile();
    assertExists(taglib);

    // Verify it works
    const testFile = await Deno.readFile(
      new URL("./test-files/mp3/kiss-snippet.mp3", import.meta.url),
    );
    const file = await taglib.open(testFile);
    assertExists(file.tag());
    file.dispose();
  });

  it("prepareWasmForEmbedding creates WASM file", async () => {
    const tempDir = await Deno.makeTempDir();
    const outputPath = join(tempDir, "test-taglib.wasm");

    try {
      // Prepare the WASM file
      await prepareWasmForEmbedding(outputPath);

      // Verify the file was created
      const stat = await Deno.stat(outputPath);
      assertExists(stat);
      assertEquals(stat.isFile, true);

      // Verify it's a valid WASM file (starts with WASM magic number)
      const data = await Deno.readFile(outputPath);
      const magic = new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // \0asm
      assertEquals(data[0], magic[0]);
      assertEquals(data[1], magic[1]);
      assertEquals(data[2], magic[2]);
      assertEquals(data[3], magic[3]);
    } finally {
      // Clean up
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("prepareWasmForEmbedding with invalid path throws error", async () => {
    // Save original import.meta.url behavior and paths
    const originalCwd = Deno.cwd();

    try {
      // Change to a directory where WASM won't be found
      const tempDir = await Deno.makeTempDir();
      Deno.chdir(tempDir);

      // This should fail because the WASM file won't be found
      await assertRejects(
        async () => {
          // Try to prepare from a location with no WASM files
          await prepareWasmForEmbedding("/invalid/path/taglib.wasm");
        },
        Error,
        "Failed to prepare WASM for embedding",
      );
    } finally {
      // Restore original directory
      Deno.chdir(originalCwd);
    }
  });
});
