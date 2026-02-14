import { assertEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import {
  _clearRuntimeOverride,
  _forceRuntime,
  _getDetectionResult,
  canLoadWasmType,
  detectRuntime,
  getEnvironmentDescription,
} from "../src/runtime/detector.ts";
import type { RuntimeDetectionResult } from "../src/runtime/detector.ts";

afterEach(() => {
  _clearRuntimeOverride();
});

describe("detectRuntime", () => {
  it("should detect deno-wasi in Deno environment", () => {
    const result = detectRuntime();
    assertEquals(result.environment, "deno-wasi");
    assertEquals(result.wasmType, "wasi");
    assertEquals(result.supportsFilesystem, true);
    assertEquals(result.supportsStreaming, true);
    assertEquals(result.performanceTier, 1);
  });
});

describe("getEnvironmentDescription", () => {
  it("should describe deno-wasi", () => {
    const desc = getEnvironmentDescription("deno-wasi");
    assertEquals(desc.includes("Deno"), true);
    assertEquals(desc.includes("WASI"), true);
  });

  it("should describe node-wasi", () => {
    assertEquals(getEnvironmentDescription("node-wasi").includes("Node"), true);
  });

  it("should describe bun-wasi", () => {
    assertEquals(getEnvironmentDescription("bun-wasi").includes("Bun"), true);
  });

  it("should describe browser", () => {
    assertEquals(
      getEnvironmentDescription("browser").includes("Browser"),
      true,
    );
  });

  it("should describe worker", () => {
    assertEquals(
      getEnvironmentDescription("worker").includes("Worker"),
      true,
    );
  });

  it("should describe cloudflare", () => {
    assertEquals(
      getEnvironmentDescription("cloudflare").includes("Cloudflare"),
      true,
    );
  });

  it("should describe node-emscripten", () => {
    const desc = getEnvironmentDescription("node-emscripten");
    assertEquals(desc.includes("Node"), true);
    assertEquals(desc.includes("Emscripten"), true);
  });

  it("should handle unknown environment", () => {
    const desc = getEnvironmentDescription("unknown" as any);
    assertEquals(desc.includes("Unknown"), true);
  });
});

describe("canLoadWasmType", () => {
  it("should report wasi loadable in Deno", () => {
    assertEquals(canLoadWasmType("wasi"), true);
  });

  it("should always report emscripten as loadable", () => {
    assertEquals(canLoadWasmType("emscripten"), true);
  });
});

describe("_forceRuntime / _getDetectionResult", () => {
  it("should override detection result", () => {
    const override: RuntimeDetectionResult = {
      environment: "browser",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: true,
      performanceTier: 2,
    };

    _forceRuntime(override);
    const result = _getDetectionResult();
    assertEquals(result.environment, "browser");
    assertEquals(result.wasmType, "emscripten");
  });

  it("should return real detection after clearing", () => {
    _forceRuntime({
      environment: "cloudflare",
      wasmType: "emscripten",
      supportsFilesystem: false,
      supportsStreaming: false,
      performanceTier: 3,
    });

    _clearRuntimeOverride();
    const result = _getDetectionResult();
    assertEquals(result.environment, "deno-wasi");
  });

  it("should return real detection when no override set", () => {
    const result = _getDetectionResult();
    assertEquals(result.environment, "deno-wasi");
  });
});
