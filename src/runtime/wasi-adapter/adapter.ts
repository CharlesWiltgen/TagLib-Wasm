/**
 * @fileoverview WASI to TagLibModule adapter
 *
 * Adapts a WASI module interface to the TagLibModule interface,
 * providing Emscripten-compatible memory access and string operations.
 */

import type { FileHandle, TagLibModule } from "../../wasm.ts";
import type { WasiModule } from "../wasmer-sdk-loader/index.ts";
import { WasmerExecutionError } from "../wasmer-sdk-loader/index.ts";
import { WasiFileHandle } from "./file-handle.ts";

export class WasiToTagLibAdapter implements TagLibModule {
  private readonly wasi: WasiModule;
  private readonly heap: Uint8Array;

  constructor(wasiModule: WasiModule) {
    this.wasi = wasiModule;
    this.heap = new Uint8Array(wasiModule.memory.buffer);
  }

  FileHandle = class {
    constructor() {
      throw new WasmerExecutionError(
        "Use createFileHandle() instead of new FileHandle()",
      );
    }
  } as unknown as new () => FileHandle;

  TagWrapper = class {
    constructor() {
      throw new WasmerExecutionError("TagWrapper not directly constructable");
    }
  } as unknown as new () => import("../../wasm.ts").TagWrapper;

  AudioPropertiesWrapper = class {
    constructor() {
      throw new WasmerExecutionError(
        "AudioPropertiesWrapper not directly constructable",
      );
    }
  } as unknown as new () => import("../../wasm.ts").AudioPropertiesWrapper;

  get ready(): Promise<this> {
    return Promise.resolve(this);
  }

  get HEAP8(): Int8Array {
    return new Int8Array(this.wasi.memory.buffer);
  }

  get HEAP16(): Int16Array {
    return new Int16Array(this.wasi.memory.buffer);
  }

  get HEAPU8(): Uint8Array {
    return new Uint8Array(this.wasi.memory.buffer);
  }

  get HEAP32(): Int32Array {
    return new Int32Array(this.wasi.memory.buffer);
  }

  get HEAPU16(): Uint16Array {
    return new Uint16Array(this.wasi.memory.buffer);
  }

  get HEAPU32(): Uint32Array {
    return new Uint32Array(this.wasi.memory.buffer);
  }

  get HEAPF32(): Float32Array {
    return new Float32Array(this.wasi.memory.buffer);
  }

  get HEAPF64(): Float64Array {
    return new Float64Array(this.wasi.memory.buffer);
  }

  _malloc(size: number): number {
    return this.wasi.malloc(size);
  }

  _free(ptr: number): void {
    this.wasi.free(ptr);
  }

  _realloc(ptr: number, newSize: number): number {
    const newPtr = this.wasi.malloc(newSize);
    if (newPtr && ptr) {
      const oldData = this.heap.slice(ptr, ptr + newSize);
      this.heap.set(oldData, newPtr);
      this.wasi.free(ptr);
    }
    return newPtr;
  }

  UTF8ToString(ptr: number): string {
    if (!ptr) return "";
    let end = ptr;
    while (this.heap[end] !== 0) end++;
    return new TextDecoder().decode(this.heap.slice(ptr, end));
  }

  stringToUTF8(str: string, ptr: number, maxBytes: number): number {
    const bytes = new TextEncoder().encode(str);
    const len = Math.min(bytes.length, maxBytes - 1);
    this.heap.set(bytes.slice(0, len), ptr);
    this.heap[ptr + len] = 0;
    return len;
  }

  lengthBytesUTF8(str: string): number {
    return new TextEncoder().encode(str).length;
  }

  createFileHandle(): FileHandle {
    return new WasiFileHandle(this.wasi);
  }

  version(): string {
    return this.wasi.tl_version();
  }

  addFunction(_func: any): number {
    throw new WasmerExecutionError(
      "addFunction not supported in WASI mode",
    );
  }

  removeFunction(_ptr: number): void {
    throw new WasmerExecutionError(
      "removeFunction not supported in WASI mode",
    );
  }

  cwrap(
    _name: string,
    _returnType: string | null,
    _argTypes: string[],
  ): any {
    throw new WasmerExecutionError(
      "cwrap not supported in WASI mode - use direct exports",
    );
  }

  ccall(
    _name: string,
    _returnType: string | null,
    _argTypes: string[],
    _args: any[],
  ): any {
    throw new WasmerExecutionError(
      "ccall not supported in WASI mode - use direct exports",
    );
  }
}
