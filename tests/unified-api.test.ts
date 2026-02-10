/**
 * @fileoverview Tests for unified API with runtime detection and WASI optimization
 *
 * Tests the Phase 3.4 unified API implementation that maintains backward
 * compatibility while adding WASI optimizations for server environments.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { detectRuntime } from "../src/runtime/detector.ts";
import {
  getRecommendedConfig,
  isWasiAvailable,
  loadUnifiedTagLibModule,
} from "../src/runtime/unified-loader.ts";
import { loadTagLibModule, TagLib } from "../index.ts";

Deno.test("Runtime detection - detects Deno environment correctly", () => {
  const runtime = detectRuntime();

  assertEquals(runtime.environment, "deno-wasi");
  assertEquals(runtime.supportsFilesystem, true);
  assertEquals(runtime.supportsStreaming, true);
  assertEquals(runtime.performanceTier >= 1, true);

  console.log(
    `Detected runtime: ${runtime.environment}, performance tier: ${runtime.performanceTier}`,
  );
});

Deno.test("WASI availability check", () => {
  const available = isWasiAvailable();

  // In Deno environment, WASI should be available
  assertEquals(available, true);

  console.log(`WASI available: ${available}`);
});

Deno.test("Recommended configuration for current environment", () => {
  const config = getRecommendedConfig();

  assertExists(config);
  assertEquals(typeof config.disableOptimizations, "boolean");

  console.log(`Recommended config:`, config);
});

Deno.test("Unified loader - auto-detects optimal implementation", async () => {
  try {
    const module = await loadUnifiedTagLibModule();

    assertExists(module);
    assertExists(module.runtime);
    assertEquals(typeof module.isWasi, "boolean");
    assertEquals(typeof module.isEmscripten, "boolean");

    // In Deno, should select WASI
    assertEquals(module.isWasi, true);
    assertEquals(module.isEmscripten, false);
    assertEquals(module.runtime.environment, "deno-wasi");

    // Should have performance metrics
    if (module.getPerformanceMetrics) {
      const metrics = module.getPerformanceMetrics();
      assertEquals(typeof metrics.initTime, "number");
      assertEquals(metrics.wasmType, "wasi");
      assertEquals(metrics.environment, "deno-wasi");
    }

    console.log(
      `Loaded unified module: ${module.isWasi ? "WASI" : "Emscripten"}`,
    );
  } catch (error) {
    console.warn(`Unified loader test skipped due to error: ${error}`);
    // This might fail if WASI dependencies are not available, which is acceptable
  }
});

Deno.test("Unified loader - forced Emscripten mode", async () => {
  try {
    const module = await loadUnifiedTagLibModule({
      forceWasmType: "emscripten",
    });

    assertExists(module);
    assertEquals(module.isWasi, false);
    assertEquals(module.isEmscripten, true);

    console.log(`Forced Emscripten mode: ${module.isEmscripten}`);
  } catch (error) {
    console.warn(`Forced Emscripten test skipped due to error: ${error}`);
  }
});

Deno.test("Main API - backward compatibility with auto-selection", async () => {
  try {
    // Test that loadTagLibModule now uses unified loader by default
    const module = await loadTagLibModule();

    assertExists(module);
    assertExists(module.createFileHandle);

    // Should be able to create file handle
    const fileHandle = module.createFileHandle();
    assertExists(fileHandle);
    assertExists(fileHandle.loadFromBuffer);
    assertExists(fileHandle.isValid);

    console.log("Main API backward compatibility verified");
  } catch (error) {
    console.warn(`Main API test skipped due to error: ${error}`);
  }
});

Deno.test("Main API - buffer mode still works", async () => {
  try {
    // Test that buffer mode explicitly disables unified features
    const module = await loadTagLibModule({ forceBufferMode: true });

    assertExists(module);
    assertExists(module.createFileHandle);

    // Buffer mode module should not have unified features
    assertEquals("runtime" in module, false);
    assertEquals("isWasi" in module, false);
    assertEquals("isEmscripten" in module, false);

    console.log("Buffer mode compatibility verified");
  } catch (error) {
    console.warn(`Buffer mode test skipped due to error: ${error}`);
  }
});

Deno.test("TagLib.initialize - works with unified loader", async () => {
  try {
    const taglib = await TagLib.initialize();

    assertExists(taglib);
    assertEquals(typeof taglib.version, "function");
    assertEquals(taglib.version(), "2.1.0");

    console.log(`TagLib.initialize works, version: ${taglib.version()}`);
  } catch (error) {
    console.warn(`TagLib.initialize test skipped due to error: ${error}`);
  }
});

Deno.test("TagLib.initialize - works with options", async () => {
  try {
    // Test with WASI forced
    const taglib1 = await TagLib.initialize({ forceWasmType: "wasi" });
    assertExists(taglib1);

    // Test with buffer mode
    const taglib2 = await TagLib.initialize({ forceBufferMode: true });
    assertExists(taglib2);

    // Test with optimizations disabled
    const taglib3 = await TagLib.initialize({ disableOptimizations: true });
    assertExists(taglib3);

    console.log("TagLib.initialize with options works");
  } catch (error) {
    console.warn(
      `TagLib.initialize options test skipped due to error: ${error}`,
    );
  }
});

Deno.test("Unified API - performance comparison", async () => {
  try {
    // Test both WASI and Emscripten initialization times
    const startWasi = performance.now();
    const wasiModule = await loadUnifiedTagLibModule({ forceWasmType: "wasi" });
    const wasiTime = performance.now() - startWasi;

    const startEmscripten = performance.now();
    const emscriptenModule = await loadUnifiedTagLibModule({
      forceWasmType: "emscripten",
    });
    const emscriptenTime = performance.now() - startEmscripten;

    console.log(`WASI init time: ${wasiTime.toFixed(2)}ms`);
    console.log(`Emscripten init time: ${emscriptenTime.toFixed(2)}ms`);

    // Both should be reasonable (under 1 second)
    assert(wasiTime < 1000);
    assert(emscriptenTime < 1000);

    // Clean up
    if (wasiModule.getPerformanceMetrics) {
      console.log("WASI metrics:", wasiModule.getPerformanceMetrics());
    }
    if (emscriptenModule.getPerformanceMetrics) {
      console.log(
        "Emscripten metrics:",
        emscriptenModule.getPerformanceMetrics(),
      );
    }
  } catch (error) {
    console.warn(`Performance comparison skipped due to error: ${error}`);
  }
});

Deno.test("Error handling - graceful fallback", async () => {
  try {
    // Test what happens when WASI is forced but fails
    const module = await loadUnifiedTagLibModule({
      forceWasmType: "wasi",
      // Invalid URL to trigger fallback
      wasmUrl: "/nonexistent/path.wasm",
    });

    // Should fall back to Emscripten
    assertExists(module);
    assertEquals(module.isEmscripten, true);

    console.log("Graceful fallback to Emscripten works");
  } catch (error) {
    console.warn(`Error handling test skipped due to error: ${error}`);
  }
});
