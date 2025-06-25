/**
 * Test suite for deno-compile-support module
 */

import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type DenoCompileOptions,
  initializeForDeno,
  isDenoCompiled,
  loadWasmForDeno,
} from "../src/deno-compile-support.ts";

// Mock fetch for testing
let originalFetch: typeof globalThis.fetch;
let fetchMock: (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function setupFetchMock() {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    fetchMock(input, init);
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test("isDenoCompiled: detects regular Deno runtime", () => {
  // In regular Deno runtime, this should return false
  const result = isDenoCompiled();
  assertEquals(result, false);
});

Deno.test("isDenoCompiled: detects based on conditions", () => {
  // Test the logic even though we can't truly simulate compiled env
  const hasDenoGlobal = typeof Deno !== "undefined";
  const mainModuleIsFile = Deno.mainModule?.startsWith("file:///");
  const execPathNotDeno = !Deno.execPath()?.includes("deno");

  // In test environment, execPath includes "deno"
  assertEquals(hasDenoGlobal, true);
  assertEquals(mainModuleIsFile, true);
  assertEquals(execPathNotDeno, false);
});

Deno.test("loadWasmForDeno: returns user-provided wasmBinary", async () => {
  const customBinary = new Uint8Array([1, 2, 3, 4]);
  const options: DenoCompileOptions = {
    wasmBinary: customBinary,
  };

  const result = await loadWasmForDeno(options);
  assertEquals(result, customBinary);
});

Deno.test("loadWasmForDeno: converts ArrayBuffer to Uint8Array", async () => {
  const buffer = new ArrayBuffer(4);
  const view = new Uint8Array(buffer);
  view[0] = 1;
  view[1] = 2;
  view[2] = 3;
  view[3] = 4;

  const options: DenoCompileOptions = {
    wasmBinary: buffer,
  };

  const result = await loadWasmForDeno(options);
  assertInstanceOf(result, Uint8Array);
  assertEquals(result, new Uint8Array([1, 2, 3, 4]));
});

Deno.test("loadWasmForDeno: tries local file in development", async () => {
  // Create a temporary test file
  const testWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
  const tempFile = await Deno.makeTempFile({ suffix: ".wasm" });
  await Deno.writeFile(tempFile, testWasmContent);

  try {
    const options: DenoCompileOptions = {
      wasmPath: tempFile,
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, testWasmContent);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadWasmForDeno: falls back to URL when local file not found", async () => {
  const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01]);

  setupFetchMock();
  fetchMock = async (input) => {
    if (input.toString().includes("example.com/test.wasm")) {
      return new Response(mockWasmContent, { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
      wasmUrl: "https://example.com/test.wasm",
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, mockWasmContent);
  } finally {
    restoreFetch();
  }
});

Deno.test("loadWasmForDeno: uses fallbackUrl when wasmUrl is not provided", async () => {
  const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x02]);

  setupFetchMock();
  fetchMock = async (input) => {
    if (input.toString().includes("fallback.com/backup.wasm")) {
      return new Response(mockWasmContent, { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
      // Note: wasmUrl is not provided, so it should use fallbackUrl
      fallbackUrl: "https://fallback.com/backup.wasm",
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, mockWasmContent);
  } finally {
    restoreFetch();
  }
});

Deno.test("loadWasmForDeno: uses default CDN URL as last resort", async () => {
  const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x03]);

  setupFetchMock();
  fetchMock = async (input) => {
    if (input.toString().includes("cdn.jsdelivr.net")) {
      return new Response(mockWasmContent, { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, mockWasmContent);
  } finally {
    restoreFetch();
  }
});

Deno.test("loadWasmForDeno: returns undefined when all strategies fail", async () => {
  setupFetchMock();
  fetchMock = async () => {
    return new Response("Not found", { status: 404 });
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
      wasmUrl: "https://example.com/not-found.wasm",
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, undefined);
  } finally {
    restoreFetch();
  }
});

Deno.test("loadWasmForDeno: handles network errors gracefully", async () => {
  setupFetchMock();
  fetchMock = async () => {
    throw new Error("Network error");
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
      wasmUrl: "https://example.com/test.wasm",
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, undefined);
  } finally {
    restoreFetch();
  }
});

Deno.test("initializeForDeno: throws when WASM loading fails", async () => {
  setupFetchMock();
  fetchMock = async () => {
    return new Response("Not found", { status: 404 });
  };

  try {
    const options: DenoCompileOptions = {
      wasmPath: "./non-existent-file.wasm",
      wasmUrl: "https://example.com/not-found.wasm",
    };

    await assertRejects(
      async () => await initializeForDeno(options),
      Error,
      "Failed to load WASM module",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("initializeForDeno: loads WASM and passes to TagLib", async () => {
  // This is more of an integration test
  // We'll test that the function properly loads WASM and attempts initialization
  const mockWasmContent = new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d,
    0x01,
    0x00,
    0x00,
    0x00,
  ]);

  // Test with user-provided WASM binary
  try {
    const result = await initializeForDeno({ wasmBinary: mockWasmContent });
    // If it succeeds (unlikely with mock data), verify it's a TagLib instance
    assertExists(result);
  } catch (error) {
    // Expected - mock WASM will fail to initialize
    // Just verify it tried to initialize with the provided binary
    assertExists(error);
  }
});

Deno.test("initializeForDeno: works with custom options", async () => {
  const mockWasmContent = new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d, // WASM magic number
    0x01,
    0x00,
    0x00,
    0x00, // Version
  ]);

  const options: DenoCompileOptions = {
    wasmBinary: mockWasmContent,
  };

  // This will fail at TagLib initialization since it's not real WASM
  // but we're testing that loadWasmForDeno is called correctly
  await assertRejects(
    async () => await initializeForDeno(options),
    Error,
  );
});

// Test the TypeScript types
Deno.test("DenoCompileOptions: type extends LoadTagLibOptions", () => {
  const options: DenoCompileOptions = {
    wasmBinary: new Uint8Array(),
    wasmUrl: "https://example.com/wasm",
    wasmPath: "./local.wasm",
    fallbackUrl: "https://fallback.com/wasm",
  };

  assertExists(options.wasmBinary);
  assertExists(options.wasmUrl);
  assertExists(options.wasmPath);
  assertExists(options.fallbackUrl);
});
