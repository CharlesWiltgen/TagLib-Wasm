/**
 * @fileoverview RAII Memory Management for WASI
 *
 * Implements proper RAII pattern using Symbol.dispose and `using` statements.
 * Each allocation has single responsibility with automatic cleanup.
 */

import { MemoryError } from "../errors/classes.ts";
import { TagLibError } from "../errors/base.ts";

/**
 * Minimal memory interface: only `.buffer` is used (never `.grow()`).
 * Accepts both real WebAssembly.Memory and plain buffer-only shims.
 */
export type WasmMemoryLike = { readonly buffer: ArrayBufferLike };

/**
 * WASM exports interface matching our C API
 */
export interface WasmExports {
  memory: WasmMemoryLike;
  malloc(size: number): number;
  free(ptr: number): void;
}

/**
 * Re-usable heap views (must be refreshed after any memory growth!)
 */
export const heapViews = (mem: WasmMemoryLike) => ({
  u8: new Uint8Array(mem.buffer),
  i8: new Int8Array(mem.buffer),
  u16: new Uint16Array(mem.buffer),
  i16: new Int16Array(mem.buffer),
  u32: new Uint32Array(mem.buffer),
  dv: new DataView(mem.buffer),
});

/**
 * Single allocation = single responsibility, auto-free
 * Implements proper RAII with Symbol.dispose
 */
export class WasmAlloc {
  readonly #wasm: WasmExports;
  #ptr: number;
  readonly #size: number;

  constructor(wasm: WasmExports, size: number) {
    this.#wasm = wasm;
    this.#ptr = wasm.malloc(size);
    if (this.#ptr === 0) {
      throw new MemoryError(
        `malloc returned null. Requested size: ${size} bytes`,
      );
    }
    this.#size = size;
  }

  get ptr(): number {
    return this.#ptr;
  }
  get size(): number {
    return this.#size;
  }

  /**
   * Write bytes to allocation
   */
  write(bytes: Uint8Array, offset = 0): void {
    if (offset + bytes.length > this.#size) {
      throw new MemoryError(
        `Write exceeds allocation bounds. Offset: ${offset}, size: ${bytes.byteLength}, allocated: ${this.#size}`,
      );
    }
    const { u8 } = heapViews(this.#wasm.memory);
    u8.set(bytes, this.#ptr + offset);
  }

  /**
   * Read bytes from allocation (zero-copy view)
   */
  read(len = this.#size, offset = 0): Uint8Array {
    if (offset + len > this.#size) {
      throw new MemoryError(
        `Read exceeds allocation bounds. Offset: ${offset}, size: ${len}, allocated: ${this.#size}`,
      );
    }
    const { u8 } = heapViews(this.#wasm.memory);
    return u8.subarray(this.#ptr + offset, this.#ptr + offset + len);
  }

  /**
   * Write C string with null terminator.
   * Accepts a string or pre-encoded UTF-8 bytes (avoids double-encoding).
   */
  writeCString(input: string | Uint8Array): void {
    const bytes = typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;
    if (bytes.length >= this.#size) {
      throw new MemoryError(
        `String too long for allocation. String: ${bytes.byteLength} bytes, allocated: ${this.#size}`,
      );
    }
    const { u8 } = heapViews(this.#wasm.memory);
    u8.set(bytes, this.#ptr);
    u8[this.#ptr + bytes.length] = 0; // Null terminator
  }

  /**
   * Read C string (null-terminated)
   */
  readCString(): string {
    const { u8 } = heapViews(this.#wasm.memory);
    let end = this.#ptr;
    while (end < this.#ptr + this.#size && u8[end] !== 0) {
      end++;
    }
    return new TextDecoder().decode(u8.subarray(this.#ptr, end));
  }

  /**
   * Write 32-bit integer (little-endian)
   */
  writeUint32(value: number, offset = 0): void {
    if (offset + 4 > this.#size) {
      throw new MemoryError(
        `Write exceeds allocation bounds. Offset: ${offset}, size: 4, allocated: ${this.#size}`,
      );
    }
    const { dv } = heapViews(this.#wasm.memory);
    dv.setUint32(this.#ptr + offset, value, true);
  }

  /**
   * Read 32-bit integer (little-endian)
   */
  readUint32(offset = 0): number {
    if (offset + 4 > this.#size) {
      throw new MemoryError(
        `Read exceeds allocation bounds. Offset: ${offset}, size: 4, allocated: ${this.#size}`,
      );
    }
    const { dv } = heapViews(this.#wasm.memory);
    return dv.getUint32(this.#ptr + offset, true);
  }

  /**
   * Automatic cleanup via Symbol.dispose
   */
  [Symbol.dispose](): void {
    if (this.#ptr !== 0) {
      this.#wasm.free(this.#ptr);
      this.#ptr = 0;
    }
  }
}

/**
 * Optional arena to collect many allocations & free them together
 * Useful for operations that need multiple related allocations
 */
export class WasmArena {
  readonly #wasm: WasmExports;
  readonly #allocs: WasmAlloc[] = [];

  constructor(wasm: WasmExports) {
    this.#wasm = wasm;
  }

  /**
   * Allocate memory within this arena
   */
  alloc(size: number): WasmAlloc {
    const allocation = new WasmAlloc(this.#wasm, size);
    this.#allocs.push(allocation);
    return allocation;
  }

  /**
   * Allocate and write string (encodes once)
   */
  allocString(str: string): WasmAlloc {
    const bytes = new TextEncoder().encode(str);
    const allocation = this.alloc(bytes.length + 1);
    allocation.writeCString(bytes);
    return allocation;
  }

  /**
   * Allocate and write buffer
   */
  allocBuffer(buffer: Uint8Array): WasmAlloc {
    const allocation = this.alloc(buffer.length);
    allocation.write(buffer);
    return allocation;
  }

  /**
   * Allocate 32-bit integer
   */
  allocUint32(value = 0): WasmAlloc {
    const allocation = this.alloc(4);
    allocation.writeUint32(value);
    return allocation;
  }

  /**
   * Automatic cleanup of all allocations
   */
  [Symbol.dispose](): void {
    for (const alloc of this.#allocs) {
      alloc[Symbol.dispose]();
    }
    this.#allocs.length = 0;
  }
}

/**
 * Helper for common memory operations with proper error context
 */
export class WasmMemoryError extends TagLibError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly errorCode?: number,
  ) {
    super(
      "WASM_MEMORY",
      `${operation}: ${message}${
        errorCode !== undefined ? ` (code ${errorCode})` : ""
      }`,
    );
    this.name = "WasmMemoryError";
    Object.setPrototypeOf(this, WasmMemoryError.prototype);
  }
}

/**
 * Refresh heap views after potential memory growth
 * Call this if you suspect the WASM module grew its memory
 */
export function refreshHeapViews(
  wasm: WasmExports,
  currentViews: ReturnType<typeof heapViews>,
): ReturnType<typeof heapViews> {
  // Check if buffer changed (memory growth)
  if (currentViews.u8.buffer !== wasm.memory.buffer) {
    return heapViews(wasm.memory);
  }
  return currentViews;
}
