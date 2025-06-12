/**
 * WebAssembly module interface for Embind version
 */
export interface WasmModule {
  // Memory access
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  // Runtime methods
  allocate: (size: number, type: number) => number;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  getValue: (ptr: number, type: string) => number;
  setValue: (ptr: number, value: number, type: string) => void;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
  lengthBytesUTF8: (str: string) => number;

  // Allocation types
  ALLOC_NORMAL: number;
  ALLOC_STACK: number;

  // Embind classes (these will be available after module loads)
  FileHandle: any;
  TagWrapper: any;
  AudioPropertiesWrapper: any;
  createFileHandle: () => any;
}

/**
 * Extended module interface with our Embind classes
 */
export interface TagLibModule extends WasmModule {
  // These are the actual class constructors from Embind
  FileHandle: {
    new(): any;
  };
  
  TagWrapper: {
    new(tagPtr: number): any;
  };
  
  AudioPropertiesWrapper: {
    new(propsPtr: number): any;
  };
  
  // Factory function
  createFileHandle: () => any;
}