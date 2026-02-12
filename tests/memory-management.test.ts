import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { emscriptenToWasmExports, jsToCString } from "../src/wasm-workers.ts";
import { WasmAlloc, WasmArena } from "../src/runtime/wasi-memory.ts";
import type { TagLibModule } from "../src/wasm.ts";

// Extended module type for testing
interface TestTagLibModule extends TagLibModule {
  getAllocatedPointers(): Set<number>;
}

// Mock module for testing (plain ArrayBuffer heap)
function createMockModule(): TestTagLibModule {
  const allocatedPointers = new Set<number>();
  let nextPointer = 1000;
  const heapSize = 1024 * 1024; // 1MB heap
  const heap = new Uint8Array(heapSize);

  const mockModule: Partial<TestTagLibModule> = {
    HEAPU8: heap,
    _malloc: (size: number) => {
      const ptr = nextPointer;
      nextPointer += size;
      allocatedPointers.add(ptr);
      return ptr;
    },
    _free: (ptr: number) => {
      allocatedPointers.delete(ptr);
    },
    getAllocatedPointers: () => allocatedPointers,
  };

  return mockModule as TestTagLibModule;
}

// Mock module with real WebAssembly.Memory (for RAII adapter tests)
function createMockModuleWithMemory(): TestTagLibModule {
  const wasmMemory = new WebAssembly.Memory({ initial: 16 }); // 1MB
  const allocatedPointers = new Set<number>();
  let nextPointer = 1000;

  const mockModule: Partial<TestTagLibModule> = {
    HEAPU8: new Uint8Array(wasmMemory.buffer),
    wasmMemory,
    _malloc: (size: number) => {
      const ptr = nextPointer;
      nextPointer += size;
      allocatedPointers.add(ptr);
      return ptr;
    },
    _free: (ptr: number) => {
      allocatedPointers.delete(ptr);
    },
    getAllocatedPointers: () => allocatedPointers,
  };

  return mockModule as TestTagLibModule;
}

describe("jsToCString", () => {
  it("allocates memory correctly", () => {
    const mockModule = createMockModule();

    const initialAllocations = mockModule.getAllocatedPointers().size;

    const ptr = jsToCString(mockModule, "Test String");

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations + 1,
      "jsToCString should allocate memory",
    );

    assertEquals(typeof ptr, "number");
    assertEquals(ptr > 0, true);

    mockModule._free(ptr);

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations,
      "Memory should be freed after _free call",
    );
  });

  it("frees memory on HEAPU8.set error", () => {
    const mockModule = createMockModule();

    mockModule.HEAPU8.set = () => {
      throw new Error("Simulated HEAPU8.set error");
    };

    const initialAllocations = mockModule.getAllocatedPointers().size;

    assertThrows(
      () => jsToCString(mockModule, "Test"),
      Error,
      "Simulated HEAPU8.set error",
    );

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations,
      "Memory leak detected: jsToCString did not free memory after HEAPU8.set error",
    );
  });

  it("works with allocate function", () => {
    const mockModule = createMockModule();

    mockModule.allocate = (bytes: Uint8Array, allocType: number) => {
      const ptr = mockModule._malloc(bytes.length);
      mockModule.HEAPU8.set(bytes, ptr);
      return ptr;
    };
    mockModule.ALLOC_NORMAL = 0;

    const initialAllocations = mockModule.getAllocatedPointers().size;

    const ptr = jsToCString(mockModule, "Test String");

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations + 1,
      "jsToCString should allocate memory via allocate()",
    );

    mockModule._free(ptr);

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations,
      "Memory should be freed after _free call",
    );
  });

  it("handles multiple allocations and frees", () => {
    const mockModule = createMockModule();

    const initialAllocations = mockModule.getAllocatedPointers().size;
    const pointers: number[] = [];

    for (let i = 0; i < 10; i++) {
      const ptr = jsToCString(mockModule, `Test String ${i}`);
      pointers.push(ptr);
    }

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations + 10,
      "All strings should be allocated",
    );

    for (const ptr of pointers) {
      mockModule._free(ptr);
    }

    assertEquals(
      mockModule.getAllocatedPointers().size,
      initialAllocations,
      "All memory should be freed",
    );
  });

  it("verifies null terminator", () => {
    const mockModule = createMockModule();

    const testString = "Hello";
    const ptr = jsToCString(mockModule, testString);

    const encoder = new TextEncoder();
    const expectedBytes = encoder.encode(testString + "\0");

    const actualBytes = new Uint8Array(expectedBytes.length);
    for (let i = 0; i < expectedBytes.length; i++) {
      actualBytes[i] = mockModule.HEAPU8[ptr + i];
    }

    assertEquals(
      actualBytes[actualBytes.length - 1],
      0,
      "String should be null-terminated",
    );

    mockModule._free(ptr);
  });
});

describe("emscriptenToWasmExports", () => {
  it("uses wasmMemory when present", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    assertEquals(exports.memory, mockModule.wasmMemory);
    assertEquals(typeof exports.malloc, "function");
    assertEquals(typeof exports.free, "function");
  });

  it("falls back to HEAPU8.buffer when wasmMemory absent", () => {
    const mockModule = createMockModule();
    const exports = emscriptenToWasmExports(mockModule);

    assertEquals(exports.memory.buffer, mockModule.HEAPU8.buffer);
  });

  it("malloc/free delegate to module", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    const ptr = exports.malloc(64);
    assertEquals(mockModule.getAllocatedPointers().has(ptr), true);

    exports.free(ptr);
    assertEquals(mockModule.getAllocatedPointers().has(ptr), false);
  });
});

describe("RAII through Emscripten adapter", () => {
  it("WasmAlloc works through emscripten adapter", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    {
      using alloc = new WasmAlloc(exports, testData.length);
      alloc.write(testData);

      const result = alloc.read();
      assertEquals(result[0], 1);
      assertEquals(result[4], 5);
      assertEquals(alloc.size, testData.length);
    }
    assertEquals(mockModule.getAllocatedPointers().size, 0);
  });

  it("WasmAlloc.writeCString works through emscripten adapter", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    const testString = "Hello, Workers!";
    const encoded = new TextEncoder().encode(testString);
    {
      using alloc = new WasmAlloc(exports, encoded.length + 1);
      alloc.writeCString(testString);

      const result = alloc.readCString();
      assertEquals(result, testString);
    }
    assertEquals(mockModule.getAllocatedPointers().size, 0);
  });

  it("WasmArena.allocString works through emscripten adapter", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    {
      using arena = new WasmArena(exports);
      const titleAlloc = arena.allocString("My Title");
      const artistAlloc = arena.allocString("My Artist");

      assertEquals(titleAlloc.readCString(), "My Title");
      assertEquals(artistAlloc.readCString(), "My Artist");
      assertEquals(mockModule.getAllocatedPointers().size, 2);
    }
    assertEquals(mockModule.getAllocatedPointers().size, 0);
  });

  it("WasmAlloc.writeCString handles multi-byte UTF-8 (emoji, CJK)", () => {
    const mockModule = createMockModuleWithMemory();
    const exports = emscriptenToWasmExports(mockModule);

    const testCases = [
      "\u{1F3B5} Music", // emoji: 4-byte codepoint + ASCII
      "\u4F60\u597D\u4E16\u754C", // CJK: 你好世界 (3 bytes each)
      "caf\u00E9", // Latin-1: 2-byte codepoint
    ];

    for (const str of testCases) {
      const encoded = new TextEncoder().encode(str);
      {
        using alloc = new WasmAlloc(exports, encoded.length + 1);
        alloc.writeCString(encoded);
        assertEquals(alloc.readCString(), str);
      }
    }
    assertEquals(mockModule.getAllocatedPointers().size, 0);
  });
});

describe("setStringTag", () => {
  it("skips when tagPtr is 0", async () => {
    const mockModule = createMockModuleWithMemory();
    let setterCalled = false;

    mockModule._taglib_file_tag = () => 0;
    mockModule._taglib_file_audioproperties = () => 0;
    mockModule._taglib_tag_set_title = () => {
      setterCalled = true;
    };

    const { AudioFileWorkers } = await import("../src/workers.ts");
    const file = new AudioFileWorkers(mockModule, 1);
    file.setTitle("test");

    assertEquals(setterCalled, false);
    assertEquals(mockModule.getAllocatedPointers().size, 0);
    file.dispose();
  });

  it("handles undefined setter gracefully", async () => {
    const mockModule = createMockModuleWithMemory();

    mockModule._taglib_file_tag = () => 42;
    mockModule._taglib_file_audioproperties = () => 0;

    const { AudioFileWorkers } = await import("../src/workers.ts");
    const file = new AudioFileWorkers(mockModule, 1);

    file.setTitle("test");
    assertEquals(mockModule.getAllocatedPointers().size, 0);
    file.dispose();
  });

  it("correctly writes multi-byte strings", async () => {
    const mockModule = createMockModuleWithMemory();
    let writtenPtr = 0;

    mockModule._taglib_file_tag = () => 42;
    mockModule._taglib_file_audioproperties = () => 0;
    mockModule._taglib_tag_set_title = (_tagPtr: number, strPtr: number) => {
      writtenPtr = strPtr;
    };

    const { AudioFileWorkers } = await import("../src/workers.ts");
    const file = new AudioFileWorkers(mockModule, 1);

    const emoji = "\u{1F3B5} Music";
    file.setTitle(emoji);

    const memory = mockModule.wasmMemory!;
    const u8 = new Uint8Array(memory.buffer);
    let end = writtenPtr;
    while (u8[end] !== 0) end++;
    const written = new TextDecoder().decode(u8.subarray(writtenPtr, end));
    assertEquals(written, emoji);

    assertEquals(mockModule.getAllocatedPointers().size, 0);
    file.dispose();
  });
});
