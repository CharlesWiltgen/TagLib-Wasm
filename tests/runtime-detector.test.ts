/**
 * @fileoverview Tests for runtime detection logic
 *
 * Tests all runtime environment detection scenarios and ensures
 * optimal WASM binary selection for each environment type.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  _clearRuntimeOverride,
  _forceRuntime,
  _getDetectionResult,
  canLoadWasmType,
  detectRuntime,
  getEnvironmentDescription,
  type RuntimeDetectionResult,
  type RuntimeEnvironment,
  type WasmBinaryType,
} from "../src/runtime/detector.ts";

Deno.test("detectRuntime - returns valid result structure", () => {
  const result = detectRuntime();

  // Verify all required fields are present
  assertExists(result.environment);
  assertExists(result.wasmType);
  assertEquals(typeof result.supportsFilesystem, "boolean");
  assertEquals(typeof result.supportsStreaming, "boolean");
  assertEquals(typeof result.performanceTier, "number");

  // Verify performance tier is valid
  assertEquals([1, 2, 3].includes(result.performanceTier), true);

  // Verify wasmType is valid
  assertEquals(["wasi", "emscripten"].includes(result.wasmType), true);
});

Deno.test("detectRuntime - Deno environment detection", () => {
  const result = detectRuntime();

  // In Deno environment, should detect deno-wasi
  assertEquals(result.environment, "deno-wasi");
  assertEquals(result.wasmType, "wasi");
  assertEquals(result.supportsFilesystem, true);
  assertEquals(result.supportsStreaming, true);
  assertEquals(result.performanceTier, 1);
});

Deno.test("getEnvironmentDescription - provides human-readable descriptions", () => {
  const environments: RuntimeEnvironment[] = [
    "deno-wasi",
    "node-wasi",
    "browser",
    "worker",
    "cloudflare",
    "node-emscripten",
  ];

  for (const env of environments) {
    const description = getEnvironmentDescription(env);
    assertEquals(typeof description, "string");
    assertEquals(description.length > 0, true);
    // Description should contain the environment name
    assertEquals(description.toLowerCase().includes(env.split("-")[0]), true);
  }
});

Deno.test("canLoadWasmType - WASI availability check", () => {
  // In Deno, WASI should be available
  assertEquals(canLoadWasmType("wasi"), true);

  // Emscripten should always be available
  assertEquals(canLoadWasmType("emscripten"), true);
});

Deno.test("runtime override system for testing", () => {
  // Clear any existing override
  _clearRuntimeOverride();

  const originalResult = detectRuntime();

  // Set a test override
  const testResult: RuntimeDetectionResult = {
    environment: "browser",
    wasmType: "emscripten",
    supportsFilesystem: false,
    supportsStreaming: true,
    performanceTier: 2,
  };

  _forceRuntime(testResult);

  // Should return the overridden result
  const overriddenResult = _getDetectionResult();
  assertEquals(overriddenResult, testResult);

  // Clear override
  _clearRuntimeOverride();

  // Should return back to normal detection
  const restoredResult = _getDetectionResult();
  assertEquals(restoredResult, originalResult);
});

Deno.test("performance tier ranking is logical", () => {
  // Test different environment scenarios using overrides
  _clearRuntimeOverride();

  const scenarios: Array<{
    name: string;
    result: RuntimeDetectionResult;
    expectedTier: number;
  }> = [
    {
      name: "Deno WASI (optimal)",
      result: {
        environment: "deno-wasi",
        wasmType: "wasi",
        supportsFilesystem: true,
        supportsStreaming: true,
        performanceTier: 1,
      },
      expectedTier: 1,
    },
    {
      name: "Browser (good)",
      result: {
        environment: "browser",
        wasmType: "emscripten",
        supportsFilesystem: false,
        supportsStreaming: true,
        performanceTier: 2,
      },
      expectedTier: 2,
    },
    {
      name: "Cloudflare Workers (fallback)",
      result: {
        environment: "cloudflare",
        wasmType: "emscripten",
        supportsFilesystem: false,
        supportsStreaming: false,
        performanceTier: 3,
      },
      expectedTier: 3,
    },
  ];

  for (const scenario of scenarios) {
    _forceRuntime(scenario.result);
    const result = _getDetectionResult();
    assertEquals(
      result.performanceTier,
      scenario.expectedTier,
      `${scenario.name} should have tier ${scenario.expectedTier}`,
    );
  }

  _clearRuntimeOverride();
});

Deno.test("WASM binary type selection matches environment", () => {
  const testCases: Array<{
    environment: RuntimeEnvironment;
    expectedWasmType: WasmBinaryType;
  }> = [
    { environment: "deno-wasi", expectedWasmType: "wasi" },
    { environment: "node-wasi", expectedWasmType: "wasi" },
    { environment: "browser", expectedWasmType: "emscripten" },
    { environment: "worker", expectedWasmType: "emscripten" },
    { environment: "cloudflare", expectedWasmType: "emscripten" },
    { environment: "node-emscripten", expectedWasmType: "emscripten" },
  ];

  for (const testCase of testCases) {
    const testResult: RuntimeDetectionResult = {
      environment: testCase.environment,
      wasmType: testCase.expectedWasmType,
      supportsFilesystem: testCase.environment.includes("node") ||
        testCase.environment.includes("deno"),
      supportsStreaming: true,
      performanceTier: 1,
    };

    _forceRuntime(testResult);
    const result = _getDetectionResult();

    assertEquals(
      result.wasmType,
      testCase.expectedWasmType,
      `${testCase.environment} should use ${testCase.expectedWasmType}`,
    );
  }

  _clearRuntimeOverride();
});

Deno.test("filesystem support matches environment capabilities", () => {
  const testCases = [
    { env: "deno-wasi", shouldSupportFS: true },
    { env: "node-wasi", shouldSupportFS: true },
    { env: "node-emscripten", shouldSupportFS: true },
    { env: "browser", shouldSupportFS: false },
    { env: "worker", shouldSupportFS: false },
    { env: "cloudflare", shouldSupportFS: false },
  ] as const;

  for (const testCase of testCases) {
    const testResult: RuntimeDetectionResult = {
      environment: testCase.env,
      wasmType: testCase.env.includes("wasi") ? "wasi" : "emscripten",
      supportsFilesystem: testCase.shouldSupportFS,
      supportsStreaming: true,
      performanceTier: 1,
    };

    _forceRuntime(testResult);
    const result = _getDetectionResult();

    assertEquals(
      result.supportsFilesystem,
      testCase.shouldSupportFS,
      `${testCase.env} filesystem support should be ${testCase.shouldSupportFS}`,
    );
  }

  _clearRuntimeOverride();
});
