import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  cStringToJS,
  emscriptenToWasmExports,
  isCloudflareWorkers,
  jsToCString,
} from "../src/wasm-workers.ts";

describe("cStringToJS", () => {
  it("should return empty string for null pointer", () => {
    const mockModule = createMockModule();
    assertEquals(cStringToJS(mockModule, 0), "");
  });

  it("should read null-terminated string from memory", () => {
    const mockModule = createMockModule();
    const str = "Hello";
    const encoded = new TextEncoder().encode(str);
    mockModule.HEAPU8.set(encoded, 100);
    mockModule.HEAPU8[100 + encoded.length] = 0; // null terminator

    assertEquals(cStringToJS(mockModule, 100), "Hello");
  });

  it("should handle empty string (just null terminator)", () => {
    const mockModule = createMockModule();
    mockModule.HEAPU8[50] = 0;

    assertEquals(cStringToJS(mockModule, 50), "");
  });

  it("should handle UTF-8 encoded strings", () => {
    const mockModule = createMockModule();
    const str = "cafe";
    const encoded = new TextEncoder().encode(str);
    mockModule.HEAPU8.set(encoded, 200);
    mockModule.HEAPU8[200 + encoded.length] = 0;

    assertEquals(cStringToJS(mockModule, 200), "cafe");
  });
});

describe("emscriptenToWasmExports", () => {
  it("should bridge module to WasmExports interface", () => {
    const mockModule = createMockModule();
    const exports = emscriptenToWasmExports(mockModule);

    assertExists(exports.memory);
    assertExists(exports.malloc);
    assertExists(exports.free);
  });

  it("should delegate malloc/free to module", () => {
    const mockModule = createMockModule();
    const calls: string[] = [];
    mockModule._malloc = (size: number) => {
      calls.push(`malloc(${size})`);
      return 1024;
    };
    mockModule._free = (ptr: number) => {
      calls.push(`free(${ptr})`);
    };

    const exports = emscriptenToWasmExports(mockModule);
    const ptr = exports.malloc(64);
    assertEquals(ptr, 1024);
    exports.free(ptr);

    assertEquals(calls, ["malloc(64)", "free(1024)"]);
  });

  it("should use wasmMemory when available", () => {
    const mockModule = createMockModule();
    const wasmMemory = new WebAssembly.Memory({ initial: 1 });
    mockModule.wasmMemory = wasmMemory;

    const exports = emscriptenToWasmExports(mockModule);
    assertEquals(exports.memory, wasmMemory);
  });

  it("should fall back to HEAPU8.buffer when no wasmMemory", () => {
    const mockModule = createMockModule();
    delete mockModule.wasmMemory;

    const exports = emscriptenToWasmExports(mockModule);
    assertEquals(exports.memory.buffer, mockModule.HEAPU8.buffer);
  });
});

describe("isCloudflareWorkers", () => {
  it("should return false in Deno environment", () => {
    assertEquals(isCloudflareWorkers(), false);
  });
});

describe("jsToCString", () => {
  it("should allocate and write string to module memory", () => {
    const mockModule = createMockModule();
    let allocatedSize = 0;
    mockModule._malloc = (size: number) => {
      allocatedSize = size;
      return 500;
    };
    mockModule._free = () => {};

    const ptr = jsToCString(mockModule, "test");
    assertEquals(ptr, 500);
    // "test" + null terminator = 5 bytes
    assertEquals(allocatedSize, 5);

    // Verify string was written to HEAPU8
    const written = new TextDecoder().decode(
      mockModule.HEAPU8.slice(500, 500 + 4),
    );
    assertEquals(written, "test");
    assertEquals(mockModule.HEAPU8[504], 0); // null terminator
  });

  it("should free memory if set operation fails", () => {
    const mockModule = createMockModule();
    let freed = false;
    mockModule._malloc = () => 999999999; // pointer beyond buffer
    mockModule._free = () => {
      freed = true;
    };

    // Create a tiny HEAPU8 so set() will throw
    mockModule.HEAPU8 = new Uint8Array(1);
    Object.defineProperty(mockModule.HEAPU8, "buffer", {
      get: () => new ArrayBuffer(1),
    });

    assertThrows(() => jsToCString(mockModule, "test"));
    assertEquals(freed, true);
  });
});

describe("AudioFileWorkers", () => {
  it("should expose dispose and Symbol.dispose", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const file = new AudioFileWorkers(mockModule as any, 1);

    assertExists(file.dispose);
    assertExists(file[Symbol.dispose]);
  });

  it("should read tag from C API pointers", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const file = new AudioFileWorkers(mockModule as any, 1);

    const tag = file.tag();
    assertExists(tag);
    assertEquals(tag.year, 0);
    assertEquals(tag.track, 0);
  });

  it("should return audio properties", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const file = new AudioFileWorkers(mockModule as any, 1);

    const props = file.audioProperties();
    assertExists(props);
    assertEquals(props!.length, 0);
    assertEquals(props!.bitrate, 0);
  });

  it("should return null audio properties when propsPtr is 0", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    mockModule._taglib_file_audioproperties = () => 0;
    const file = new AudioFileWorkers(mockModule as any, 1);

    assertEquals(file.audioProperties(), null);
  });

  it("should return empty tag when tagPtr is 0", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    mockModule._taglib_file_tag = () => 0;
    const file = new AudioFileWorkers(mockModule as any, 1);

    assertEquals(file.tag(), {});
  });

  it("should set string tags via C API", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const setCalls: Array<{ tag: number; ptr: number }> = [];
    mockModule._taglib_tag_set_title = (tag: number, ptr: number) => {
      setCalls.push({ tag, ptr });
    };

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.setTitle("New Title");
    assertEquals(setCalls.length, 1);
    assertEquals(setCalls[0].tag, 100); // tagPtr from mock
  });

  it("should set numeric tags", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const yearCalls: number[] = [];
    const trackCalls: number[] = [];
    mockModule._taglib_tag_set_year = (_tag: number, val: number) => {
      yearCalls.push(val);
    };
    mockModule._taglib_tag_set_track = (_tag: number, val: number) => {
      trackCalls.push(val);
    };

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.setYear(2025);
    file.setTrack(7);
    assertEquals(yearCalls, [2025]);
    assertEquals(trackCalls, [7]);
  });

  it("should save via C API", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    mockModule._taglib_file_save = () => 1;

    const file = new AudioFileWorkers(mockModule as any, 1);
    assertEquals(file.save(), true);
  });

  it("should return false for save when fileId is 0", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.dispose(); // sets fileId to 0
    assertEquals(file.save(), false);
  });

  it("should call delete on dispose", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    let deleted = false;
    mockModule._taglib_file_delete = () => {
      deleted = true;
    };

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.dispose();
    assertEquals(deleted, true);
  });

  it("should not delete twice", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    let deleteCount = 0;
    mockModule._taglib_file_delete = () => {
      deleteCount++;
    };

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.dispose();
    file.dispose();
    assertEquals(deleteCount, 1);
  });

  it("should return format string", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    // Write "FLAC" at ptr 300
    const encoded = new TextEncoder().encode("FLAC");
    mockModule.HEAPU8.set(encoded, 300);
    mockModule.HEAPU8[304] = 0;
    mockModule._taglib_file_format = () => 300;

    const file = new AudioFileWorkers(mockModule as any, 1);
    assertEquals(file.format(), "FLAC");
  });

  it("should return MP3 fallback when format pointer is 0", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    mockModule._taglib_file_format = () => 0;

    const file = new AudioFileWorkers(mockModule as any, 1);
    assertEquals(file.format(), "MP3");
  });

  it("should warn on getFileBuffer", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const file = new AudioFileWorkers(mockModule as any, 1);

    const buf = file.getFileBuffer();
    assertEquals(buf.length, 0);
  });

  it("should return extended tag with basic fields", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const file = new AudioFileWorkers(mockModule as any, 1);

    const ext = file.extendedTag();
    assertExists(ext);
    assertEquals(ext.acoustidFingerprint, undefined);
    assertEquals(ext.albumArtist, undefined);
  });

  it("should set extended tag fields", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    const setCalls: string[] = [];
    mockModule._taglib_tag_set_title = () => setCalls.push("title");
    mockModule._taglib_tag_set_artist = () => setCalls.push("artist");

    const file = new AudioFileWorkers(mockModule as any, 1);
    file.setExtendedTag({ title: "T", artist: "A" });
    assertEquals(setCalls, ["title", "artist"]);
  });

  it("should check validity via C API", async () => {
    const { AudioFileWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    mockModule._taglib_file_is_valid = () => 1;

    const file = new AudioFileWorkers(mockModule as any, 1);
    assertEquals(file.isValid(), true);
  });
});

describe("TagLibWorkers", () => {
  it("should throw MemoryError when HEAPU8 missing", async () => {
    const { TagLibWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    delete (mockModule as any).HEAPU8;

    // Access private module via initialize
    const instance = Object.create(TagLibWorkers.prototype);
    Object.defineProperty(instance, "module", { value: mockModule });

    assertThrows(() => instance.open(new Uint8Array([1, 2, 3])));
  });

  it("should throw EnvironmentError when C-style functions missing", async () => {
    const { TagLibWorkers } = await import("../src/workers/index.ts");
    const mockModule = createMockModuleWithCApi();
    delete mockModule._taglib_file_new_from_buffer;

    const instance = Object.create(TagLibWorkers.prototype);
    Object.defineProperty(instance, "module", { value: mockModule });

    assertThrows(() => instance.open(new Uint8Array([1, 2, 3])));
  });
});

// --- Test helpers ---

function createMockModule() {
  const buffer = new ArrayBuffer(65536);
  const heapu8 = new Uint8Array(buffer);
  return {
    HEAPU8: heapu8,
    wasmMemory: undefined as WebAssembly.Memory | undefined,
    _malloc: (size: number) => 1024,
    _free: (_ptr: number) => {},
    allocate: undefined as any,
    ALLOC_NORMAL: undefined as any,
  } as any;
}

function createMockModuleWithCApi() {
  const buffer = new ArrayBuffer(65536);
  const heapu8 = new Uint8Array(buffer);
  return {
    HEAPU8: heapu8,
    wasmMemory: undefined as WebAssembly.Memory | undefined,
    _malloc: (size: number) => 1024,
    _free: (_ptr: number) => {},
    _taglib_file_tag: (_fileId: number) => 100,
    _taglib_file_audioproperties: (_fileId: number) => 200,
    _taglib_tag_title: (_tagPtr: number) => 0,
    _taglib_tag_artist: (_tagPtr: number) => 0,
    _taglib_tag_album: (_tagPtr: number) => 0,
    _taglib_tag_comment: (_tagPtr: number) => 0,
    _taglib_tag_genre: (_tagPtr: number) => 0,
    _taglib_tag_year: (_tagPtr: number) => 0,
    _taglib_tag_track: (_tagPtr: number) => 0,
    _taglib_audioproperties_length: (_propsPtr: number) => 0,
    _taglib_audioproperties_bitrate: (_propsPtr: number) => 0,
    _taglib_audioproperties_samplerate: (_propsPtr: number) => 0,
    _taglib_audioproperties_channels: (_propsPtr: number) => 0,
    _taglib_file_is_valid: (_fileId: number) => 0,
    _taglib_file_save: (_fileId: number) => 0,
    _taglib_file_delete: (_fileId: number) => {},
    _taglib_file_format: (_fileId: number) => 0,
    _taglib_file_new_from_buffer: (_ptr: number, _len: number) => 1,
    _taglib_tag_set_title: undefined as any,
    _taglib_tag_set_artist: undefined as any,
    _taglib_tag_set_album: undefined as any,
    _taglib_tag_set_comment: undefined as any,
    _taglib_tag_set_genre: undefined as any,
    _taglib_tag_set_year: undefined as any,
    _taglib_tag_set_track: undefined as any,
  } as any;
}
