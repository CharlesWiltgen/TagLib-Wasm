/* eslint-disable sonarjs/no-empty-test-file */
// NOSONAR: This file contains Deno tests which SonarQube doesn't recognize

import { assertEquals, assertThrows } from "@std/assert";
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

Deno.test("Memory Management - jsToCString allocates memory correctly", () => {
  const mockModule = createMockModule();

  const initialAllocations = mockModule.getAllocatedPointers().size;

  // Allocate a string
  const ptr = jsToCString(mockModule, "Test String");

  // Check that memory was allocated
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations + 1,
    "jsToCString should allocate memory",
  );

  // Check that the pointer is valid
  assertEquals(typeof ptr, "number");
  assertEquals(ptr > 0, true);

  // Clean up
  mockModule._free(ptr);

  // Check that memory was freed
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations,
    "Memory should be freed after _free call",
  );
});

Deno.test("Memory Management - jsToCString frees memory on HEAPU8.set error", () => {
  const mockModule = createMockModule();

  // Make HEAPU8.set throw an error
  mockModule.HEAPU8.set = () => {
    throw new Error("Simulated HEAPU8.set error");
  };

  const initialAllocations = mockModule.getAllocatedPointers().size;

  // This should throw but still free memory
  assertThrows(
    () => jsToCString(mockModule, "Test"),
    Error,
    "Simulated HEAPU8.set error",
  );

  // Check that memory was freed
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations,
    "Memory leak detected: jsToCString did not free memory after HEAPU8.set error",
  );
});

Deno.test("Memory Management - jsToCString with allocate function", () => {
  const mockModule = createMockModule();

  // Add allocate function
  mockModule.allocate = (bytes: Uint8Array, allocType: number) => {
    const ptr = mockModule._malloc(bytes.length);
    mockModule.HEAPU8.set(bytes, ptr);
    return ptr;
  };
  mockModule.ALLOC_NORMAL = 0;

  const initialAllocations = mockModule.getAllocatedPointers().size;

  // Allocate a string using allocate path
  const ptr = jsToCString(mockModule, "Test String");

  // Check that memory was allocated
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations + 1,
    "jsToCString should allocate memory via allocate()",
  );

  // Clean up
  mockModule._free(ptr);

  // Check that memory was freed
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations,
    "Memory should be freed after _free call",
  );
});

Deno.test("Memory Management - Multiple allocations and frees", () => {
  const mockModule = createMockModule();

  const initialAllocations = mockModule.getAllocatedPointers().size;
  const pointers: number[] = [];

  // Allocate multiple strings
  for (let i = 0; i < 10; i++) {
    const ptr = jsToCString(mockModule, `Test String ${i}`);
    pointers.push(ptr);
  }

  // Check that all were allocated
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations + 10,
    "All strings should be allocated",
  );

  // Free all pointers
  for (const ptr of pointers) {
    mockModule._free(ptr);
  }

  // Check that all were freed
  assertEquals(
    mockModule.getAllocatedPointers().size,
    initialAllocations,
    "All memory should be freed",
  );
});

Deno.test("Memory Management - Verify null terminator in jsToCString", () => {
  const mockModule = createMockModule();

  const testString = "Hello";
  const ptr = jsToCString(mockModule, testString);

  // Check that the string is properly null-terminated
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(testString + "\0");

  // Read the bytes from the heap
  const actualBytes = new Uint8Array(expectedBytes.length);
  for (let i = 0; i < expectedBytes.length; i++) {
    actualBytes[i] = mockModule.HEAPU8[ptr + i];
  }

  // Verify the last byte is null terminator
  assertEquals(
    actualBytes[actualBytes.length - 1],
    0,
    "String should be null-terminated",
  );

  // Clean up
  mockModule._free(ptr);
});

// --- Adapter tests ---

Deno.test("emscriptenToWasmExports - uses wasmMemory when present", () => {
  const mockModule = createMockModuleWithMemory();
  const exports = emscriptenToWasmExports(mockModule);

  assertEquals(exports.memory, mockModule.wasmMemory);
  assertEquals(typeof exports.malloc, "function");
  assertEquals(typeof exports.free, "function");
});

Deno.test("emscriptenToWasmExports - falls back to HEAPU8.buffer when wasmMemory absent", () => {
  const mockModule = createMockModule(); // no wasmMemory
  const exports = emscriptenToWasmExports(mockModule);

  assertEquals(exports.memory.buffer, mockModule.HEAPU8.buffer);
});

Deno.test("emscriptenToWasmExports - malloc/free delegate to module", () => {
  const mockModule = createMockModuleWithMemory();
  const exports = emscriptenToWasmExports(mockModule);

  const ptr = exports.malloc(64);
  assertEquals(mockModule.getAllocatedPointers().has(ptr), true);

  exports.free(ptr);
  assertEquals(mockModule.getAllocatedPointers().has(ptr), false);
});

Deno.test("WasmAlloc works through emscripten adapter", () => {
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
  // After scope exit, allocation should be freed
  assertEquals(mockModule.getAllocatedPointers().size, 0);
});

Deno.test("WasmAlloc.writeCString works through emscripten adapter", () => {
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

Deno.test("WasmArena.allocString works through emscripten adapter", () => {
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

Deno.test("WasmAlloc.writeCString handles multi-byte UTF-8 (emoji, CJK)", () => {
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

// --- setStringTag behavior tests ---

Deno.test("setStringTag skips when tagPtr is 0", async () => {
  const mockModule = createMockModuleWithMemory();
  let setterCalled = false;

  // Simulate AudioFileWorkers with tagPtr=0 (no tag available)
  mockModule._taglib_file_tag = () => 0;
  mockModule._taglib_file_audioproperties = () => 0;
  mockModule._taglib_tag_set_title = () => {
    setterCalled = true;
  };

  // Import the class dynamically isn't practical, so test the pattern directly
  const { AudioFileWorkers } = await importWorkersModule();
  const file = new AudioFileWorkers(mockModule, 1);
  file.setTitle("test");

  assertEquals(setterCalled, false);
  assertEquals(mockModule.getAllocatedPointers().size, 0);
  file.dispose();
});

Deno.test("setStringTag handles undefined setter gracefully", async () => {
  const mockModule = createMockModuleWithMemory();

  // Module with tag pointer but WITHOUT set_title export
  mockModule._taglib_file_tag = () => 42;
  mockModule._taglib_file_audioproperties = () => 0;
  // _taglib_tag_set_title intentionally NOT set (undefined)

  const { AudioFileWorkers } = await importWorkersModule();
  const file = new AudioFileWorkers(mockModule, 1);

  // Should not throw, and should clean up the allocation
  file.setTitle("test");
  assertEquals(mockModule.getAllocatedPointers().size, 0);
  file.dispose();
});

Deno.test("setStringTag correctly writes multi-byte strings", async () => {
  const mockModule = createMockModuleWithMemory();
  let writtenPtr = 0;

  mockModule._taglib_file_tag = () => 42;
  mockModule._taglib_file_audioproperties = () => 0;
  mockModule._taglib_tag_set_title = (_tagPtr: number, strPtr: number) => {
    writtenPtr = strPtr;
  };

  const { AudioFileWorkers } = await importWorkersModule();
  const file = new AudioFileWorkers(mockModule, 1);

  const emoji = "\u{1F3B5} Music";
  file.setTitle(emoji);

  // Verify the string was written correctly to Wasm memory
  const memory = mockModule.wasmMemory!;
  const u8 = new Uint8Array(memory.buffer);
  let end = writtenPtr;
  while (u8[end] !== 0) end++;
  const written = new TextDecoder().decode(u8.subarray(writtenPtr, end));
  assertEquals(written, emoji);

  // Allocation freed after setter returned
  assertEquals(mockModule.getAllocatedPointers().size, 0);
  file.dispose();
});

async function importWorkersModule() {
  return await import("../src/workers.ts");
}
