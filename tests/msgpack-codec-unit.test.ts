import { assertEquals, assertThrows } from "@std/assert";
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

  it("should return raw decoded for non-object", () => {
    const encoded = encode(42);
    const decoded = decodeMessagePackAuto(encoded);
    assertEquals(decoded as unknown, 42);
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
