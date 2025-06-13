/**
 * @fileoverview WebAssembly module interface types for Emscripten
 */

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
  
  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;
  allocate?(data: number[] | Uint8Array, allocator: number): number;
  ALLOC_NORMAL?: number;
  
  // String conversion
  ccall?(ident: string, returnType: string, argTypes: string[], args: any[]): any;
  cwrap?(ident: string, returnType: string, argTypes: string[]): (...args: any[]) => any;
  
  // File system (if enabled)
  FS?: any;
  
  // Runtime
  then?(callback: (module: EmscriptenModule) => void): void;
  onRuntimeInitialized?: () => void;
}

// Embind class interfaces
export interface FileHandle {
  loadFromBuffer(data: Uint8Array): boolean;
  isValid(): boolean;
  save(): boolean;
  getFormat(): string;
  getProperties(): any;
  setProperties(props: any): void;
  getProperty(key: string): string;
  setProperty(key: string, value: string): void;
  isMP4(): boolean;
  getMP4Item(key: string): string;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;
  getTag(): TagWrapper;
  getAudioProperties(): AudioPropertiesWrapper;
}

export interface TagWrapper {
  title(): string;
  artist(): string;
  album(): string;
  comment(): string;
  genre(): string;
  year(): number;
  track(): number;
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setComment(value: string): void;
  setGenre(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
}

export interface AudioPropertiesWrapper {
  lengthInSeconds(): number;
  lengthInMilliseconds(): number;
  bitrate(): number;
  sampleRate(): number;
  channels(): number;
}

export interface TagLibModule extends EmscriptenModule {
  // Embind classes
  FileHandle: new () => FileHandle;
  TagWrapper: new () => TagWrapper;
  AudioPropertiesWrapper: new () => AudioPropertiesWrapper;
  
  // Embind functions
  createFileHandle(): FileHandle;
}

export interface WasmModule extends EmscriptenModule {
  // Alias for compatibility
  FileHandle?: new () => FileHandle;
  createFileHandle?(): FileHandle;
}

// Module loading function removed for modular imports