import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { WasiToTagLibAdapter } from "../src/runtime/wasi-adapter/index.ts";

describe("WasiToTagLibAdapter", () => {
  it("should create adapter from mock WASI module", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertExists(adapter);
  });

  it("should expose Emscripten-compatible heap properties", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());

    assertExists(adapter.HEAP8);
    assertExists(adapter.HEAP16);
    assertExists(adapter.HEAPU8);
    assertExists(adapter.HEAP32);
    assertExists(adapter.HEAPU16);
    assertExists(adapter.HEAPU32);
    assertExists(adapter.HEAPF32);
    assertExists(adapter.HEAPF64);
  });

  it("should resolve ready promise to self", async () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    const resolved = await adapter.ready;
    assertEquals(resolved, adapter);
  });

  it("should delegate malloc to WASI module", () => {
    const calls: number[] = [];
    const mock = createMockWasiModule();
    mock.malloc = (size: number) => {
      calls.push(size);
      return 1024;
    };

    const adapter = new WasiToTagLibAdapter(mock);
    const ptr = adapter._malloc(64);
    assertEquals(ptr, 1024);
    assertEquals(calls, [64]);
  });

  it("should delegate free to WASI module", () => {
    const calls: number[] = [];
    const mock = createMockWasiModule();
    mock.free = (ptr: number) => {
      calls.push(ptr);
    };

    const adapter = new WasiToTagLibAdapter(mock);
    adapter._free(1024);
    assertEquals(calls, [1024]);
  });

  it("should implement realloc by allocating, copying, and freeing", () => {
    const mock = createMockWasiModule();
    const actions: string[] = [];
    mock.malloc = (size: number) => {
      actions.push(`malloc(${size})`);
      return 2048;
    };
    mock.free = (ptr: number) => {
      actions.push(`free(${ptr})`);
    };

    const adapter = new WasiToTagLibAdapter(mock);
    const newPtr = adapter._realloc(1024, 128);
    assertEquals(newPtr, 2048);
    assertEquals(actions.includes("malloc(128)"), true);
    assertEquals(actions.includes("free(1024)"), true);
  });

  it("should convert C string to JS string", () => {
    const mock = createMockWasiModule();
    const text = "Hello World";
    const encoded = new TextEncoder().encode(text);
    new Uint8Array(mock.memory.buffer).set(encoded, 100);
    new Uint8Array(mock.memory.buffer)[100 + encoded.length] = 0;

    const adapter = new WasiToTagLibAdapter(mock);
    assertEquals(adapter.UTF8ToString(100), "Hello World");
  });

  it("should return empty string for null pointer", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertEquals(adapter.UTF8ToString(0), "");
  });

  it("should write JS string to C memory", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const ptr = 200;
    const len = adapter.stringToUTF8("Hi", ptr, 10);

    const heap = new Uint8Array(mock.memory.buffer);
    assertEquals(len, 2);
    assertEquals(heap[ptr], 72); // 'H'
    assertEquals(heap[ptr + 1], 105); // 'i'
    assertEquals(heap[ptr + 2], 0); // null terminator
  });

  it("should calculate UTF-8 byte length", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertEquals(adapter.lengthBytesUTF8("hello"), 5);
    assertEquals(adapter.lengthBytesUTF8(""), 0);
  });

  it("should create file handle", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertExists(fh);
  });

  it("should return version from WASI module", () => {
    const mock = createMockWasiModule();
    mock.tl_version = () => "2.1.0";
    const adapter = new WasiToTagLibAdapter(mock);
    assertEquals(adapter.version(), "2.1.0");
  });

  it("should throw for unsupported Emscripten functions", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());

    assertThrows(() => adapter.addFunction(() => {}));
    assertThrows(() => adapter.removeFunction(0));
    assertThrows(() => adapter.cwrap("fn", null, []));
    assertThrows(() => adapter.ccall("fn", null, [], []));
  });

  it("should throw when constructing FileHandle directly", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertThrows(() => new adapter.FileHandle());
  });

  it("should throw when constructing TagWrapper directly", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertThrows(() => new adapter.TagWrapper());
  });

  it("should throw when constructing AudioPropertiesWrapper directly", () => {
    const adapter = new WasiToTagLibAdapter(createMockWasiModule());
    assertThrows(() => new adapter.AudioPropertiesWrapper());
  });
});

describe("WasiFileHandle", () => {
  it("should report not valid before loading", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertEquals(fh.isValid(), false);
  });

  it("should return empty buffer before loading", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertEquals(fh.getBuffer().length, 0);
  });

  it("should return Unknown format before loading", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertEquals(fh.getFormat(), "Unknown");
  });

  it("should throw on loadFromPath", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertThrows(() => (fh as any).loadFromPath("/test.mp3"));
  });

  it("should detect MP3 format from magic bytes", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // MP3 magic: FF FB
    const mp3Data = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0, 0, 0]);
    fh.loadFromBuffer(mp3Data);
    assertEquals(fh.getFormat(), "MP3");
  });

  it("should detect FLAC format from magic bytes", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // FLAC magic: 66 4C 61 43
    const flacData = new Uint8Array([0x66, 0x4C, 0x61, 0x43, 0, 0, 0, 0, 0, 0]);
    fh.loadFromBuffer(flacData);
    assertEquals(fh.getFormat(), "FLAC");
  });

  it("should detect OGG format from magic bytes", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // OGG magic: 4F 67 67 53
    const oggData = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0]);
    fh.loadFromBuffer(oggData);
    assertEquals(fh.getFormat(), "OGG");
  });

  it("should detect MP4 by ftyp box", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // ftyp magic at offset 4: 66 74 79 70
    const m4aData = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0, 0]);
    fh.loadFromBuffer(m4aData);
    assertEquals(fh.isMP4(), true);
  });

  it("should not be MP4 for non-MP4 data", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));
    assertEquals(fh.isMP4(), false);
  });

  it("should manage tag properties", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperty("myKey", "myValue");
    assertEquals(fh.getProperty("myKey"), "myValue");
  });

  it("should manage MP4 items via property interface", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setMP4Item("----:com.apple.iTunes:iTunNORM", "value");
    assertEquals(fh.getMP4Item("----:com.apple.iTunes:iTunNORM"), "value");

    fh.removeMP4Item("----:com.apple.iTunes:iTunNORM");
    assertEquals(fh.getMP4Item("----:com.apple.iTunes:iTunNORM"), "");
  });

  it("should manage pictures", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    assertEquals(fh.getPictures(), []);

    const pic = {
      mimeType: "image/jpeg",
      data: new Uint8Array([1, 2]),
      type: 3,
    };
    fh.addPicture(pic);
    assertEquals(fh.getPictures().length, 1);

    fh.removePictures();
    assertEquals(fh.getPictures(), []);
  });

  it("should manage ratings", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setRatings([{ rating: 5, email: "test@test.com" }]);
    const ratings = fh.getRatings();
    assertEquals(ratings.length, 1);
    assertEquals(ratings[0].rating, 5);
    assertEquals(ratings[0].email, "test@test.com");
    assertEquals(ratings[0].counter, 0);
  });

  it("should throw after destroy", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));
    fh.destroy();

    assertThrows(() => fh.isValid());
    assertThrows(() => fh.getFormat());
    assertThrows(() => fh.getBuffer());
    assertThrows(() => fh.save());
    assertThrows(() => fh.getTag());
  });

  it("should return tag wrapper with getter/setter methods", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    const tag = fh.getTag();
    assertExists(tag);
    assertEquals(typeof tag.title, "function");
    assertEquals(typeof tag.setTitle, "function");

    tag.setTitle("Test Title");
    // Re-get tag to verify update
    const tag2 = fh.getTag();
    assertEquals(tag2.title(), "Test Title");
  });

  it("should return null audio properties when absent from data", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    const props = fh.getAudioProperties();
    assertEquals(props, null);
  });
});

// --- Test helpers ---

function createMockWasiModule(): any {
  const memory = new WebAssembly.Memory({ initial: 1 });
  return {
    memory,
    malloc: (size: number) => 1024,
    free: (_ptr: number) => {},
    tl_version: () => "2.1.0",
    tl_read_tags: () => 0,
    tl_write_tags: () => 0,
    tl_get_last_error_code: () => 0,
  };
}

/**
 * Create a stub for tl_read_tags that writes a minimal valid msgpack response.
 * Matches the real C API: returns a pointer to msgpack data (non-zero = success),
 * writes size to *outPtr. Returns 0 (NULL) on failure.
 */
function stubTlReadTags(mock: any) {
  const DATA_PTR = 4096;
  return (
    _pathPtr: number,
    _bufPtr: number,
    _bufSize: number,
    outSizePtr: number,
  ) => {
    const heap = new Uint8Array(mock.memory.buffer);
    const view = new DataView(mock.memory.buffer);
    // Write empty msgpack map (0x80) at a fixed location
    heap[DATA_PTR] = 0x80;
    // Write size (1 byte) to the out_size pointer
    view.setUint32(outSizePtr, 1, true);
    // Return pointer to data (non-zero = success)
    return DATA_PTR;
  };
}
