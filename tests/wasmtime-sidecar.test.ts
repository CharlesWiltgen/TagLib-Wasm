/**
 * @fileoverview Tests for WasmtimeSidecar class
 *
 * Tests the long-lived Wasmtime subprocess for WASI filesystem access.
 * Requires wasmtime CLI to be installed. Tests are skipped if wasmtime
 * is not available.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { WasmtimeSidecar } from "../src/runtime/wasmtime-sidecar.ts";

const PROJECT_ROOT = resolve(Deno.cwd());
const TEST_FILES_DIR = resolve(PROJECT_ROOT, "tests/test-files");
const SIDECAR_WASM_PATH = resolve(
  PROJECT_ROOT,
  "dist/wasi/taglib-sidecar.wasm",
);

/**
 * Check if wasmtime CLI is available
 */
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

/**
 * Check if sidecar WASM binary exists
 */
async function sidecarBinaryExists(): Promise<boolean> {
  try {
    await Deno.stat(SIDECAR_WASM_PATH);
    return true;
  } catch {
    return false;
  }
}

let wasmtimeAvailable = false;
let sidecarExists = false;

beforeAll(async () => {
  wasmtimeAvailable = await isWasmtimeAvailable();
  sidecarExists = await sidecarBinaryExists();

  if (!wasmtimeAvailable) {
    console.warn(
      "wasmtime CLI not available - WasmtimeSidecar tests will be skipped",
    );
  }
  if (!sidecarExists) {
    console.warn(
      `Sidecar binary not found at ${SIDECAR_WASM_PATH} - tests will be skipped`,
    );
  }
});

describe("WasmtimeSidecar", () => {
  let sidecar: WasmtimeSidecar | null = null;

  afterEach(async () => {
    if (sidecar) {
      await sidecar.shutdown();
      sidecar = null;
    }
  });

  it("should spawn wasmtime process", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await sidecar.start();
    assertEquals(sidecar.isRunning(), true);
  });

  it("should read tags from path", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await sidecar.start();
    const tags = await sidecar.readTags("/test/mp3/kiss-snippet.mp3");

    assertExists(tags);
    const raw = tags as unknown as Record<string, unknown>;
    assertEquals(typeof raw.title, "string");
    assertEquals(raw.title, "Kiss");
  });

  it("should handle non-existent files", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await sidecar.start();
    await assertRejects(
      () => sidecar!.readTags("/test/nonexistent.mp3"),
      Error,
    );
  });

  it("should report not running before start", () => {
    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    assertEquals(sidecar.isRunning(), false);
  });

  it("should report not running after shutdown", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await sidecar.start();
    assertEquals(sidecar.isRunning(), true);

    await sidecar.shutdown();
    assertEquals(sidecar.isRunning(), false);
    sidecar = null; // Prevent double shutdown in afterEach
  });

  it("should use custom wasmtime path if provided", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    // Find the actual wasmtime path
    const whichCommand = new Deno.Command("which", {
      args: ["wasmtime"],
      stdout: "piped",
    });
    const { stdout } = await whichCommand.output();
    const wasmtimePath = new TextDecoder().decode(stdout).trim();

    if (!wasmtimePath) {
      console.log("Skipping: could not determine wasmtime path");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
      wasmtimePath,
    });

    await sidecar.start();
    assertEquals(sidecar.isRunning(), true);
  });

  it("should throw if start called when already running", async () => {
    if (!wasmtimeAvailable || !sidecarExists) {
      console.log("Skipping: wasmtime or sidecar binary not available");
      return;
    }

    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await sidecar.start();

    await assertRejects(
      () => sidecar!.start(),
      Error,
      "already running",
    );
  });

  it("should throw if readTags called before start", async () => {
    sidecar = new WasmtimeSidecar({
      wasmPath: SIDECAR_WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR },
    });

    await assertRejects(
      () => sidecar!.readTags("/test/mp3/kiss-snippet.mp3"),
      Error,
      "not running",
    );
  });
});
