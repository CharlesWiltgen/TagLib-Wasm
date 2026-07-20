import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  canLoadWasmType,
  detectRuntime,
  getEnvironmentDescription,
  supportsExnref,
} from "../src/runtime/detector.ts";

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

describe("supportsExnref", () => {
  it("should return consistent results across calls", () => {
    assertEquals(supportsExnref(), supportsExnref());
  });

  it("should return true in Deno (supports exnref natively)", () => {
    assertEquals(supportsExnref(), true);
  });
});
