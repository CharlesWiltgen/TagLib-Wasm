/**
 * @fileoverview RAII Memory Management Tests
 *
 * Tests the RAII pattern implementation for WASM memory management.
 * Verifies automatic cleanup, error handling, and memory leak prevention.
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { MemoryError } from "../src/errors/classes.ts";
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

describe("WasmAlloc", () => {
  it("automatic cleanup on disposal", () => {
    const wasm = new MockWasmExports();
    assertEquals(wasm.getAllocatedCount(), 0);

    {
      using alloc = new WasmAlloc(wasm, 100);
      assertEquals(wasm.getAllocatedCount(), 1);
      assert(wasm.isAllocated(alloc.ptr));
    }

    assertEquals(wasm.getAllocatedCount(), 0);
  });

  it("cleanup on exception", () => {
    const wasm = new MockWasmExports();

    assertThrows(() => {
      using _alloc = new WasmAlloc(wasm, 100);
      assertEquals(wasm.getAllocatedCount(), 1);
      throw new Error("Test exception");
    });

    assertEquals(wasm.getAllocatedCount(), 0);
  });

  it("read/write operations", () => {
    const wasm = new MockWasmExports();
    using alloc = new WasmAlloc(wasm, 100);

    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    alloc.write(testData);

    const readData = alloc.read(testData.length);
    assertEquals(readData, testData);
  });

  it("C string operations", () => {
    const wasm = new MockWasmExports();
    using alloc = new WasmAlloc(wasm, 100);

    const testString = "Hello, World! 🌍";
    alloc.writeCString(testString);

    const readString = alloc.readCString();
    assertEquals(readString, testString);
  });

  it("bounds checking", () => {
    const wasm = new MockWasmExports();
    using alloc = new WasmAlloc(wasm, 10);

    const largeData = new Uint8Array(20);

    assertThrows(
      () => {
        alloc.write(largeData);
      },
      MemoryError,
      "Write exceeds allocation bounds",
    );

    assertThrows(
      () => {
        alloc.read(20);
      },
      MemoryError,
      "Read exceeds allocation bounds",
    );
  });

  it("integer operations", () => {
    const wasm = new MockWasmExports();
    using alloc = new WasmAlloc(wasm, 8);

    alloc.writeUint32(0x12345678);
    assertEquals(alloc.readUint32(), 0x12345678);

    alloc.writeUint32(0x87654321, 4);
    assertEquals(alloc.readUint32(4), 0x87654321);
  });
});

describe("WasmArena", () => {
  it("bulk allocation and cleanup", () => {
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

    assertEquals(wasm.getAllocatedCount(), 0);
  });

  it("convenience allocation methods", () => {
    const wasm = new MockWasmExports();

    using arena = new WasmArena(wasm);

    const strAlloc = arena.allocString("test");
    assertEquals(strAlloc.readCString(), "test");

    const buffer = new Uint8Array([1, 2, 3, 4]);
    const bufAlloc = arena.allocBuffer(buffer);
    assertEquals(bufAlloc.read(), buffer);

    const intAlloc = arena.allocUint32(42);
    assertEquals(intAlloc.readUint32(), 42);

    assertEquals(wasm.getAllocatedCount(), 3);
  });

  it("cleanup on exception with multiple allocations", () => {
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
});

describe("heapViews", () => {
  it("creates typed heap views", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const views = heapViews(memory);

    assert(views.u8 instanceof Uint8Array);
    assert(views.i8 instanceof Int8Array);
    assert(views.u16 instanceof Uint16Array);
    assert(views.i16 instanceof Int16Array);
    assert(views.u32 instanceof Uint32Array);
    assert(views.dv instanceof DataView);

    assertEquals(views.u8.buffer, memory.buffer);
    assertEquals(views.dv.buffer, memory.buffer);
  });

  it("views reflect memory changes", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const views = heapViews(memory);

    views.u8[100] = 42;
    assertEquals(views.i8[100], 42);

    views.dv.setUint32(200, 0x12345678, true);
    assertEquals(views.u32[50], 0x12345678); // 200/4 = 50
  });
});

describe("RAII Error Scenarios", () => {
  it("allocation failure handling", () => {
    const wasm: WasmExports = {
      memory: new WebAssembly.Memory({ initial: 1 }),
      malloc: () => 0, // Always fail
      free: () => {},
    };

    assertThrows(
      () => {
        new WasmAlloc(wasm, 100);
      },
      MemoryError,
      "malloc returned null",
    );
  });

  it("double disposal protection", () => {
    const wasm = new MockWasmExports();
    using alloc = new WasmAlloc(wasm, 100);

    assertEquals(wasm.getAllocatedCount(), 1);
    alloc[Symbol.dispose]();
    assertEquals(wasm.getAllocatedCount(), 0);

    alloc[Symbol.dispose]();
    assertEquals(wasm.getAllocatedCount(), 0);
  });
});

describe("RAII Integration", () => {
  it("nested scopes with early returns", () => {
    const wasm = new MockWasmExports();

    function processData(shouldFail: boolean): number {
      using arena = new WasmArena(wasm);

      arena.alloc(100);
      arena.alloc(200);

      assertEquals(wasm.getAllocatedCount(), 2);

      if (shouldFail) {
        return -1;
      }

      const buf3 = arena.alloc(300);
      assertEquals(wasm.getAllocatedCount(), 3);

      return buf3.size;
    }

    assertEquals(processData(true), -1);
    assertEquals(wasm.getAllocatedCount(), 0);

    assertEquals(processData(false), 300);
    assertEquals(wasm.getAllocatedCount(), 0);
  });

  it("composition of RAII objects", () => {
    const wasm = new MockWasmExports();

    function complexOperation(): Uint8Array {
      using arena1 = new WasmArena(wasm);
      using arena2 = new WasmArena(wasm);

      const input = arena1.allocBuffer(new Uint8Array([1, 2, 3, 4]));
      const output = arena2.alloc(input.size * 2);

      const inputData = input.read();
      const processedData = new Uint8Array(inputData.length * 2);
      processedData.set(inputData, 0);
      processedData.set(inputData, inputData.length);

      output.write(processedData);

      assertEquals(wasm.getAllocatedCount(), 2);
      return new Uint8Array(output.read().slice());
    }

    const result = complexOperation();
    assertEquals(result, new Uint8Array([1, 2, 3, 4, 1, 2, 3, 4]));
    assertEquals(wasm.getAllocatedCount(), 0);
  });
});
