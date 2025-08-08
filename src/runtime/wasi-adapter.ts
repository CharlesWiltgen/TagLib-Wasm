/**
 * @fileoverview WASI to TagLibModule adapter
 *
 * Handles the complex task of adapting WASI module interface to
 * TagLibModule interface. Each method is kept simple and focused.
 */

import type { FileHandle, TagLibModule } from "../wasm.ts";
import type { WasiModule } from "./wasmer-sdk-loader.ts";
import {
  type readTagsWithWasi,
  WasmerExecutionError,
} from "./wasmer-sdk-loader.ts";
import { WasmArena, type WasmExports, WasmMemoryError } from "./wasi-memory.ts";
import { decodeTagData } from "../msgpack/decoder.ts";
import { encodeTagData } from "../msgpack/encoder.ts";
import type { ExtendedTag } from "../types.ts";

/**
 * Adapter class to make WASI module compatible with TagLibModule interface
 */
export class WasiToTagLibAdapter implements TagLibModule {
  private readonly wasi: WasiModule;
  private readonly heap: Uint8Array;

  constructor(wasiModule: WasiModule) {
    this.wasi = wasiModule;
    this.heap = new Uint8Array(wasiModule.memory.buffer);
  }

  // Emscripten compatibility properties
  get ready(): Promise<void> {
    return Promise.resolve();
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

  get HEAPU32(): Uint32Array {
    return new Uint32Array(this.wasi.memory.buffer);
  }

  // Memory management
  _malloc(size: number): number {
    return this.wasi.malloc(size);
  }

  _free(ptr: number): void {
    this.wasi.free(ptr);
  }

  _realloc(ptr: number, newSize: number): number {
    // Simple realloc implementation
    const newPtr = this.wasi.malloc(newSize);
    if (newPtr && ptr) {
      // Copy old data to new location
      const oldData = this.heap.slice(ptr, ptr + newSize);
      this.heap.set(oldData, newPtr);
      this.wasi.free(ptr);
    }
    return newPtr;
  }

  // String operations
  UTF8ToString(ptr: number): string {
    if (!ptr) return "";
    let end = ptr;
    while (this.heap[end] !== 0) end++;
    return new TextDecoder().decode(this.heap.slice(ptr, end));
  }

  stringToUTF8(str: string, ptr: number, maxBytes: number): void {
    const bytes = new TextEncoder().encode(str);
    const len = Math.min(bytes.length, maxBytes - 1);
    this.heap.set(bytes.slice(0, len), ptr);
    this.heap[ptr + len] = 0; // Null terminator
  }

  lengthBytesUTF8(str: string): number {
    return new TextEncoder().encode(str).length;
  }

  // File handle creation
  createFileHandle(): FileHandle {
    return new WasiFileHandle(this.wasi, this.heap);
  }

  // Version info
  version(): string {
    return this.wasi.tl_version();
  }

  // Stubs for Emscripten-specific features not in WASI
  addFunction(func: any): number {
    throw new WasmerExecutionError(
      "addFunction not supported in WASI mode",
    );
  }

  removeFunction(ptr: number): void {
    throw new WasmerExecutionError(
      "removeFunction not supported in WASI mode",
    );
  }

  cwrap(name: string, returnType: string | null, argTypes: string[]): any {
    throw new WasmerExecutionError(
      "cwrap not supported in WASI mode - use direct exports",
    );
  }

  ccall(
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: any[],
  ): any {
    throw new WasmerExecutionError(
      "ccall not supported in WASI mode - use direct exports",
    );
  }
}

/**
 * WASI-based FileHandle implementation
 */
class WasiFileHandle implements FileHandle {
  private wasi: WasiModule;
  private heap: Uint8Array;
  private fileData: Uint8Array | null = null;
  private tagData: ExtendedTag | null = null;
  private destroyed = false;

  constructor(wasiModule: WasiModule, heap: Uint8Array) {
    this.wasi = wasiModule;
    this.heap = heap;
  }

  private checkNotDestroyed(): void {
    if (this.destroyed) {
      throw new WasmerExecutionError(
        "FileHandle has been destroyed",
      );
    }
  }

  loadFromBuffer(buffer: Uint8Array): boolean {
    this.checkNotDestroyed();

    try {
      this.fileData = buffer;

      // Use WASI to read tags via MessagePack
      // Note: This is synchronous for now, real implementation would need async
      const msgpackData = this.readTagsSync(buffer);
      this.tagData = decodeTagData(msgpackData);

      return true;
    } catch (error) {
      console.error("Failed to load from buffer:", error);
      return false;
    }
  }

  private readTagsSync(buffer: Uint8Array): Uint8Array {
    using arena = new WasmArena(this.wasi as WasmExports);

    const inputBuf = arena.allocBuffer(buffer);
    const outSizePtr = arena.allocUint32();

    // Get required output size
    const sizeResult = this.wasi.tl_read_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      outSizePtr.ptr,
    );
    if (sizeResult !== 0) {
      const errorCode = this.wasi.tl_get_last_error_code();
      throw new WasmMemoryError(
        `error code ${errorCode}`,
        "read tags size",
        errorCode,
      );
    }

    // Allocate output buffer and read data
    const outputSize = outSizePtr.readUint32();
    const outputBuf = arena.alloc(outputSize);

    const readResult = this.wasi.tl_read_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      outputBuf.ptr,
    );
    if (readResult !== 0) {
      throw new WasmMemoryError(
        "failed to read data into buffer",
        "read tags data",
        readResult,
      );
    }

    return new Uint8Array(outputBuf.read().slice());
  }

  loadFromPath(path: string): boolean {
    this.checkNotDestroyed();
    throw new WasmerExecutionError(
      "loadFromPath not implemented for WASI - use loadFromBuffer",
    );
  }

  isValid(): boolean {
    this.checkNotDestroyed();
    return this.fileData !== null && this.fileData.length > 0;
  }

  save(): boolean {
    this.checkNotDestroyed();

    if (!this.fileData || !this.tagData) {
      return false;
    }

    try {
      return this.performSave();
    } catch (error) {
      console.error("Failed to save:", error);
      return false;
    }
  }

  private performSave(): boolean {
    using arena = new WasmArena(this.wasi as WasmExports);

    // Encode and allocate buffers
    const tagBytes = encodeTagData(this.tagData!);
    const inputBuf = arena.allocBuffer(this.fileData!);
    const tagBuf = arena.allocBuffer(tagBytes);
    const outSizePtr = arena.allocUint32();

    // Get required output size
    const sizeResult = this.wasi.tl_write_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      tagBuf.ptr,
      tagBuf.size,
      0,
      outSizePtr.ptr,
    );

    if (sizeResult !== 0) {
      return false;
    }

    // Allocate output buffer and write
    const outputSize = outSizePtr.readUint32();
    const outputBuf = arena.alloc(outputSize);

    const writeResult = this.wasi.tl_write_tags(
      0,
      inputBuf.ptr,
      inputBuf.size,
      tagBuf.ptr,
      tagBuf.size,
      outputBuf.ptr,
      outSizePtr.ptr,
    );

    if (writeResult === 0) {
      // Update file data with modified version
      this.fileData = new Uint8Array(outputBuf.read().slice());
      return true;
    }

    return false;
  }

  getTag(): any {
    this.checkNotDestroyed();

    if (!this.tagData) {
      // Return empty tag object
      return this.createEmptyTag();
    }

    // Return tag wrapper with methods
    return this.createTagWrapper(this.tagData);
  }

  private createEmptyTag(): any {
    return this.createTagWrapper({});
  }

  private createTagWrapper(data: Partial<ExtendedTag>): any {
    return {
      title: () => data.title || "",
      artist: () => data.artist || "",
      album: () => data.album || "",
      comment: () => data.comment || "",
      genre: () => data.genre || "",
      year: () => data.year || 0,
      track: () => data.track || 0,

      setTitle: (value: string) => {
        this.tagData = { ...this.tagData, title: value };
      },
      setArtist: (value: string) => {
        this.tagData = { ...this.tagData, artist: value };
      },
      setAlbum: (value: string) => {
        this.tagData = { ...this.tagData, album: value };
      },
      setComment: (value: string) => {
        this.tagData = { ...this.tagData, comment: value };
      },
      setGenre: (value: string) => {
        this.tagData = { ...this.tagData, genre: value };
      },
      setYear: (value: number) => {
        this.tagData = { ...this.tagData, year: value };
      },
      setTrack: (value: number) => {
        this.tagData = { ...this.tagData, track: value };
      },
    };
  }

  getAudioProperties(): any {
    this.checkNotDestroyed();

    // Return mock properties for now
    // Real implementation would parse from WASI
    return {
      length: () => 0,
      lengthInSeconds: () => 0,
      lengthInMilliseconds: () => 0,
      bitrate: () => 0,
      sampleRate: () => 0,
      channels: () => 0,
    };
  }

  getFormat(): string {
    this.checkNotDestroyed();

    if (!this.fileData) return "Unknown";

    // Simple format detection based on magic bytes
    const magic = this.fileData.slice(0, 4);
    if (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) return "MP3";
    if (
      magic[0] === 0x66 && magic[1] === 0x4C && magic[2] === 0x61 &&
      magic[3] === 0x43
    ) return "FLAC";
    if (
      magic[0] === 0x4F && magic[1] === 0x67 && magic[2] === 0x67 &&
      magic[3] === 0x53
    ) return "OGG";

    return "Unknown";
  }

  getBuffer(): Uint8Array | null {
    this.checkNotDestroyed();
    return this.fileData;
  }

  destroy(): void {
    this.fileData = null;
    this.tagData = null;
    this.destroyed = true;
  }
}
