declare module "taglib-wrapper" {
  export interface TagLibModule {
    setValue: (ptr: number, value: number | bigint, type: string) => void;
    getValue: (ptr: number, type?: string) => number;
    UTF8ToString: (ptr: number, maxBytesToRead?: number) => string;
    stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
    lengthBytesUTF8: (str: string) => number;
    ALLOC_NORMAL: number;
    allocate: (slab: Uint8Array | number[], allocator: number) => number;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAPU8: Uint8Array;
    HEAP8: Int8Array;
    HEAP16: Int16Array;
    HEAPU16: Uint16Array;
    HEAP32: Int32Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    HEAPF64: Float64Array;
    HEAP64: BigInt64Array;
    HEAPU64: BigUint64Array;
    // Add any other module properties and methods you use
    [key: string]: any;
  }

  export interface TagLibModuleOptions {
    locateFile?: (filename: string) => string;
    onRuntimeInitialized?: () => void;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
    [key: string]: any;
  }

  export default function createTagLibModule(
    options?: TagLibModuleOptions
  ): Promise<TagLibModule>;
}

// For ES module imports
declare const createTagLibModule: (
  options?: any
) => Promise<any>;

export default createTagLibModule;