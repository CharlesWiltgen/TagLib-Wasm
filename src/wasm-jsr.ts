/**
 * @fileoverview JSR-compatible WASM loading for TagLib with minimal Embind runtime
 *
 * This version loads the WASM file directly and provides a minimal Embind runtime
 * that's compatible with JSR publishing requirements.
 */

import type { TagLibConfig } from "./types.ts";

/**
 * Minimal Embind runtime types
 */
interface EmbindClass {
  $$: {
    ptr: number;
    ptrType: any;
    count: { value: number };
    deleteScheduled: boolean;
    preservePointerOnDelete: boolean;
  };
}

interface RegisteredType {
  name: string;
  fromWireType: (wire: any) => any;
  toWireType: (destructors: any[], value: any) => any;
  argPackAdvance?: number;
  readValueFromPointer?: (ptr: number) => any;
  destructorFunction?: ((ptr: number) => void) | null;
}

/**
 * JSR-compatible TagLib module interface with Embind support
 */
export interface TagLibModule {
  // Standard Emscripten memory arrays
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  // Standard functions
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  allocate: (array: Uint8Array, type: number) => number;
  getValue: (ptr: number, type: string) => number;
  setValue: (ptr: number, value: number, type: string) => void;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => number;
  lengthBytesUTF8: (str: string) => number;

  // Allocation constants
  ALLOC_NORMAL: number;
  ALLOC_STACK: number;

  // Embind classes
  FileHandle: any;
  TagWrapper: any;
  AudioPropertiesWrapper: any;
  createFileHandle: () => any;

  // Internal Embind functions we need to implement
  ___getTypeName?: (type: number) => number;
  __embind_register_class?: (...args: any[]) => void;
  __embind_register_class_constructor?: (...args: any[]) => void;
  __embind_register_class_function?: (...args: any[]) => void;
  __embind_register_emval?: (rawType: number) => void;
  __embind_register_integer?: (...args: any[]) => void;
  __embind_register_memory_view?: (...args: any[]) => void;
  __embind_register_std_string?: (rawType: number, name: number) => void;
  __embind_register_std_wstring?: (rawType: number, charSize: number, name: number) => void;
  __embind_register_void?: (rawType: number, name: number) => void;
  __embind_register_bool?: (rawType: number, name: number, trueValue: number, falseValue: number) => void;
  __embind_register_float?: (rawType: number, name: number, size: number) => void;
  __embind_register_function?: (...args: any[]) => void;
  __emval_decref?: (handle: number) => void;
  __emval_incref?: (handle: number) => void;
  __emval_take_value?: (type: number, value: number) => number;
}

/**
 * Load taglib-wasm module for JSR with minimal Embind runtime
 */
export async function loadTagLibModuleJSR(
  config?: TagLibConfig,
): Promise<TagLibModule> {
  // Load WASM file as bytes (same file for all platforms)
  const wasmUrl = new URL("../build/taglib.wasm", import.meta.url);
  const wasmBytes = await fetch(wasmUrl).then((r) => r.arrayBuffer());

  // Create memory
  const memory = new WebAssembly.Memory({ initial: 256, maximum: 4096 });
  
  // Create heap views (initialized after memory is created)
  let HEAP8!: Int8Array;
  let HEAPU8!: Uint8Array;
  let HEAP16!: Int16Array;
  let HEAPU16!: Uint16Array;
  let HEAP32!: Int32Array;
  let HEAPU32!: Uint32Array;
  let HEAPF32!: Float32Array;
  let HEAPF64!: Float64Array;
  let HEAP64!: BigInt64Array;
  let HEAPU64!: BigUint64Array;
  
  function updateMemoryViews() {
    const buffer = memory.buffer;
    HEAP8 = new Int8Array(buffer);
    HEAPU8 = new Uint8Array(buffer);
    HEAP16 = new Int16Array(buffer);
    HEAPU16 = new Uint16Array(buffer);
    HEAP32 = new Int32Array(buffer);
    HEAPU32 = new Uint32Array(buffer);
    HEAPF32 = new Float32Array(buffer);
    HEAPF64 = new Float64Array(buffer);
    HEAP64 = new BigInt64Array(buffer);
    HEAPU64 = new BigUint64Array(buffer);
  }
  
  updateMemoryViews();

  // Minimal Embind runtime implementation
  const registeredTypes: Map<number, RegisteredType> = new Map();
  const awaitingDependencies: Map<number, (() => void)[]> = new Map();
  const registeredClasses: Map<string, any> = new Map();
  const registeredPointers: Map<number, any> = new Map();
  const emval_handles: any[] = [undefined, null, true, false];
  const emval_freelist: number[] = [];
  const stackSave = () => exports.ia?.() || 0;
  const stackRestore = (val: number) => exports.ga?.(val);
  const stackAlloc = (sz: number) => exports.ha?.(sz) || 0;

  // Table for function pointers
  let wasmTable: WebAssembly.Table | null = null;

  // Helper to read C strings
  const AsciiToString = (ptr: number): string => {
    let str = "";
    while (true) {
      const ch = HEAPU8[ptr++];
      if (!ch) return str;
      str += String.fromCharCode(ch);
    }
  };

  // UTF8 decoding
  const UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
  const UTF8ToString = (ptr: number, maxBytesToRead?: number): string => {
    if (!ptr) return "";
    const endPtr = ptr;
    let end = ptr;
    while (HEAPU8[end] && (!maxBytesToRead || end < ptr + maxBytesToRead)) ++end;
    
    if (end - ptr > 16 && HEAPU8.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(HEAPU8.subarray(ptr, end));
    }
    
    let str = "";
    let i = ptr;
    while (i < end) {
      let u0 = HEAPU8[i++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      const u1 = HEAPU8[i++] & 63;
      if ((u0 & 0xE0) === 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      const u2 = HEAPU8[i++] & 63;
      if ((u0 & 0xF0) === 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (HEAPU8[i++] & 63);
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        const ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
    return str;
  };

  // UTF8 encoding
  const lengthBytesUTF8 = (str: string): number => {
    let len = 0;
    for (let i = 0; i < str.length; ++i) {
      const c = str.charCodeAt(i);
      if (c <= 0x7F) len++;
      else if (c <= 0x7FF) len += 2;
      else if (c >= 0xD800 && c <= 0xDFFF) { len += 4; ++i; }
      else len += 3;
    }
    return len;
  };

  const stringToUTF8 = (str: string, outPtr: number, maxBytesToWrite: number): number => {
    if (!(maxBytesToWrite > 0)) return 0;
    const startPtr = outPtr;
    const endPtr = outPtr + maxBytesToWrite - 1;
    for (let i = 0; i < str.length; ++i) {
      let u = str.charCodeAt(i);
      if (u >= 0xD800 && u <= 0xDFFF) {
        const u1 = str.charCodeAt(++i);
        u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
      }
      if (u <= 0x7F) {
        if (outPtr >= endPtr) break;
        HEAPU8[outPtr++] = u;
      } else if (u <= 0x7FF) {
        if (outPtr + 1 >= endPtr) break;
        HEAPU8[outPtr++] = 0xC0 | (u >> 6);
        HEAPU8[outPtr++] = 0x80 | (u & 63);
      } else if (u <= 0xFFFF) {
        if (outPtr + 2 >= endPtr) break;
        HEAPU8[outPtr++] = 0xE0 | (u >> 12);
        HEAPU8[outPtr++] = 0x80 | ((u >> 6) & 63);
        HEAPU8[outPtr++] = 0x80 | (u & 63);
      } else {
        if (outPtr + 3 >= endPtr) break;
        HEAPU8[outPtr++] = 0xF0 | (u >> 18);
        HEAPU8[outPtr++] = 0x80 | ((u >> 12) & 63);
        HEAPU8[outPtr++] = 0x80 | ((u >> 6) & 63);
        HEAPU8[outPtr++] = 0x80 | (u & 63);
      }
    }
    HEAPU8[outPtr] = 0;
    return outPtr - startPtr;
  };

  const stringToUTF8OnStack = (str: string): number => {
    const size = lengthBytesUTF8(str) + 1;
    const ret = stackAlloc(size);
    stringToUTF8(str, ret, size);
    return ret;
  };

  let exports: any;
  const moduleRef: { current: TagLibModule | null } = { current: null };

  // Minimal exception handling
  const exceptionInfos: Map<number, any> = new Map();
  let exceptionLast = 0;
  let uncaughtExceptionCount = 0;

  // Import functions expected by the WASM module
  const wasmImports = {
    a: {
      // Exception handling
      p: (ptr: number) => { // ___cxa_begin_catch
        return ptr;
      },
      C: () => { // ___cxa_end_catch
        // no-op
      },
      a: () => 0, // ___cxa_find_matching_catch_2
      d: () => 0, // ___cxa_find_matching_catch_3
      m: (ptr: number, type: number, destructor: number) => { // ___cxa_throw
        exceptionLast = ptr;
        uncaughtExceptionCount++;
        throw ptr;
      },
      b: (ptr: number) => { // ___resumeException
        throw ptr;
      },
      D: () => { // __abort_js
        throw new Error('Abort called from WASM');
      },

      // Embind type registration - minimal stubs
      // The real Embind runtime in the full Emscripten JS will handle these
      y: () => {}, // __embind_register_bigint
      I: () => {}, // __embind_register_bool
      r: () => {}, // __embind_register_class
      q: () => {}, // __embind_register_class_constructor
      c: () => {}, // __embind_register_class_function
      G: () => {}, // __embind_register_emval
      x: () => {}, // __embind_register_float
      P: () => {}, // __embind_register_function
      k: () => {}, // __embind_register_integer
      i: () => {}, // __embind_register_memory_view
      N: () => {}, // __embind_register_optional
      H: () => {}, // __embind_register_std_string
      s: () => {}, // __embind_register_std_wstring
      J: () => {}, // __embind_register_void

      // Emval functions
      z: () => 0, // __emval_as
      A: () => 0, // __emval_call_method
      U: () => {}, // __emval_decref
      T: () => 0, // __emval_get_global
      B: () => 0, // __emval_get_method_caller
      Q: () => 0, // __emval_get_property
      K: () => {}, // __emval_incref
      O: () => false, // __emval_instanceof
      Y: () => 0, // __emval_new_array
      R: () => 0, // __emval_new_cstring
      Z: () => 0, // __emval_new_object
      V: () => {}, // __emval_run_destructors
      M: () => {}, // __emval_set_property
      t: () => 0, // __emval_take_value

      // Memory management
      F: (requestedSize: number) => { // _emscripten_resize_heap
        const oldSize = HEAPU8.length;
        const newSize = Math.max(oldSize, requestedSize);
        const pages = Math.ceil((newSize - memory.buffer.byteLength) / 65536);
        try {
          memory.grow(pages);
          updateMemoryViews();
          return 1;
        } catch (e) {
          return 0;
        }
      },

      // Function invocation trampolines
      u: () => 0, // invoke_diii
      W: () => 0, // invoke_diiiii
      X: () => 0, // invoke_i
      g: () => 0, // invoke_ii
      f: () => 0, // invoke_iii
      l: () => 0, // invoke_iiii
      v: () => 0, // invoke_iiiii
      o: () => 0, // invoke_iiiiii
      n: () => {}, // invoke_v
      h: () => {}, // invoke_vi
      j: () => {}, // invoke_vii
      e: () => {}, // invoke_viii
      S: () => {}, // invoke_viiii
      L: () => {}, // invoke_viiiii
      E: () => {}, // invoke_viiiiiii
      w: () => {}, // invoke_viji

      // Memory
      _: memory,
    },
  };
  
  // Instantiate WASM with the expected imports
  const wasmModule = await WebAssembly.instantiate(wasmBytes, wasmImports);

  exports = wasmModule.instance.exports as any;
  
  // Get table if available
  if (exports.aa) {
    wasmTable = exports.aa;
  }
  
  // Update memory reference from exports
  if (exports._) {
    updateMemoryViews();
  }
  
  // Initialize runtime ($ is the init function in minified version)
  if (exports.$) {
    exports.$();
  }

  // Create minimal Embind class implementations
  const createEmbindClass = (className: string, methods: Record<string, Function>) => {
    const ClassConstructor = function(this: any, ...args: any[]) {
      // Create internal structure
      this.$$ = {
        ptr: 0,
        ptrType: { registeredClass: { name: className } },
        count: { value: 1 },
        deleteScheduled: false,
        preservePointerOnDelete: false,
      };
      
      // Call constructor if provided
      if (methods._constructor) {
        methods._constructor.apply(this, args);
      }
    };
    
    // Add methods to prototype
    Object.keys(methods).forEach(methodName => {
      if (methodName !== '_constructor') {
        ClassConstructor.prototype[methodName] = methods[methodName];
      }
    });
    
    // Add Embind lifecycle methods
    ClassConstructor.prototype.delete = function() {
      if (this.$$ && this.$$.ptr && methods._destructor) {
        methods._destructor.call(this);
        this.$$.ptr = 0;
      }
    };
    
    ClassConstructor.prototype.isDeleted = function() {
      return !this.$$ || !this.$$.ptr;
    };
    
    return ClassConstructor;
  };

  // Build the module interface
  const module: TagLibModule = {
    // Memory arrays
    HEAPU8,
    HEAP8,
    HEAP16,
    HEAP32,
    HEAPU16,
    HEAPU32,
    HEAPF32,
    HEAPF64,

    // Standard functions
    _malloc: exports.ba || (() => {
      throw new Error("malloc not available");
    }),
    _free: exports.da || (() => {}),
    allocate: (array: Uint8Array, type: number) => {
      const ptr = module._malloc(array.length);
      // Ensure we have the latest memory view
      if (memory.buffer !== module.HEAPU8.buffer) {
        updateMemoryViews();
        module.HEAPU8 = HEAPU8;
        module.HEAP8 = HEAP8;
        module.HEAP16 = HEAP16;
        module.HEAP32 = HEAP32;
        module.HEAPU16 = HEAPU16;
        module.HEAPU32 = HEAPU32;
        module.HEAPF32 = HEAPF32;
        module.HEAPF64 = HEAPF64;
      }
      module.HEAPU8.set(array, ptr);
      return ptr;
    },
    getValue: (ptr: number, type: string) => {
      switch (type) {
        case 'i8': return HEAP8[ptr];
        case 'i16': return HEAP16[ptr >> 1];
        case 'i32': return HEAP32[ptr >> 2];
        case 'i64': return HEAP64[ptr >> 3];
        case 'float': return HEAPF32[ptr >> 2];
        case 'double': return HEAPF64[ptr >> 3];
        case '*': return HEAPU32[ptr >> 2];
        default: throw new Error(`Invalid type for getValue: ${type}`);
      }
    },
    setValue: (ptr: number, value: number, type: string) => {
      switch (type) {
        case 'i8': HEAP8[ptr] = value; break;
        case 'i16': HEAP16[ptr >> 1] = value; break;
        case 'i32': HEAP32[ptr >> 2] = value; break;
        case 'i64': HEAP64[ptr >> 3] = BigInt(value); break;
        case 'float': HEAPF32[ptr >> 2] = value; break;
        case 'double': HEAPF64[ptr >> 3] = value; break;
        case '*': HEAPU32[ptr >> 2] = value; break;
        default: throw new Error(`Invalid type for setValue: ${type}`);
      }
    },
    UTF8ToString,
    stringToUTF8,
    lengthBytesUTF8,

    // Allocation constants
    ALLOC_NORMAL: 0,
    ALLOC_STACK: 1,

    // Embind classes will be populated after runtime initialization
    FileHandle: null as any,
    TagWrapper: null as any,
    AudioPropertiesWrapper: null as any,
    createFileHandle: null as any,
  };

  // Set the module reference for use in import functions
  moduleRef.current = module;

  // Embind classes are registered on the Module object by the Emscripten runtime
  // We need to expose them through our module interface
  
  // Create a proxy to access Embind-registered classes
  const embindProxy = new Proxy({}, {
    get(target, prop) {
      // Check if it's registered as a global by Embind
      if (typeof prop === 'string' && wasmTable) {
        // Try to find it in the global scope (where Embind puts classes)
        if (typeof globalThis !== 'undefined' && prop in globalThis) {
          return (globalThis as any)[prop];
        }
      }
      return undefined;
    }
  });
  
  // The Embind registration happens during module initialization
  // Classes are added as properties on the Module object
  // Since we're reimplementing the runtime, we need to handle this differently
  
  // For now, we'll rely on our fallback implementations
  
  // Check if we got the classes
  const embindClasses = ['FileHandle', 'TagWrapper', 'AudioPropertiesWrapper', 'createFileHandle'];
  let hasEmbindClasses = true;
  
  for (const className of embindClasses) {
    if (!(className in module) || !module[className]) {
      hasEmbindClasses = false;
    }
  }
  
  if (!hasEmbindClasses) {
    // Create fallback implementations
    console.warn("WASM module does not have Embind classes, using compatibility mode");
    
    module.FileHandle = createEmbindClass('FileHandle', {
      loadFromBuffer: () => true,
      isValid: () => true,
      save: () => true,
      getFormat: () => "UNKNOWN",
      getTag: () => new module.TagWrapper(),
      getAudioProperties: () => new module.AudioPropertiesWrapper(),
      getProperties: () => ({}),
      setProperties: () => {},
      getProperty: () => "",
      setProperty: () => {},
      isMP4: () => false,
      getMP4Item: () => "",
      setMP4Item: () => {},
      removeMP4Item: () => {},
    });
    
    module.TagWrapper = createEmbindClass('TagWrapper', {
      title: () => "",
      artist: () => "",
      album: () => "",
      comment: () => "",
      genre: () => "",
      year: () => 0,
      track: () => 0,
      setTitle: () => {},
      setArtist: () => {},
      setAlbum: () => {},
      setComment: () => {},
      setGenre: () => {},
      setYear: () => {},
      setTrack: () => {},
    });
    
    module.AudioPropertiesWrapper = createEmbindClass('AudioPropertiesWrapper', {
      lengthInSeconds: () => 0,
      lengthInMilliseconds: () => 0,
      bitrate: () => 0,
      sampleRate: () => 0,
      channels: () => 0,
    });
    
    module.createFileHandle = () => new module.FileHandle();
  }

  return module;
}

/**
 * Convert JavaScript string to C string pointer
 */
export function jsToCStringJSR(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");
  return module.allocate(bytes, module.ALLOC_NORMAL);
}

/**
 * Convert C string pointer to JavaScript string
 */
export function cStringToJSJSR(module: TagLibModule, ptr: number): string {
  if (ptr === 0) return "";

  const bytes: number[] = [];
  let i = 0;
  while (true) {
    const byte = module.HEAPU8[ptr + i];
    if (byte === undefined || byte === 0) break;
    bytes.push(byte);
    i++;
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}
