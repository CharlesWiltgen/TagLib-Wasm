import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { WasiToTagLibAdapter } from "../src/runtime/wasi-adapter/index.ts";
import {
  readTagsFromWasm,
  writeTagsToWasm,
} from "../src/runtime/wasi-adapter/wasm-io.ts";
import { WasmMemoryError } from "../src/runtime/wasi-memory.ts";
import type { ExtendedTag } from "../src/types.ts";

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

  it("should convert numeric fields in setProperty()", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperty("DATE", "2024");
    assertEquals(fh.getTag().year(), 2024);

    fh.setProperty("TRACKNUMBER", "7");
    assertEquals(fh.getTag().track(), 7);
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

    fh.setRatings([{ rating: 0.8, email: "test@test.com" }]);
    const ratings = fh.getRatings();
    assertEquals(ratings.length, 1);
    assertEquals(ratings[0].rating, 0.8);
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

describe("WasiFileHandle.getProperties()", () => {
  it("should return UPPERCASE keys for tag fields", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.getTag().setTitle("Test");
    fh.getTag().setArtist("Artist");

    const props = fh.getProperties();
    assertExists(props["TITLE"]);
    assertExists(props["ARTIST"]);
    assertEquals("title" in props, false);
    assertEquals("artist" in props, false);
  });

  it("should return string array values", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.getTag().setTitle("Test");

    const props = fh.getProperties();
    assertEquals(props["TITLE"], ["Test"]);
  });

  it("should return UPPERCASE ALBUMARTIST key", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperty("ALBUMARTIST", "Various Artists");

    const props = fh.getProperties();
    assertEquals(props["ALBUMARTIST"], ["Various Artists"]);
    assertEquals("albumArtist" in props, false);
  });

  it("should exclude audio property keys", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTagsWithAudio(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    const props = fh.getProperties();
    assertEquals("bitrate" in props, false);
    assertEquals("sampleRate" in props, false);
    assertEquals("channels" in props, false);
    assertEquals("length" in props, false);
    assertEquals("lengthMs" in props, false);
    // Tag data should still be present
    assertExists(props["TITLE"]);
  });

  it("should pass through unknown UPPERCASE keys in getProperties()", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperty("ACOUSTID_FINGERPRINT", "abc123");

    const props = fh.getProperties();
    assertEquals(props["ACOUSTID_FINGERPRINT"], ["abc123"]);
  });

  it("should omit zero-value numeric fields", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.getTag().setTitle("Test");
    // year and track default to 0 — should be omitted

    const props = fh.getProperties();
    assertEquals("DATE" in props, false);
    assertEquals("TRACKNUMBER" in props, false);
    assertExists(props["TITLE"]);
  });
});

describe("WasiFileHandle.setProperties()", () => {
  it("should map UPPERCASE keys to camelCase in tagData", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ TITLE: ["New Title"] });
    assertEquals(fh.getTag().title(), "New Title");
  });

  it("should roundtrip through getProperties()", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ TITLE: ["New Title"], ARTIST: ["New Artist"] });
    const props = fh.getProperties();
    assertEquals(props["TITLE"], ["New Title"]);
    assertEquals(props["ARTIST"], ["New Artist"]);
  });

  it("should handle ALBUMARTIST mapping", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ ALBUMARTIST: ["VA"] });
    assertEquals(fh.getProperty("ALBUMARTIST"), "VA");
    assertEquals(fh.getProperties()["ALBUMARTIST"], ["VA"]);
  });

  it("should pass through unknown UPPERCASE keys for C++ write path", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ MYCUSTOMKEY: ["custom value"] });
    assertEquals(fh.getProperty("MYCUSTOMKEY"), "custom value");
  });

  it("should handle numeric value conversion for DATE", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ DATE: ["2024"] });
    assertEquals(fh.getTag().year(), 2024);
  });

  it("should handle numeric value conversion for TRACKNUMBER", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setProperties({ TRACKNUMBER: ["5"] });
    assertEquals(fh.getTag().track(), 5);
  });
});

describe("WasiFileHandle.removeMP4Item()", () => {
  it("should remove items using mapped key", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setMP4Item("TITLE", "test");
    assertEquals(fh.getMP4Item("TITLE"), "test");

    fh.removeMP4Item("TITLE");
    assertEquals(fh.getMP4Item("TITLE"), "");
  });

  it("should still remove custom keys directly", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    fh.loadFromBuffer(new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]));

    fh.setMP4Item("----:com.apple.iTunes:custom", "val");
    assertEquals(fh.getMP4Item("----:com.apple.iTunes:custom"), "val");

    fh.removeMP4Item("----:com.apple.iTunes:custom");
    assertEquals(fh.getMP4Item("----:com.apple.iTunes:custom"), "");
  });
});

describe("WasiFileHandle.getFormat() extended", () => {
  it("should detect WAV format from RIFF magic bytes", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // RIFF magic: 0x52 0x49 0x46 0x46
    const wavData = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0]);
    fh.loadFromBuffer(wavData);
    assertEquals(fh.getFormat(), "WAV");
  });

  it("should detect M4A format from ftyp magic bytes", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    // ftyp at offset 4: 0x66 0x74 0x79 0x70
    const m4aData = new Uint8Array([
      0,
      0,
      0,
      0x20,
      0x66,
      0x74,
      0x79,
      0x70,
      0,
      0,
    ]);
    fh.loadFromBuffer(m4aData);
    assertEquals(fh.getFormat(), "MP4");
  });
});

describe("WasiFileHandle.save()", () => {
  it("should return false before loadFromBuffer()", () => {
    const mock = createMockWasiModule();
    const adapter = new WasiToTagLibAdapter(mock);
    const fh = adapter.createFileHandle();
    assertEquals(fh.save(), false);
  });
});

describe("readTagsFromWasm", () => {
  it("should return msgpack data on success", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = stubTlReadTags(mock);

    const buffer = new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = readTagsFromWasm(mock, buffer);
    assertEquals(result instanceof Uint8Array, true);
    assertEquals(result.length, 1);
    assertEquals(result[0], 0x80); // empty msgpack map
  });

  it("should throw WasmMemoryError when tl_read_tags returns 0", () => {
    const mock = createMockWasiModule();
    mock.tl_read_tags = () => 0;
    mock.tl_get_last_error_code = () => 42;

    const buffer = new Uint8Array([0xFF, 0xFB, 0, 0]);
    assertThrows(
      () => readTagsFromWasm(mock, buffer),
      WasmMemoryError,
      "error code 42",
    );
  });
});

describe("writeTagsToWasm", () => {
  it("should return modified buffer on success", () => {
    const mock = createMockWasiModule();
    const OUTPUT_PTR = 8192;
    const outputData = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, 0xAA]);

    mock.tl_write_tags = (
      _fd: number,
      _inputPtr: number,
      _inputSize: number,
      _tagPtr: number,
      _tagSize: number,
      outBufPtr: number,
      outSizePtr: number,
    ) => {
      const view = new DataView(mock.memory.buffer);
      const heap = new Uint8Array(mock.memory.buffer);
      heap.set(outputData, OUTPUT_PTR);
      view.setUint32(outBufPtr, OUTPUT_PTR, true);
      view.setUint32(outSizePtr, outputData.length, true);
      return 0; // success
    };

    const fileData = new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0]);
    const tagData = { title: "Test" } as unknown as ExtendedTag;
    const result = writeTagsToWasm(mock, fileData, tagData);
    assertExists(result);
    assertEquals(result!.length, outputData.length);
  });

  it("should return null when tl_write_tags returns non-zero", () => {
    const mock = createMockWasiModule();
    mock.tl_write_tags = () => 1; // failure

    const fileData = new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0]);
    const tagData = { title: "Test" } as unknown as ExtendedTag;
    const result = writeTagsToWasm(mock, fileData, tagData);
    assertEquals(result, null);
  });

  it("should return null when output buffer pointer is 0", () => {
    const mock = createMockWasiModule();
    mock.tl_write_tags = (
      _fd: number,
      _inputPtr: number,
      _inputSize: number,
      _tagPtr: number,
      _tagSize: number,
      outBufPtr: number,
      outSizePtr: number,
    ) => {
      const view = new DataView(mock.memory.buffer);
      view.setUint32(outBufPtr, 0, true); // null pointer
      view.setUint32(outSizePtr, 0, true);
      return 0;
    };

    const fileData = new Uint8Array([0xFF, 0xFB, 0, 0, 0, 0, 0, 0]);
    const tagData = { title: "Test" } as unknown as ExtendedTag;
    assertEquals(writeTagsToWasm(mock, fileData, tagData), null);
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

/**
 * Stub that returns msgpack with both tag and audio property data.
 * Map: { "title": "Test", "sampleRate": 44100 }
 */
function stubTlReadTagsWithAudio(mock: any) {
  const DATA_PTR = 4096;
  // Hand-encoded msgpack: fixmap(2), "title"->"Test", "sampleRate"->44100
  const msgpack = new Uint8Array([
    0x82, // fixmap with 2 entries
    0xa5,
    0x74,
    0x69,
    0x74,
    0x6c,
    0x65, // fixstr "title"
    0xa4,
    0x54,
    0x65,
    0x73,
    0x74, // fixstr "Test"
    0xaa,
    0x73,
    0x61,
    0x6d,
    0x70,
    0x6c,
    0x65,
    0x52,
    0x61,
    0x74,
    0x65, // fixstr "sampleRate"
    0xcd,
    0xac,
    0x44, // uint16 44100
  ]);
  return (
    _pathPtr: number,
    _bufPtr: number,
    _bufSize: number,
    outSizePtr: number,
  ) => {
    const heap = new Uint8Array(mock.memory.buffer);
    const view = new DataView(mock.memory.buffer);
    heap.set(msgpack, DATA_PTR);
    view.setUint32(outSizePtr, msgpack.length, true);
    return DATA_PTR;
  };
}
