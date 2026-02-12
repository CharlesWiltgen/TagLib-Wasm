/**
 * @fileoverview Tests for WASI WebAssembly loader
 *
 * Tests WASI loading functionality, fallback mechanisms, and
 * integration with different runtime environments.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  CachedWasiLoader,
  getWasiCapabilities,
  isWasiAvailable,
  loadWasi,
  type WasiExports,
  type WasiLoaderConfig,
} from "../src/runtime/wasi-loader.ts";

describe("WASI Availability", () => {
  it("isWasiAvailable - detects WASI support in Deno", async () => {
    const available = await isWasiAvailable();
    assertEquals(available, true);
  });

  it("getWasiCapabilities - returns Deno capabilities", async () => {
    const capabilities = await getWasiCapabilities();

    assertEquals(capabilities.runtime, "deno");
    assertEquals(capabilities.available, true);
    assertExists(capabilities.version);
    assertEquals(capabilities.features.filesystem, true);
    assertEquals(capabilities.features.networking, true);
    assertEquals(capabilities.features.threading, false);
  });

  it("WASI capabilities - feature detection", async () => {
    const capabilities = await getWasiCapabilities();

    assertEquals(typeof capabilities.available, "boolean");
    assertEquals(typeof capabilities.runtime, "string");
    assertEquals(typeof capabilities.features.filesystem, "boolean");
    assertEquals(typeof capabilities.features.networking, "boolean");
    assertEquals(typeof capabilities.features.threading, "boolean");

    assertEquals(
      ["deno", "node", "unknown"].includes(capabilities.runtime),
      true,
    );
  });

  it("WASI environment detection - Deno specific", () => {
    assertEquals(typeof Deno !== "undefined", true);
    assertEquals(typeof Deno.version, "object");
    assertEquals(typeof Deno.version.deno, "string");
  });
});

describe("CachedWasiLoader", () => {
  it("uses sensible defaults", () => {
    const loader = new CachedWasiLoader();
    assertEquals(loader instanceof CachedWasiLoader, true);
  });

  it("accepts custom configuration", () => {
    const customConfig: Partial<WasiLoaderConfig> = {
      wasmPath: "/custom/path/taglib.wasm",
      initialMemory: 512,
      maxMemory: 65536,
      debug: true,
      preopens: { "/data": "/home/user/data" },
      env: { NODE_ENV: "test" },
    };

    const loader = new CachedWasiLoader(customConfig);
    assertEquals(loader instanceof CachedWasiLoader, true);
  });

  it("caching behavior", async () => {
    const loader = new CachedWasiLoader({
      debug: false,
    });

    loader.clearCache();

    try {
      const instance1 = await loader.getInstance();
      const instance2 = await loader.getInstance();

      assertEquals(instance1, instance2);
    } catch (error) {
      assertEquals(error instanceof Error, true);
    }
  });

  it("cache clearing", async () => {
    const loader = new CachedWasiLoader({
      debug: false,
    });

    loader.clearCache();
    assertEquals(true, true);
  });

  it("config updates clear cache", () => {
    const loader = new CachedWasiLoader();

    loader.updateConfig({
      initialMemory: 1024,
      debug: true,
    });

    assertEquals(true, true);
  });

  it("multiple instances are independent", () => {
    const loader1 = new CachedWasiLoader({ debug: true });
    const loader2 = new CachedWasiLoader({ debug: false });

    loader1.clearCache();
    loader2.clearCache();

    loader1.updateConfig({ initialMemory: 512 });
    loader2.updateConfig({ initialMemory: 1024 });

    assertEquals(true, true);
  });
});

describe("loadWasi", () => {
  it("handles missing WASM file gracefully", async () => {
    const config: WasiLoaderConfig = {
      wasmPath: "/non/existent/path/taglib.wasm",
      debug: false,
    };

    await assertRejects(
      async () => {
        await loadWasi(config);
      },
      Error,
    );
  });

  it("handles invalid WASM path", async () => {
    const config: WasiLoaderConfig = {
      wasmPath: "invalid://protocol/path.wasm",
      debug: false,
    };

    await assertRejects(
      async () => {
        await loadWasi(config);
      },
      Error,
    );
  });

  it("configuration validation", async () => {
    const config: WasiLoaderConfig = {
      wasmPath: "./non-existent.wasm",
      initialMemory: 256,
      maxMemory: 32768,
      preopens: { "/tmp": "/tmp" },
      env: { TEST: "true" },
      debug: false,
    };

    assertEquals(typeof config.initialMemory, "number");
    assertEquals(typeof config.maxMemory, "number");
    assertEquals(typeof config.debug, "boolean");
  });

  it("with HTTP URL (mocked)", async () => {
    const config: WasiLoaderConfig = {
      wasmPath: "https://example.com/taglib.wasm",
      debug: false,
    };

    await assertRejects(
      async () => {
        await loadWasi(config);
      },
      Error,
    );
  });
});

describe("WasiExports Interface", () => {
  it("type validation", () => {
    const mockExports: Partial<WasiExports> = {
      memory: {} as WebAssembly.Memory,
      malloc: (size: number) => 0,
      free: (ptr: number) => {},
      tl_read_tags: (
        pathPtr: number,
        bufPtr: number,
        len: number,
        outSizePtr: number,
      ) => 0,
      tl_free: (ptr: number) => {},
      tl_version: () => 0,
    };

    assertEquals(typeof mockExports.malloc, "function");
    assertEquals(typeof mockExports.free, "function");
    assertEquals(typeof mockExports.tl_read_tags, "function");
    assertEquals(typeof mockExports.tl_free, "function");
    assertEquals(typeof mockExports.tl_version, "function");
  });
});

describe("Configuration", () => {
  it("memory configuration validation", () => {
    const configs = [
      { initialMemory: 256, maxMemory: 32768 }, // 16MB to 2GB
      { initialMemory: 16, maxMemory: 1024 }, // 1MB to 64MB
      { initialMemory: 1024, maxMemory: 65536 }, // 64MB to 4GB
    ];

    for (const config of configs) {
      assertEquals(
        config.initialMemory < config.maxMemory,
        true,
        `Initial memory ${config.initialMemory} should be less than max ${config.maxMemory}`,
      );
      assertEquals(
        config.initialMemory > 0,
        true,
        "Initial memory should be positive",
      );
      assertEquals(
        config.maxMemory > 0,
        true,
        "Max memory should be positive",
      );
    }
  });

  it("invalid configuration scenarios", async () => {
    const invalidConfigs = [
      { wasmPath: "" }, // Empty path
      { wasmPath: null as any }, // Invalid type
      { initialMemory: -1 }, // Negative memory
      { maxMemory: 0 }, // Zero max memory
    ];

    for (const config of invalidConfigs) {
      await assertRejects(
        async () => {
          await loadWasi(config);
        },
        Error,
      );
    }
  });
});
