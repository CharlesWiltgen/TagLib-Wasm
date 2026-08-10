/**
 * @fileoverview WebAssembly module interface types for Emscripten
 */

/** Raw picture with numeric type as received from/sent to C++ boundary */
export interface RawPicture {
  mimeType: string;
  data: Uint8Array;
  type: number;
  description?: string;
}

/** Raw chapter as received from/sent across the C++ boundary. */
export interface RawChapter {
  startTimeMs: number;
  endTimeMs?: number;
  title?: string;
  id?: string;
  source?: string;
}

/**
 * Raw unsynchronized-lyrics entry as carried across the backend boundary.
 * Both backends persist `text` only: lyrics ride the text "LYRICS" PropertyMap
 * key (TagLib has no LYRICS *complex* property), so `description`/`language` are
 * kept in-memory for the current handle but are NOT written to the file and read
 * back as `""` (taglib-gq9). Full structured USLT is a possible future addition.
 */
export interface RawLyrics {
  text: string;
  description: string;
  language: string;
}

/** Raw ID3v2 frame: body bytes without the 10-byte header. @see taglib-b67 */
export interface RawId3v2Frame {
  /** 4-character frame ID, e.g. "TIT2", "TXXX", "RGAD" */
  id: string;
  /** Frame body bytes (no header) */
  data: Uint8Array;
  /** Frame header flags (v2.4 bytes 8-9), when present on read */
  flags?: number;
}

// Basic Emscripten module interface
export interface EmscriptenModule {
  // Memory
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  wasmMemory?: WebAssembly.Memory;

  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;
  _realloc?(ptr: number, newSize: number): number;
  // String conversion
  ccall?(
    ident: string,
    returnType: string,
    argTypes: string[],
    args: any[],
  ): any;
  cwrap?(
    ident: string,
    returnType: string,
    argTypes: string[],
  ): (...args: any[]) => any;

  UTF8ToString?(ptr: number): string;
  stringToUTF8?(str: string, ptr: number, maxBytes: number): number;
  lengthBytesUTF8?(str: string): number;

  addFunction?(func: any): number;
  removeFunction?(funcPtr: number): void;

  // File system (if enabled)
  FS?: any;

  // Runtime
  ready?: Promise<EmscriptenModule>;
  then?(callback: (module: EmscriptenModule) => void): void;
  onRuntimeInitialized?: () => void;
}

// Embind class interfaces
export interface FileHandle {
  loadFromBuffer(data: Uint8Array): boolean;
  loadFromPath?(path: string): boolean;
  isValid(): boolean;
  save(): boolean;
  getFormat(): string;
  getProperties(): Record<string, string[]>;
  setProperties(props: Record<string, string[]>): void;
  getProperty(key: string): string;
  setProperty(key: string, value: string): void;
  isMP4(): boolean;
  getMP4Item(key: string): string;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;
  getTagData(): import("./types/tags.ts").BasicTagData;
  setTagData(data: Partial<import("./types/tags.ts").BasicTagData>): void;
  getAudioProperties(): import("./types.ts").AudioProperties | null;
  getBuffer(): Uint8Array;
  getPictures(): RawPicture[];
  setPictures(pictures: RawPicture[]): void;
  addPicture(picture: RawPicture): void;
  removePictures(): void;
  getChapters(): RawChapter[];
  setChapters(chapters: RawChapter[], mp4ChapterStyle: string): void;
  getBextData(): Uint8Array | undefined;
  setBextData(data: Uint8Array | null): void;
  getIxml(): string | undefined;
  setIxml(data: string | null): void;
  getRatings(): { rating: number; email: string; counter: number }[];
  setRatings(
    ratings: { rating: number; email?: string; counter?: number }[],
  ): void;
  getLyrics(): RawLyrics[];
  setLyrics(lyrics: RawLyrics[]): void;
  /** Raw ID3v2 frames; id "" = all frames (MP3 only). */
  getId3v2Frames(id: string): RawId3v2Frame[];
  /** Replace ALL frames with this ID (per-ID list replace). */
  setId3v2Frames(id: string, data: Uint8Array[]): void;
  /** Remove all frames with this ID. */
  removeId3v2Frames(id: string): void;
  /**
   * WASI only: staged (unsaved) per-ID raw-frame replacements, for
   * save-reconstruct copying. Absent on Embind (writes apply immediately).
   */
  getStagedId3v2Frames?(): Record<string, Uint8Array[]> | undefined;
  hasId3Tags(): { v1: boolean; v2: boolean };
  stripId3Tags(opts: { v1: boolean; v2: boolean }): void;
  /**
   * Pending foreign-mean MP4 freeform atom removals (taglib-65nm), for
   * save-reconstruct copying. WASI carries the list in tagData; Embind applies
   * removals immediately, so its getter is undefined (nothing to copy).
   */
  getMp4ItemRemovals?(): string[] | undefined;
  setMp4ItemRemovals?(removals: string[]): void;
  destroy(): void;
}

/**
 * Branded, library-owned file handle (taglib-0te).
 *
 * Only the wrap boundaries produce this type: the WASI adapter's
 * createFileHandle and wrapEmbindHandle. A raw {@link FileHandle} (e.g. a
 * naked Embind handle) is NOT a WasmFileHandle, so it cannot be passed into
 * the AudioFile or save paths — the brand prevents mixing raw handles with
 * library-owned ones.
 */
export type WasmFileHandle = FileHandle & {
  readonly __brand: "WasmFileHandle";
};

/**
 * TagLib WebAssembly module interface.
 * Provides access to Embind classes and low-level C-style functions.
 * @internal Most users should use {@link TagLib} instead of accessing this directly.
 */
export interface TagLibModule extends Omit<EmscriptenModule, "then"> {
  /** Whether this module uses the WASI backend (vs Emscripten) */
  isWasi?: boolean;

  /** @internal Embind FileHandle class constructor */
  FileHandle: new () => FileHandle;
  /** @internal Create a new (raw) file handle for audio file operations */
  createFileHandle(): FileHandle;

  /** @internal Embind function: returns TagLib version (e.g. "2.2.1") */
  getVersion?(): string;

  /** @internal WASI adapter: returns TagLib version (e.g. "2.2.1") */
  version?(): string;
}

export interface WasmModule extends EmscriptenModule {
  // Alias for compatibility
  FileHandle?: new () => FileHandle;
  createFileHandle?(): FileHandle;
}

// Module loading function removed for modular imports
