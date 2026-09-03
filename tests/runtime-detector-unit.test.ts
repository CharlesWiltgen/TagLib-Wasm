import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EnvironmentError } from "../src/errors/classes.ts";
import {
  canLoadWasmType,
  detectRuntime,
  type EnvironmentProfile,
  environmentProfile,
  getEnvironmentDescription,
  type RuntimeDetectionResult,
  type RuntimeEnvironment,
  supportsExnref,
} from "../src/runtime/detector.ts";
import { createPlatformIOFor } from "../src/runtime/platform-io.ts";
import {
  getRecommendedConfig,
  isWasiAvailable,
} from "../src/runtime/unified-loader/index.ts";

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

/**
 * Exhaustive environment->backend table (taglib-2b4). The values are the
 * CONTRACT: which environments get the WASI backend, which get a
 * filesystem, what streaming/tier they advertise. detectRuntime() is just
 * the sniffer that picks the row.
 */
const ALL_ENVIRONMENTS: RuntimeEnvironment[] = [
  "deno-wasi",
  "node-wasi",
  "bun-wasi",
  "browser",
  "worker",
  "cloudflare",
  "node-emscripten",
];

const WASI_ENVIRONMENTS: RuntimeEnvironment[] = [
  "deno-wasi",
  "node-wasi",
  "bun-wasi",
];

const FILESYSTEM_ENVIRONMENTS: RuntimeEnvironment[] = [
  "deno-wasi",
  "node-wasi",
  "bun-wasi",
  "node-emscripten",
];

function profileFor(env: RuntimeEnvironment): EnvironmentProfile {
  return environmentProfile(env);
}

function resultFor(env: RuntimeEnvironment): RuntimeDetectionResult {
  return { environment: env, ...profileFor(env) };
}

describe("environmentProfile (taglib-2b4)", () => {
  it("maps every environment to a complete profile", () => {
    for (const env of ALL_ENVIRONMENTS) {
      const profile = profileFor(env);
      assertEquals(typeof profile.wasmType, "string");
      assertEquals(typeof profile.supportsFilesystem, "boolean");
      assertEquals(typeof profile.supportsStreaming, "boolean");
      assertEquals([1, 2, 3].includes(profile.performanceTier), true);
    }
  });

  it("selects the wasi binary only for the three wasi-capable environments", () => {
    for (const env of ALL_ENVIRONMENTS) {
      const expected = WASI_ENVIRONMENTS.includes(env) ? "wasi" : "emscripten";
      assertEquals(
        profileFor(env).wasmType,
        expected,
        `wrong backend for ${env}`,
      );
    }
  });

  it("grants filesystem support to wasi environments plus node-emscripten", () => {
    for (const env of ALL_ENVIRONMENTS) {
      assertEquals(
        profileFor(env).supportsFilesystem,
        FILESYSTEM_ENVIRONMENTS.includes(env),
        `wrong filesystem support for ${env}`,
      );
    }
  });

  it("marks cloudflare as the only non-streaming environment", () => {
    for (const env of ALL_ENVIRONMENTS) {
      assertEquals(
        profileFor(env).supportsStreaming,
        env !== "cloudflare",
        `wrong streaming support for ${env}`,
      );
    }
  });

  it("detectRuntime derives its result from the profile table", () => {
    const result = detectRuntime();
    assertEquals(
      result,
      resultFor(result.environment),
      "detectRuntime result must equal the profile of its detected environment",
    );
  });
});

describe("canLoadWasmType with synthetic environment (taglib-2b4)", () => {
  it("reports wasi loadable only in wasi environments", () => {
    for (const env of ALL_ENVIRONMENTS) {
      assertEquals(
        canLoadWasmType("wasi", env),
        WASI_ENVIRONMENTS.includes(env),
        `canLoadWasmType('wasi', ${env})`,
      );
    }
  });

  it("reports emscripten loadable everywhere", () => {
    for (const env of ALL_ENVIRONMENTS) {
      assertEquals(canLoadWasmType("emscripten", env), true);
    }
  });

  it("defaults to the detected environment", () => {
    assertEquals(
      canLoadWasmType("wasi"),
      canLoadWasmType("wasi", detectRuntime().environment),
    );
  });
});

describe("selection helpers with synthetic runtime (taglib-2b4)", () => {
  it("isWasiAvailable follows the wasi + filesystem predicate", () => {
    for (const env of ALL_ENVIRONMENTS) {
      assertEquals(
        isWasiAvailable(resultFor(env)),
        WASI_ENVIRONMENTS.includes(env),
        `isWasiAvailable(${env})`,
      );
    }
  });

  it("getRecommendedConfig forces emscripten in browsers", () => {
    assertEquals(getRecommendedConfig(resultFor("browser")), {
      forceWasmType: "emscripten",
      disableOptimizations: false,
    });
  });

  it("getRecommendedConfig forces wasi where wasi + filesystem hold", () => {
    for (const env of WASI_ENVIRONMENTS) {
      assertEquals(getRecommendedConfig(resultFor(env)), {
        forceWasmType: "wasi",
        disableOptimizations: false,
      });
    }
  });

  it("getRecommendedConfig never forces wasi without a wasi backend", () => {
    // node-emscripten has a filesystem but no wasi — forcing wasi there
    // would select a binary the runtime cannot load (taglib-2b4).
    for (const env of ["node-emscripten", "worker", "cloudflare"] as const) {
      assertEquals(getRecommendedConfig(resultFor(env)), {
        disableOptimizations: false,
      });
    }
  });
});

describe("createPlatformIOFor routing (taglib-2b4)", () => {
  it("provides an IO implementation for every filesystem environment", () => {
    for (const env of FILESYSTEM_ENVIRONMENTS) {
      const io = createPlatformIOFor(env);
      assertEquals(typeof io.readFile, "function", env);
      assertEquals(typeof io.writeFile, "function", env);
      assertEquals(typeof io.stat, "function", env);
    }
  });

  it("throws EnvironmentError for filesystem-less environments", () => {
    for (const env of ["browser", "worker", "cloudflare"] as const) {
      assertThrows(
        () => createPlatformIOFor(env),
        EnvironmentError,
        "does not support filesystem operations",
        env,
      );
    }
  });
});
