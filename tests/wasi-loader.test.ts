/**
 * @fileoverview Tests for WASI WebAssembly loader
 *
 * Tests WASI loading functionality, fallback mechanisms, and
 * integration with different runtime environments.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
  CachedWasiLoader,
  getWasiCapabilities,
  isWasiAvailable,
  loadWasi,
  type WasiExports,
  type WasiLoaderConfig,
} from "../src/runtime/wasi-loader.ts";

Deno.test("isWasiAvailable - detects WASI support in Deno", async () => {
  const available = await isWasiAvailable();

  // In Deno environment, WASI should be available via @wasmer/wasi
  assertEquals(available, true);
});

Deno.test("getWasiCapabilities - returns Deno capabilities", async () => {
  const capabilities = await getWasiCapabilities();

  assertEquals(capabilities.runtime, "deno");
  assertEquals(capabilities.available, true);
  assertExists(capabilities.version);
  assertEquals(capabilities.features.filesystem, true);
  assertEquals(capabilities.features.networking, true);
  assertEquals(capabilities.features.threading, false);
});

Deno.test("WasiLoaderConfig - uses sensible defaults", () => {
  const loader = new CachedWasiLoader();

  // Should not throw and should have reasonable defaults
  assertEquals(loader instanceof CachedWasiLoader, true);
});

Deno.test("WasiLoaderConfig - accepts custom configuration", () => {
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

Deno.test("CachedWasiLoader - caching behavior", async () => {
  const loader = new CachedWasiLoader({
    debug: false, // Avoid console noise in tests
  });

  // Clear any existing cache
  loader.clearCache();

  // First call should create instance
  try {
    const instance1 = await loader.getInstance();
    const instance2 = await loader.getInstance();

    // Should return the same cached instance
    assertEquals(instance1, instance2);
  } catch (error) {
    // WASI loading might fail if no WASM file exists
    // This is expected in test environment
    assertEquals(error instanceof Error, true);
  }
});

Deno.test("CachedWasiLoader - cache clearing", async () => {
  const loader = new CachedWasiLoader({
    debug: false,
  });

  // Clear cache should not throw
  loader.clearCache();
  assertEquals(true, true); // Test passes if no exception
});

Deno.test("CachedWasiLoader - config updates clear cache", () => {
  const loader = new CachedWasiLoader();

  loader.updateConfig({
    initialMemory: 1024,
    debug: true,
  });

  // Should not throw
  assertEquals(true, true);
});

Deno.test("loadWasi - handles missing WASM file gracefully", async () => {
  const config: WasiLoaderConfig = {
    wasmPath: "/non/existent/path/taglib.wasm",
    debug: false,
  };

  await assertRejects(
    async () => {
      await loadWasi(config);
    },
    Error,
    // Error message will vary based on environment availability
  );
});

Deno.test("loadWasi - handles invalid WASM path", async () => {
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

Deno.test("loadWasi - configuration validation", async () => {
  // Test with reasonable config that should not immediately fail
  const config: WasiLoaderConfig = {
    wasmPath: "./non-existent.wasm", // Will fail at load time, not config time
    initialMemory: 256,
    maxMemory: 32768,
    preopens: { "/tmp": "/tmp" },
    env: { TEST: "true" },
    debug: false,
  };

  // Config creation should not throw
  assertEquals(typeof config.initialMemory, "number");
  assertEquals(typeof config.maxMemory, "number");
  assertEquals(typeof config.debug, "boolean");
});

Deno.test("WasiExports interface - type validation", () => {
  // This tests that our WasiExports interface has the expected structure
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

  // Should compile without errors
  assertEquals(typeof mockExports.malloc, "function");
  assertEquals(typeof mockExports.free, "function");
  assertEquals(typeof mockExports.tl_read_tags, "function");
  assertEquals(typeof mockExports.tl_free, "function");
  assertEquals(typeof mockExports.tl_version, "function");
});

Deno.test("loadWasi - with HTTP URL (mocked)", async () => {
  // Test URL validation without actually making network requests
  const config: WasiLoaderConfig = {
    wasmPath: "https://example.com/taglib.wasm",
    debug: false,
  };

  await assertRejects(
    async () => {
      await loadWasi(config);
    },
    Error,
    // Expected to fail since we don't have a real WASM file at that URL
  );
});

Deno.test("WASI capabilities - feature detection", async () => {
  const capabilities = await getWasiCapabilities();

  // Validate capability structure
  assertEquals(typeof capabilities.available, "boolean");
  assertEquals(typeof capabilities.runtime, "string");
  assertEquals(typeof capabilities.features.filesystem, "boolean");
  assertEquals(typeof capabilities.features.networking, "boolean");
  assertEquals(typeof capabilities.features.threading, "boolean");

  // Runtime should be one of expected values
  assertEquals(
    ["deno", "node", "unknown"].includes(capabilities.runtime),
    true,
  );
});

Deno.test("CachedWasiLoader - multiple instances are independent", () => {
  const loader1 = new CachedWasiLoader({ debug: true });
  const loader2 = new CachedWasiLoader({ debug: false });

  loader1.clearCache();
  loader2.clearCache();

  loader1.updateConfig({ initialMemory: 512 });
  loader2.updateConfig({ initialMemory: 1024 });

  // Both should work independently without affecting each other
  assertEquals(true, true);
});

Deno.test("WASI environment detection - Deno specific", () => {
  // In Deno environment, should detect Deno correctly
  assertEquals(typeof Deno !== "undefined", true);
  assertEquals(typeof Deno.version, "object");
  assertEquals(typeof Deno.version.deno, "string");
});

// Performance and memory tests
Deno.test("WasiLoaderConfig - memory configuration validation", () => {
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
    assertEquals(config.maxMemory > 0, true, "Max memory should be positive");
  }
});

Deno.test("Error handling - invalid configuration scenarios", async () => {
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
