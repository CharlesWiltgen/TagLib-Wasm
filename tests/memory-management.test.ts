import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { WasmAlloc, WasmArena } from "../src/runtime/wasi-memory.ts";
import type { WasmExports } from "../src/runtime/wasi-memory.ts";

function createMockWasmExports(): WasmExports & {
  getAllocatedPointers(): Set<number>;
} {
  const wasmMemory = new WebAssembly.Memory({ initial: 16 });
  const allocatedPointers = new Set<number>();
  let nextPointer = 1000;

  return {
    memory: wasmMemory,
    malloc: (size: number) => {
      const ptr = nextPointer;
      nextPointer += size;
      allocatedPointers.add(ptr);
      return ptr;
    },
    free: (ptr: number) => {
      allocatedPointers.delete(ptr);
    },
    getAllocatedPointers: () => allocatedPointers,
  };
}

describe("WasmAlloc RAII", () => {
  it("allocates and frees memory automatically", () => {
    const exports = createMockWasmExports();

    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    {
      using alloc = new WasmAlloc(exports, testData.length);
      alloc.write(testData);

      const result = alloc.read();
      assertEquals(result[0], 1);
      assertEquals(result[4], 5);
      assertEquals(alloc.size, testData.length);
    }
    assertEquals(exports.getAllocatedPointers().size, 0);
  });

  it("writeCString and readCString round-trip", () => {
    const exports = createMockWasmExports();

    const testString = "Hello, RAII!";
    const encoded = new TextEncoder().encode(testString);
    {
      using alloc = new WasmAlloc(exports, encoded.length + 1);
      alloc.writeCString(testString);

      const result = alloc.readCString();
      assertEquals(result, testString);
    }
    assertEquals(exports.getAllocatedPointers().size, 0);
  });

  it("handles multi-byte UTF-8 (emoji, CJK)", () => {
    const exports = createMockWasmExports();

    const testCases = [
      "\u{1F3B5} Music",
      "\u4F60\u597D\u4E16\u754C",
      "caf\u00E9",
    ];

    for (const str of testCases) {
      const encoded = new TextEncoder().encode(str);
      {
        using alloc = new WasmAlloc(exports, encoded.length + 1);
        alloc.writeCString(encoded);
        assertEquals(alloc.readCString(), str);
      }
    }
    assertEquals(exports.getAllocatedPointers().size, 0);
  });
});

describe("WasmArena RAII", () => {
  it("allocString works and frees all on scope exit", () => {
    const exports = createMockWasmExports();

    {
      using arena = new WasmArena(exports);
      const titleAlloc = arena.allocString("My Title");
      const artistAlloc = arena.allocString("My Artist");

      assertEquals(titleAlloc.readCString(), "My Title");
      assertEquals(artistAlloc.readCString(), "My Artist");
      assertEquals(exports.getAllocatedPointers().size, 2);
    }
    assertEquals(exports.getAllocatedPointers().size, 0);
  });
});
