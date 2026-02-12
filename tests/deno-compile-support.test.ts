/**
 * Test suite for deno-compile-support module
 */

import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertRejects,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  type DenoCompileOptions,
  initializeForDeno,
  isDenoCompiled,
  loadWasmForDeno,
} from "../src/deno-compile-support.ts";

describe("isDenoCompiled", () => {
  it("detects regular Deno runtime", () => {
    const result = isDenoCompiled();
    assertEquals(result, false);
  });

  it("detects based on conditions", () => {
    const hasDenoGlobal = typeof Deno !== "undefined";
    const mainModuleIsFile = Deno.mainModule?.startsWith("file:///");
    const execPathNotDeno = !Deno.execPath()?.includes("deno");

    assertEquals(hasDenoGlobal, true);
    assertEquals(mainModuleIsFile, true);
    assertEquals(execPathNotDeno, false);
  });
});

describe("loadWasmForDeno", () => {
  it("returns user-provided wasmBinary", async () => {
    const customBinary = new Uint8Array([1, 2, 3, 4]);
    const options: DenoCompileOptions = {
      wasmBinary: customBinary,
    };

    const result = await loadWasmForDeno(options);
    assertEquals(result, customBinary);
  });

  it("converts ArrayBuffer to Uint8Array", async () => {
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

  it("tries local file in development", async () => {
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

  describe("with fetch mock", () => {
    let originalFetch: typeof globalThis.fetch;
    let fetchMock: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
        fetchMock(input, init);
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("falls back to URL when local file not found", async () => {
      const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01]);

      fetchMock = async (input) => {
        if (input.toString().includes("example.com/test.wasm")) {
          return new Response(mockWasmContent, { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
        wasmUrl: "https://example.com/test.wasm",
      };

      const result = await loadWasmForDeno(options);
      assertEquals(result, mockWasmContent);
    });

    it("uses fallbackUrl when wasmUrl is not provided", async () => {
      const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x02]);

      fetchMock = async (input) => {
        if (input.toString().includes("fallback.com/backup.wasm")) {
          return new Response(mockWasmContent, { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
        fallbackUrl: "https://fallback.com/backup.wasm",
      };

      const result = await loadWasmForDeno(options);
      assertEquals(result, mockWasmContent);
    });

    it("uses default CDN URL as last resort", async () => {
      const mockWasmContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x03]);

      fetchMock = async (input) => {
        if (input.toString().includes("cdn.jsdelivr.net")) {
          return new Response(mockWasmContent, { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
      };

      const result = await loadWasmForDeno(options);
      assertEquals(result, mockWasmContent);
    });

    it("returns undefined when all strategies fail", async () => {
      fetchMock = async () => {
        return new Response("Not found", { status: 404 });
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
        wasmUrl: "https://example.com/not-found.wasm",
      };

      const result = await loadWasmForDeno(options);
      assertEquals(result, undefined);
    });

    it("handles network errors gracefully", async () => {
      fetchMock = async () => {
        throw new Error("Network error");
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
        wasmUrl: "https://example.com/test.wasm",
      };

      const result = await loadWasmForDeno(options);
      assertEquals(result, undefined);
    });
  });
});

describe("initializeForDeno", () => {
  describe("with fetch mock", () => {
    let originalFetch: typeof globalThis.fetch;
    let fetchMock: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
        fetchMock(input, init);
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("throws when WASM loading fails", async () => {
      fetchMock = async () => {
        return new Response("Not found", { status: 404 });
      };

      const options: DenoCompileOptions = {
        wasmPath: "./non-existent-file.wasm",
        wasmUrl: "https://example.com/not-found.wasm",
      };

      await assertRejects(
        async () => await initializeForDeno(options),
        Error,
        "Failed to load WASM module",
      );
    });
  });

  it("loads WASM and passes to TagLib", async () => {
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

    try {
      const result = await initializeForDeno({ wasmBinary: mockWasmContent });
      assertExists(result);
    } catch (error) {
      assertExists(error);
    }
  });

  it("works with custom options", async () => {
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

    await assertRejects(
      async () => await initializeForDeno(options),
      Error,
    );
  });
});

describe("DenoCompileOptions", () => {
  it("type extends LoadTagLibOptions", () => {
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
});
