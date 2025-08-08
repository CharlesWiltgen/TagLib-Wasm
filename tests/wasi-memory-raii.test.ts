/**
 * @fileoverview RAII Memory Management Tests
 *
 * Tests the RAII pattern implementation for WASM memory management.
 * Verifies automatic cleanup, error handling, and memory leak prevention.
 */

import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  heapViews,
  WasmAlloc,
  WasmArena,
  type WasmExports,
} from "../src/runtime/wasi-memory.ts";

// Mock WASM exports for testing
class MockWasmExports implements WasmExports {
  private allocatedPointers = new Set<number>();
  private nextPtr = 1000;
  private _memory = new WebAssembly.Memory({ initial: 1 });

  get memory(): WebAssembly.Memory {
    return this._memory;
  }

  malloc(size: number): number {
    if (size <= 0) return 0;

    const ptr = this.nextPtr;
    this.nextPtr += size;
    this.allocatedPointers.add(ptr);
    return ptr;
  }

  free(ptr: number): void {
    this.allocatedPointers.delete(ptr);
  }

  getAllocatedCount(): number {
    return this.allocatedPointers.size;
  }

  isAllocated(ptr: number): boolean {
    return this.allocatedPointers.has(ptr);
  }
}

Deno.test("RAII WasmAlloc: automatic cleanup on disposal", () => {
  const wasm = new MockWasmExports();
  assertEquals(wasm.getAllocatedCount(), 0);

  {
    using alloc = new WasmAlloc(wasm, 100);
    assertEquals(wasm.getAllocatedCount(), 1);
    assert(wasm.isAllocated(alloc.ptr));
  }

  // Should be automatically freed
  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII WasmAlloc: cleanup on exception", () => {
  const wasm = new MockWasmExports();

  assertThrows(() => {
    using _alloc = new WasmAlloc(wasm, 100);
    assertEquals(wasm.getAllocatedCount(), 1);
    throw new Error("Test exception");
  });

  // Should still be cleaned up despite exception
  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII WasmAlloc: read/write operations", () => {
  const wasm = new MockWasmExports();
  using alloc = new WasmAlloc(wasm, 100);

  const testData = new Uint8Array([1, 2, 3, 4, 5]);
  alloc.write(testData);

  const readData = alloc.read(testData.length);
  assertEquals(readData, testData);
});

Deno.test("RAII WasmAlloc: C string operations", () => {
  const wasm = new MockWasmExports();
  using alloc = new WasmAlloc(wasm, 100);

  const testString = "Hello, World! 🌍";
  alloc.writeCString(testString);

  const readString = alloc.readCString();
  assertEquals(readString, testString);
});

Deno.test("RAII WasmAlloc: bounds checking", () => {
  const wasm = new MockWasmExports();
  using alloc = new WasmAlloc(wasm, 10);

  const largeData = new Uint8Array(20);

  assertThrows(
    () => {
      alloc.write(largeData);
    },
    Error,
    "Write would exceed allocation bounds",
  );

  assertThrows(
    () => {
      alloc.read(20);
    },
    Error,
    "Read would exceed allocation bounds",
  );
});

Deno.test("RAII WasmAlloc: integer operations", () => {
  const wasm = new MockWasmExports();
  using alloc = new WasmAlloc(wasm, 8);

  alloc.writeUint32(0x12345678);
  assertEquals(alloc.readUint32(), 0x12345678);

  alloc.writeUint32(0x87654321, 4);
  assertEquals(alloc.readUint32(4), 0x87654321);
});

Deno.test("RAII WasmArena: bulk allocation and cleanup", () => {
  const wasm = new MockWasmExports();
  assertEquals(wasm.getAllocatedCount(), 0);

  {
    using arena = new WasmArena(wasm);

    const alloc1 = arena.alloc(100);
    const alloc2 = arena.alloc(200);
    const alloc3 = arena.alloc(50);

    assertEquals(wasm.getAllocatedCount(), 3);
    assert(wasm.isAllocated(alloc1.ptr));
    assert(wasm.isAllocated(alloc2.ptr));
    assert(wasm.isAllocated(alloc3.ptr));
  }

  // All should be cleaned up
  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII WasmArena: convenience allocation methods", () => {
  const wasm = new MockWasmExports();

  using arena = new WasmArena(wasm);

  // String allocation
  const strAlloc = arena.allocString("test");
  assertEquals(strAlloc.readCString(), "test");

  // Buffer allocation
  const buffer = new Uint8Array([1, 2, 3, 4]);
  const bufAlloc = arena.allocBuffer(buffer);
  assertEquals(bufAlloc.read(), buffer);

  // Integer allocation
  const intAlloc = arena.allocUint32(42);
  assertEquals(intAlloc.readUint32(), 42);

  assertEquals(wasm.getAllocatedCount(), 3);
});

Deno.test("RAII WasmArena: cleanup on exception with multiple allocations", () => {
  const wasm = new MockWasmExports();

  assertThrows(() => {
    using arena = new WasmArena(wasm);
    arena.alloc(100);
    arena.alloc(200);
    arena.alloc(300);
    assertEquals(wasm.getAllocatedCount(), 3);
    throw new Error("Test exception");
  });

  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII Memory Views: heap views creation", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const views = heapViews(memory);

  assert(views.u8 instanceof Uint8Array);
  assert(views.i8 instanceof Int8Array);
  assert(views.u16 instanceof Uint16Array);
  assert(views.i16 instanceof Int16Array);
  assert(views.u32 instanceof Uint32Array);
  assert(views.dv instanceof DataView);

  // All should share the same buffer
  assertEquals(views.u8.buffer, memory.buffer);
  assertEquals(views.dv.buffer, memory.buffer);
});

Deno.test("RAII Memory Views: views reflect memory changes", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const views = heapViews(memory);

  views.u8[100] = 42;
  assertEquals(views.i8[100], 42);

  views.dv.setUint32(200, 0x12345678, true);
  assertEquals(views.u32[50], 0x12345678); // 200/4 = 50
});

Deno.test("RAII Error Scenarios: allocation failure handling", () => {
  const wasm: WasmExports = {
    memory: new WebAssembly.Memory({ initial: 1 }),
    malloc: () => 0, // Always fail
    free: () => {},
  };

  assertThrows(
    () => {
      new WasmAlloc(wasm, 100);
    },
    Error,
    "malloc(100) failed",
  );
});

Deno.test("RAII Error Scenarios: double disposal protection", () => {
  const wasm = new MockWasmExports();
  using alloc = new WasmAlloc(wasm, 100);

  assertEquals(wasm.getAllocatedCount(), 1);
  alloc[Symbol.dispose]();
  assertEquals(wasm.getAllocatedCount(), 0);

  // Second disposal should be safe (no-op)
  alloc[Symbol.dispose]();
  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII Integration: nested scopes with early returns", () => {
  const wasm = new MockWasmExports();

  function processData(shouldFail: boolean): number {
    using arena = new WasmArena(wasm);

    arena.alloc(100);
    arena.alloc(200);

    assertEquals(wasm.getAllocatedCount(), 2);

    if (shouldFail) {
      return -1; // Early return should still trigger cleanup
    }

    const buf3 = arena.alloc(300);
    assertEquals(wasm.getAllocatedCount(), 3);

    return buf3.size;
  }

  // Test early return path
  assertEquals(processData(true), -1);
  assertEquals(wasm.getAllocatedCount(), 0);

  // Test normal path
  assertEquals(processData(false), 300);
  assertEquals(wasm.getAllocatedCount(), 0);
});

Deno.test("RAII Integration: composition of RAII objects", () => {
  const wasm = new MockWasmExports();

  function complexOperation(): Uint8Array {
    using arena1 = new WasmArena(wasm);
    using arena2 = new WasmArena(wasm);

    const input = arena1.allocBuffer(new Uint8Array([1, 2, 3, 4]));
    const output = arena2.alloc(input.size * 2);

    // Simulate some processing
    const inputData = input.read();
    const processedData = new Uint8Array(inputData.length * 2);
    processedData.set(inputData, 0);
    processedData.set(inputData, inputData.length);

    output.write(processedData);

    assertEquals(wasm.getAllocatedCount(), 2);
    return new Uint8Array(output.read().slice()); // Copy before cleanup
  }

  const result = complexOperation();
  assertEquals(result, new Uint8Array([1, 2, 3, 4, 1, 2, 3, 4]));
  assertEquals(wasm.getAllocatedCount(), 0); // All cleaned up
});
