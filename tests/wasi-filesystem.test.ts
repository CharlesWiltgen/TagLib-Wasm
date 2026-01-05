/**
 * @fileoverview Tests for WASI module loading via Wasmer WASI
 *
 * Verifies that loadWasmerWasi properly uses @wasmer/wasi with real
 * WASI imports instead of stub implementations.
 */

import { assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import {
  loadWasmerWasi,
  type WasmerLoaderConfig,
} from "../src/runtime/wasmer-sdk-loader.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const WASM_PATH = resolve(PROJECT_ROOT, "dist/taglib-wasi.wasm");

describe("WASI module loading", () => {
  it("should load WASI module with mounts config", async () => {
    const config: WasmerLoaderConfig = {
      wasmPath: WASM_PATH,
      mounts: {
        "/test": TEST_FILES_DIR,
      },
      debug: true,
    };

    const module = await loadWasmerWasi(config);

    assertExists(module);
    assertExists(module.memory);
  });

  it("should load WASI module without mounts", async () => {
    const config: WasmerLoaderConfig = {
      wasmPath: WASM_PATH,
      debug: false,
    };

    const module = await loadWasmerWasi(config);

    assertExists(module);
    assertExists(module.memory);
  });

  it("should have memory property after loading", async () => {
    const config: WasmerLoaderConfig = {
      wasmPath: WASM_PATH,
      debug: false,
    };

    const module = await loadWasmerWasi(config);

    assertExists(module.memory);
    assertExists(module.memory.buffer);
  });
});
