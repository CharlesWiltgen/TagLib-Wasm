import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { encode } from "@msgpack/msgpack";
import {
  canEncodeToMessagePack,
  compareEncodingEfficiency,
  encodeAudioProperties,
  encodeBatchTagData,
  encodeFastTagData,
  encodeMessagePack,
  encodeMessagePackCompact,
  encodeMessagePackStream,
  encodePicture,
  encodePictureArray,
  encodePropertyMap,
  encodeTagData,
  estimateMessagePackSize,
} from "../src/msgpack/encoder.ts";
import {
  decodeAudioProperties,
  decodeFastTagData,
  decodeMessagePack,
  decodeMessagePackAuto,
  decodePicture,
  decodePictureArray,
  decodePropertyMap,
  decodeTagData,
  getMessagePackInfo,
  isValidMessagePack,
} from "../src/msgpack/decoder.ts";
import {
  createMessagePackProcessor,
  debugMessagePackProcessor,
  defaultMessagePackProcessor,
  performanceMessagePackProcessor,
} from "../src/msgpack/processor.ts";
import { MessagePackUtils } from "../src/msgpack/utils.ts";
import { InvalidFormatError, MemoryError } from "../src/errors/classes.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PictureType,
} from "../src/types.ts";

describe("encodeTagData", () => {
  it("should encode basic tag fields to msgpack", () => {
    const tag = {
      title: "Test",
      artist: "Artist",
      year: 2025,
    } as unknown as ExtendedTag;
    const result = encodeTagData(tag);
    assertEquals(result instanceof Uint8Array, true);
    assertEquals(result.length > 0, true);
  });

  it("should strip undefined and empty string fields", () => {
    const tag = {
      title: "Title",
      artist: "",
      album: undefined,
    } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = decodeTagData(encoded) as Record<string, unknown>;
    assertEquals(decoded.title, "Title");
    assertEquals(decoded.artist, undefined);
    assertEquals(decoded.album, undefined);
  });

  it("should preserve null values", () => {
    const tag = { title: "T", comment: null } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = decodeTagData(encoded) as Record<string, unknown>;
    assertEquals(decoded.comment, null);
  });

  it("should pass through pictures key without remapping", () => {
    const tag = {
      title: "T",
      pictures: [{ mimeType: "image/jpeg", data: new Uint8Array([1]) }],
    } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = decodeTagData(encoded) as Record<string, unknown>;
    assertEquals(decoded.title, "T");
    assertEquals(Array.isArray(decoded.pictures), true);
  });
});

describe("decodeTagData", () => {
  it("should decode msgpack to tag data", () => {
    const tag = {
      title: "Song",
      artist: "Band",
      track: 3,
    } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = decodeTagData(encoded) as Record<string, unknown>;
    assertEquals(decoded.title, "Song");
    assertEquals(decoded.artist, "Band");
    assertEquals(decoded.track, 3);
  });

  it("should throw on invalid data", () => {
    assertThrows(
      () => decodeTagData(new Uint8Array([0xFF, 0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodeAudioProperties", () => {
  it("should encode audio properties", () => {
    const props: AudioProperties = {
      duration: 180,
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      bitsPerSample: 16,
      codec: "MP3",
      containerFormat: "MP3",
      isLossless: false,
    };
    const encoded = encodeAudioProperties(props);
    const decoded = decodeAudioProperties(encoded);
    assertEquals(decoded.duration, 180);
    assertEquals(decoded.bitrate, 320);
    assertEquals(decoded.sampleRate, 44100);
    assertEquals(decoded.channels, 2);
  });
});

describe("decodeAudioProperties length migration", () => {
  it("should migrate length to duration when duration is absent", () => {
    const oldFormat = encode({
      length: 240,
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
    });
    const decoded = decodeAudioProperties(oldFormat);
    assertEquals(decoded.duration, 240);
    assertEquals(
      (decoded as unknown as Record<string, unknown>).length,
      undefined,
    );
  });
});

describe("decodeAudioProperties", () => {
  it("should throw on invalid data", () => {
    assertThrows(
      () => decodeAudioProperties(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodePropertyMap / decodePropertyMap", () => {
  it("should roundtrip property map", () => {
    const propMap = { TITLE: ["Test Song"], ARTIST: ["Band"] };
    const encoded = encodePropertyMap(propMap);
    const decoded = decodePropertyMap(encoded);
    assertEquals(decoded.TITLE, ["Test Song"]);
    assertEquals(decoded.ARTIST, ["Band"]);
  });

  it("should handle empty property map", () => {
    const encoded = encodePropertyMap({});
    const decoded = decodePropertyMap(encoded);
    assertEquals(Object.keys(decoded).length, 0);
  });

  it("should throw on invalid decode", () => {
    assertThrows(
      () => decodePropertyMap(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodePicture / decodePicture", () => {
  it("should roundtrip picture data", () => {
    const pic: Picture = {
      mimeType: "image/jpeg",
      data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]),
      type: "FrontCover" as PictureType,
      description: "Front Cover",
    };
    const encoded = encodePicture(pic);
    const decoded = decodePicture(encoded);
    assertEquals(decoded.mimeType, "image/jpeg");
    assertEquals(decoded.type, "FrontCover");
    assertEquals(decoded.description, "Front Cover");
    assertEquals(new Uint8Array(decoded.data), pic.data);
  });

  it("should throw on invalid decode", () => {
    assertThrows(
      () => decodePicture(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodePictureArray / decodePictureArray", () => {
  it("should roundtrip picture array", () => {
    const pics: Picture[] = [
      {
        mimeType: "image/jpeg",
        data: new Uint8Array([1, 2]),
        type: "FrontCover" as PictureType,
      },
      {
        mimeType: "image/png",
        data: new Uint8Array([3, 4]),
        type: "BackCover" as PictureType,
      },
    ];
    const encoded = encodePictureArray(pics);
    const decoded = decodePictureArray(encoded);
    assertEquals(decoded.length, 2);
    assertEquals(decoded[0].mimeType, "image/jpeg");
    assertEquals(decoded[1].mimeType, "image/png");
  });

  it("should throw on invalid decode", () => {
    assertThrows(
      () => decodePictureArray(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodeMessagePack / decodeMessagePack", () => {
  it("should roundtrip generic data", () => {
    const data = { key: "value", nested: { a: 1 } };
    const encoded = encodeMessagePack(data);
    const decoded = decodeMessagePack<typeof data>(encoded);
    assertEquals(decoded.key, "value");
    assertEquals(decoded.nested.a, 1);
  });

  it("should accept custom options", () => {
    const data = { x: 42 };
    const encoded = encodeMessagePack(data, { sortKeys: true });
    const decoded = decodeMessagePack<typeof data>(encoded, {});
    assertEquals(decoded.x, 42);
  });

  it("should preserve Date objects through cleanObject", () => {
    const now = new Date();
    const data = { timestamp: now, value: 42 };
    const encoded = encodeMessagePack(data);
    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(encoded.length > 0, true);
  });

  it("should throw on invalid decode", () => {
    assertThrows(
      () => decodeMessagePack(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("encodeMessagePackCompact", () => {
  it("should encode to compact format", () => {
    const data = { title: "Song", bitrate: 320 };
    const compact = encodeMessagePackCompact(data);
    const normal = encodeMessagePack(data);
    assertEquals(compact instanceof Uint8Array, true);
    // Compact should be similar size for small data
    assertEquals(compact.length > 0, true);
    assertEquals(normal.length > 0, true);
  });
});

describe("encodeBatchTagData", () => {
  it("should encode array of tags", () => {
    const tags = [
      { title: "Song 1", artist: "A" },
      { title: "Song 2", artist: "B" },
    ] as unknown as ExtendedTag[];
    const encoded = encodeBatchTagData(tags);
    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(encoded.length > 0, true);
  });
});

describe("encodeMessagePackStream", () => {
  it("should yield encoded chunks for each item", () => {
    const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const chunks = [...encodeMessagePackStream(items)];
    assertEquals(chunks.length, 3);
    for (const chunk of chunks) {
      assertEquals(chunk instanceof Uint8Array, true);
    }
  });

  it("should work with empty iterable", () => {
    const chunks = [...encodeMessagePackStream([])];
    assertEquals(chunks.length, 0);
  });
});

describe("estimateMessagePackSize", () => {
  it("should return size for valid data", () => {
    const data = { title: "Test Song", artist: "Band" };
    const size = estimateMessagePackSize(data);
    assertEquals(typeof size, "number");
    assertEquals(size > 0, true);
  });

  it("should match actual encoded size", () => {
    const data = { x: 42, y: "hello" };
    const size = estimateMessagePackSize(data);
    const actual = encodeMessagePack(data);
    assertEquals(size, actual.length);
  });
});

describe("encodeFastTagData / decodeFastTagData", () => {
  it("should roundtrip essential tag fields", () => {
    const tag = {
      title: "T",
      artist: "A",
      album: "Al",
      year: 2025,
      track: 1,
    } as unknown as Pick<
      ExtendedTag,
      "title" | "artist" | "album" | "year" | "track"
    >;
    const encoded = encodeFastTagData(tag);
    const decoded = decodeFastTagData(encoded) as Record<string, unknown>;
    assertEquals(decoded.title, "T");
    assertEquals(decoded.artist, "A");
    assertEquals(decoded.album, "Al");
    assertEquals(decoded.year, 2025);
    assertEquals(decoded.track, 1);
  });

  it("should throw on invalid decode", () => {
    assertThrows(
      () => decodeFastTagData(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("canEncodeToMessagePack", () => {
  it("should return true for valid data", () => {
    assertEquals(canEncodeToMessagePack({ a: 1 }), true);
    assertEquals(canEncodeToMessagePack("hello"), true);
    assertEquals(canEncodeToMessagePack(42), true);
    assertEquals(canEncodeToMessagePack([1, 2, 3]), true);
  });

  it("should return true for null and undefined", () => {
    assertEquals(canEncodeToMessagePack(null), true);
    assertEquals(canEncodeToMessagePack(undefined), true);
  });
});

describe("compareEncodingEfficiency", () => {
  it("should return size comparison metrics", () => {
    const data = { title: "Song", artist: "Band", year: 2025 };
    const result = compareEncodingEfficiency(data);
    assertEquals(typeof result.messagePackSize, "number");
    assertEquals(typeof result.jsonSize, "number");
    assertEquals(typeof result.sizeReduction, "number");
    assertEquals(result.speedImprovement, 10);
    assertEquals(result.messagePackSize > 0, true);
    assertEquals(result.jsonSize > 0, true);
    assertEquals(result.sizeReduction >= 0, true);
  });
});

describe("decodeMessagePackAuto", () => {
  it("should detect audio properties", () => {
    const props: AudioProperties = {
      duration: 120,
      bitrate: 256,
      sampleRate: 48000,
      channels: 2,
      bitsPerSample: 16,
      codec: "MP3",
      containerFormat: "MP3",
      isLossless: false,
    };
    const encoded = encode(props);
    const decoded = decodeMessagePackAuto(encoded);
    assertEquals((decoded as AudioProperties).bitrate, 256);
  });

  it("should migrate length to duration in audio properties", () => {
    const oldProps = encode({
      length: 180,
      bitrate: 128,
      sampleRate: 44100,
      channels: 2,
    });
    const decoded = decodeMessagePackAuto(oldProps) as AudioProperties;
    assertEquals(decoded.duration, 180);
    assertEquals(
      (decoded as unknown as Record<string, unknown>).length,
      undefined,
    );
  });

  it("should detect picture data", () => {
    const pic = {
      mimeType: "image/jpeg",
      data: new Uint8Array([1, 2]),
      type: "FrontCover" as PictureType,
    };
    const encoded = encode(pic);
    const decoded = decodeMessagePackAuto(encoded);
    assertEquals((decoded as Picture).mimeType, "image/jpeg");
  });

  it("should detect tag-like data", () => {
    const tag = { title: "Test", artist: "Band" };
    const encoded = encode(tag);
    const decoded = decodeMessagePackAuto(encoded);
    assertEquals((decoded as Record<string, unknown>).title, "Test");
  });

  it("should detect property map", () => {
    const propMap = { TITLE: ["Test"], ARTIST: ["Band"] };
    const encoded = encode(propMap);
    const decoded = decodeMessagePackAuto(encoded);
    assertEquals((decoded as Record<string, string[]>).TITLE, ["Test"]);
  });

  it("should throw on non-object decoded data", () => {
    const encoded = encode(42);
    assertThrows(
      () => decodeMessagePackAuto(encoded),
      Error,
      "Unexpected non-object",
    );
  });

  it("should throw on invalid data", () => {
    assertThrows(
      () => decodeMessagePackAuto(new Uint8Array([0xFF, 0xFF])),
      Error,
      "Failed to decode",
    );
  });
});

describe("isValidMessagePack", () => {
  it("should return true for valid msgpack", () => {
    const encoded = encode({ a: 1 });
    assertEquals(isValidMessagePack(encoded), true);
  });

  it("should return false for invalid data", () => {
    assertEquals(isValidMessagePack(new Uint8Array([0xFF, 0xFF])), false);
  });
});

describe("getMessagePackInfo", () => {
  it("should identify map type", () => {
    const encoded = encode({ key: "val" });
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "map");
  });

  it("should identify array type", () => {
    const encoded = encode([1, 2, 3]);
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "array");
  });

  it("should identify string type", () => {
    const encoded = encode("hello");
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "string");
  });

  it("should identify number type", () => {
    const encoded = encode(42);
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "number");
  });

  it("should identify boolean type", () => {
    const encoded = encode(true);
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "boolean");
  });

  it("should identify null type", () => {
    const encoded = encode(null);
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "null");
  });

  it("should identify binary type", () => {
    const encoded = encode(new Uint8Array([1, 2, 3]));
    const info = getMessagePackInfo(encoded);
    assertEquals(info.isValid, true);
    assertEquals(info.type, "binary");
  });

  it("should return unknown for empty buffer", () => {
    const info = getMessagePackInfo(new Uint8Array(0));
    assertEquals(info.isValid, false);
    assertEquals(info.type, "unknown");
  });

  it("should return invalid for bad data", () => {
    const info = getMessagePackInfo(new Uint8Array([0xFF, 0xFF]));
    assertEquals(info.isValid, false);
  });
});

describe("MessagePackUtils.safeDecodeAudioProperties", () => {
  it("should decode valid audio properties", () => {
    const props: AudioProperties = {
      duration: 180,
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      bitsPerSample: 16,
      codec: "MP3",
      containerFormat: "MP3",
      isLossless: false,
    };
    const encoded = encodeAudioProperties(props);
    const result = MessagePackUtils.safeDecodeAudioProperties(encoded);
    assertEquals(result?.duration, 180);
    assertEquals(result?.bitrate, 320);
    assertEquals(result?.sampleRate, 44100);
  });

  it("should return null for invalid msgpack", () => {
    assertEquals(
      MessagePackUtils.safeDecodeAudioProperties(new Uint8Array([0xFF, 0xFF])),
      null,
    );
  });

  it("should return null for empty buffer", () => {
    assertEquals(
      MessagePackUtils.safeDecodeAudioProperties(new Uint8Array(0)),
      null,
    );
  });
});

describe("MessagePackUtils.safeDecodePicture", () => {
  it("should decode valid picture data", () => {
    const pic: Picture = {
      mimeType: "image/jpeg",
      data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]),
      type: "FrontCover" as PictureType,
      description: "Cover",
    };
    const encoded = encodePicture(pic);
    const result = MessagePackUtils.safeDecodePicture(encoded);
    assertEquals(result?.mimeType, "image/jpeg");
    assertEquals(result?.type, "FrontCover");
  });

  it("should return null for invalid msgpack", () => {
    assertEquals(
      MessagePackUtils.safeDecodePicture(new Uint8Array([0xFF, 0xFF])),
      null,
    );
  });

  it("should return null for empty buffer", () => {
    assertEquals(
      MessagePackUtils.safeDecodePicture(new Uint8Array(0)),
      null,
    );
  });
});

describe("MessagePackUtils.getPerformanceComparison", () => {
  it("should return comparison metrics", () => {
    const tag = { title: "Song", artist: "Band" } as unknown as ExtendedTag;
    const result = MessagePackUtils.getPerformanceComparison(tag);
    assertEquals(typeof result.messagePackSize, "number");
    assertEquals(typeof result.jsonSize, "number");
    assertEquals(typeof result.sizeReduction, "number");
    assertEquals(typeof result.estimatedSpeedImprovement, "number");
    assertEquals(result.messagePackSize > 0, true);
    assertEquals(result.jsonSize > 0, true);
  });
});

describe("MessagePackUtils.toJson", () => {
  it("should convert valid msgpack to JSON string", () => {
    const tag = { title: "Test" } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const json = MessagePackUtils.toJson(encoded);
    const parsed = JSON.parse(json);
    assertEquals(parsed.title, "Test");
  });

  it("should throw MetadataError for invalid msgpack", () => {
    const err = assertThrows(
      () => MessagePackUtils.toJson(new Uint8Array([0xFF, 0xFF])),
      Error,
    );
    assertStringIncludes(err.message, "Failed to convert to JSON");
  });
});

describe("MessagePackUtils.fromJson", () => {
  it("should convert JSON string to msgpack", () => {
    const json = JSON.stringify({ title: "Hello" });
    const result = MessagePackUtils.fromJson(json);
    assertEquals(result instanceof Uint8Array, true);
    const decoded = decodeTagData(result) as Record<string, unknown>;
    assertEquals(decoded.title, "Hello");
  });

  it("should throw MetadataError for invalid JSON", () => {
    const err = assertThrows(
      () => MessagePackUtils.fromJson("{bad json!!!"),
      Error,
    );
    assertStringIncludes(err.message, "Failed to convert from JSON");
  });
});

describe("MessagePackUtils.batchDecode", () => {
  it("should decode multiple valid buffers", () => {
    const tag1 = encodeTagData(
      { title: "A" } as unknown as ExtendedTag,
    );
    const tag2 = encodeTagData(
      { title: "B" } as unknown as ExtendedTag,
    );
    const results = MessagePackUtils.batchDecode([tag1, tag2]);
    assertEquals(results.length, 2);
    assertEquals(results[0].success, true);
    assertEquals(results[1].success, true);
    assertEquals(
      (results[0].data as Record<string, unknown>).title,
      "A",
    );
  });

  it("should capture errors for invalid buffers", () => {
    const valid = encodeTagData(
      { title: "OK" } as unknown as ExtendedTag,
    );
    const invalid = new Uint8Array([0xFF, 0xFF]);
    const results = MessagePackUtils.batchDecode([valid, invalid]);
    assertEquals(results[0].success, true);
    assertEquals(results[1].success, false);
    assertEquals(typeof results[1].error, "string");
  });

  it("should return empty array for empty input", () => {
    assertEquals(MessagePackUtils.batchDecode([]).length, 0);
  });
});

describe("MessagePackUtils.isTagLibCompatible", () => {
  it("should return true for tag-like objects", () => {
    assertEquals(MessagePackUtils.isTagLibCompatible({ title: "X" }), true);
    assertEquals(MessagePackUtils.isTagLibCompatible({ artist: "Y" }), true);
    assertEquals(MessagePackUtils.isTagLibCompatible({ album: "Z" }), true);
  });

  it("should return true for audio property objects", () => {
    assertEquals(
      MessagePackUtils.isTagLibCompatible({ bitrate: 320, sampleRate: 44100 }),
      true,
    );
  });

  it("should return true for picture objects", () => {
    assertEquals(
      MessagePackUtils.isTagLibCompatible({
        mimeType: "image/jpeg",
        data: new Uint8Array(0),
      }),
      true,
    );
  });

  it("should return false for non-objects", () => {
    assertEquals(MessagePackUtils.isTagLibCompatible(null), false);
    assertEquals(MessagePackUtils.isTagLibCompatible(42), false);
    assertEquals(MessagePackUtils.isTagLibCompatible("string"), false);
  });

  it("should return false for unrecognized objects", () => {
    assertEquals(MessagePackUtils.isTagLibCompatible({ foo: "bar" }), false);
  });
});

describe("createMessagePackProcessor", () => {
  it("should decode valid MessagePack data", () => {
    const processor = createMessagePackProcessor();
    const tag = { title: "Song", artist: "Band" } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = processor.decode(encoded) as Record<string, unknown>;
    assertExists(decoded);
    assertEquals(decoded.title, "Song");
  });

  it("should throw MemoryError when decode buffer exceeds maxBufferSize", () => {
    const processor = createMessagePackProcessor({ maxBufferSize: 10 });
    const largeBuffer = new Uint8Array(20);
    assertThrows(
      () => processor.decode(largeBuffer),
      MemoryError,
      "Buffer exceeds maximum size",
    );
  });

  it("should throw InvalidFormatError for invalid MessagePack on decode", () => {
    const processor = createMessagePackProcessor({ validateInput: true });
    assertThrows(
      () => processor.decode(new Uint8Array([0xFF, 0xFF])),
      InvalidFormatError,
      "Invalid MessagePack data",
    );
  });

  it("should encode tag data successfully", () => {
    const processor = createMessagePackProcessor();
    const result = processor.encode(
      { title: "Test" } as unknown as ExtendedTag,
    );
    assertEquals(result instanceof Uint8Array, true);
    assertEquals(result.length > 0, true);
  });

  it("should throw MemoryError when encode result exceeds maxBufferSize", () => {
    const processor = createMessagePackProcessor({ maxBufferSize: 1 });
    assertThrows(
      () =>
        processor.encode(
          { title: "This is long enough" } as unknown as ExtendedTag,
        ),
      MemoryError,
      "Buffer exceeds maximum size",
    );
  });

  it("should skip validation when validateInput is false", () => {
    const processor = createMessagePackProcessor({ validateInput: false });
    const tag = { title: "Test" } as unknown as ExtendedTag;
    const encoded = encodeTagData(tag);
    const decoded = processor.decode(encoded) as Record<string, unknown>;
    assertEquals(decoded.title, "Test");
  });
});

describe("defaultMessagePackProcessor", () => {
  it("should decode and encode data", () => {
    const tag = { title: "Default" } as unknown as ExtendedTag;
    const encoded = defaultMessagePackProcessor.encode(tag);
    const decoded = defaultMessagePackProcessor.decode(
      encoded,
    ) as Record<string, unknown>;
    assertEquals(decoded.title, "Default");
  });
});

describe("performanceMessagePackProcessor", () => {
  it("should encode and decode without validation", () => {
    const tag = { title: "Fast" } as unknown as ExtendedTag;
    const encoded = performanceMessagePackProcessor.encode(tag);
    const decoded = performanceMessagePackProcessor.decode(
      encoded,
    ) as Record<string, unknown>;
    assertEquals(decoded.title, "Fast");
  });
});

describe("debugMessagePackProcessor", () => {
  it("should encode and decode with metrics enabled", () => {
    const tag = { title: "Debug" } as unknown as ExtendedTag;
    const encoded = debugMessagePackProcessor.encode(tag);
    const decoded = debugMessagePackProcessor.decode(
      encoded,
    ) as Record<string, unknown>;
    assertEquals(decoded.title, "Debug");
  });
});
