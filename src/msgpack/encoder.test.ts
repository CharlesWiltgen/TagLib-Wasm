import { assert, assertEquals } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { describe, it } from "@std/testing/bdd";
import { decode } from "@msgpack/msgpack";
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
} from "./encoder.ts";
import type { ExtendedTag, Picture } from "../types.ts";

describe("encodeTagData key transformation", () => {
  it("should encode acoustidFingerprint as ACOUSTID_FINGERPRINT", () => {
    const tag = { acoustidFingerprint: "AQADtNQYhYkYRcg" } as Record<
      string,
      unknown
    >;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["ACOUSTID_FINGERPRINT"], "AQADtNQYhYkYRcg");
    assertEquals("acoustidFingerprint" in encoded, false);
  });

  it("should encode discNumber as DISCNUMBER", () => {
    const tag = { discNumber: 2 } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["DISCNUMBER"], 2);
    assertEquals("discNumber" in encoded, false);
  });

  it("should encode basic fields to UPPERCASE", () => {
    const tag = {
      title: "Test",
      artist: "Artist",
      album: "Album",
      year: 2025,
      track: 3,
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLE"], "Test");
    assertEquals(encoded["ARTIST"], "Artist");
    assertEquals(encoded["ALBUM"], "Album");
    assertEquals(encoded["DATE"], 2025);
    assertEquals(encoded["TRACKNUMBER"], 3);
  });

  it("should preserve pictures and ratings keys as-is", () => {
    const tag = {
      title: "Test",
      pictures: [{
        mimeType: "image/jpeg",
        data: new Uint8Array([1, 2, 3]),
        type: 3,
      }],
      ratings: [{ rating: 0.8, email: "", counter: 0 }],
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals("pictures" in encoded, true);
    assertEquals("ratings" in encoded, true);
  });

  it("should encode MusicBrainz fields to UPPERCASE", () => {
    const tag = {
      musicbrainzTrackId: "abc-123",
      musicbrainzReleaseId: "def-456",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["MUSICBRAINZ_TRACKID"], "abc-123");
    assertEquals(encoded["MUSICBRAINZ_ALBUMID"], "def-456");
  });

  it("should encode ReplayGain fields to UPPERCASE", () => {
    const tag = {
      replayGainTrackGain: "-6.54 dB",
      replayGainTrackPeak: "0.98765",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["REPLAYGAIN_TRACK_GAIN"], "-6.54 dB");
    assertEquals(encoded["REPLAYGAIN_TRACK_PEAK"], "0.98765");
  });

  it("should encode sort fields to UPPERCASE", () => {
    const tag = {
      titleSort: "Title, The",
      artistSort: "Beatles, The",
      albumSort: "Abbey Road",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLESORT"], "Title, The");
    assertEquals(encoded["ARTISTSORT"], "Beatles, The");
    assertEquals(encoded["ALBUMSORT"], "Abbey Road");
  });

  it("should pass through unknown keys as-is", () => {
    const tag = { title: "Test", CUSTOM_FIELD: "value" } as Record<
      string,
      unknown
    >;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["CUSTOM_FIELD"], "value");
  });

  it("should omit empty string values via cleanObject", () => {
    const tag = { title: "Keep", artist: "", album: "Also Keep" } as Record<
      string,
      unknown
    >;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLE"], "Keep");
    assertEquals(encoded["ALBUM"], "Also Keep");
    assertEquals("ARTIST" in encoded, false);
  });

  it("should preserve null values in cleanObject", () => {
    const tag = { title: "Keep", artist: null } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLE"], "Keep");
    assertEquals(encoded["ARTIST"], null);
  });

  it("should handle nested objects in cleanObject", () => {
    const tag = {
      title: "Test",
      nested: { inner: "value", empty: "", gone: undefined },
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    const nested = encoded["nested"] as Record<string, unknown>;
    assertEquals(nested["inner"], "value");
    assertEquals("empty" in nested, false);
    assertEquals("gone" in nested, false);
  });
});

describe("encodeAudioProperties", () => {
  it("should encode audio properties to MessagePack", () => {
    const props = {
      duration: 180,
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      bitsPerSample: 16,
      codec: "MP3",
      containerFormat: "MP3",
      isLossless: false,
    };
    const result = encodeAudioProperties(
      props as unknown as Parameters<typeof encodeAudioProperties>[0],
    );
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["duration"], 180);
    assertEquals(decoded["bitrate"], 320);
    assertEquals(decoded["sampleRate"], 44100);
    assertEquals(decoded["channels"], 2);
  });
});

describe("encodePropertyMap", () => {
  it("should encode a property map to MessagePack", () => {
    const map = { TITLE: ["Test Song"], ARTIST: ["Test Artist"] };
    const result = encodePropertyMap(map);
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["TITLE"], ["Test Song"]);
    assertEquals(decoded["ARTIST"], ["Test Artist"]);
  });

  it("should handle empty property map", () => {
    const result = encodePropertyMap({});
    assertInstanceOf(result, Uint8Array);
    assertEquals(decode(result), {});
  });
});

describe("encodePicture", () => {
  it("should encode a picture with Uint8Array data", () => {
    const pic: Picture = {
      mimeType: "image/jpeg",
      data: new Uint8Array([0xFF, 0xD8, 0xFF]),
      type: "FrontCover",
    };
    const result = encodePicture(pic);
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["mimeType"], "image/jpeg");
    assertEquals(decoded["type"], "FrontCover");
  });

  it("should convert ArrayBuffer data to Uint8Array", () => {
    const arrayBuf = new Uint8Array([0xFF, 0xD8]).buffer;
    const pic = {
      mimeType: "image/png",
      data: arrayBuf,
      type: "FrontCover",
    } as unknown as Picture;
    const result = encodePicture(pic);
    assertInstanceOf(result, Uint8Array);
  });
});

describe("encodePictureArray", () => {
  it("should encode multiple pictures", () => {
    const pics: Picture[] = [
      {
        mimeType: "image/jpeg",
        data: new Uint8Array([1, 2, 3]),
        type: "FrontCover",
      },
      {
        mimeType: "image/png",
        data: new Uint8Array([4, 5, 6]),
        type: "BackCover",
      },
    ];
    const result = encodePictureArray(pics);
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Array<Record<string, unknown>>;
    assertEquals(decoded.length, 2);
    assertEquals(decoded[0]["mimeType"], "image/jpeg");
    assertEquals(decoded[1]["mimeType"], "image/png");
  });
});

describe("encodeMessagePack", () => {
  it("should encode arbitrary data with default options", () => {
    const data = { key: "value", num: 42 };
    const result = encodeMessagePack(data);
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["key"], "value");
    assertEquals(decoded["num"], 42);
  });

  it("should accept custom options", () => {
    const result = encodeMessagePack({ key: "value" }, { sortKeys: true });
    assertInstanceOf(result, Uint8Array);
  });
});

describe("encodeMessagePackCompact", () => {
  it("should encode data in compact format", () => {
    const result = encodeMessagePackCompact({ z: 1, a: 2, m: 3 });
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["a"], 2);
    assertEquals(decoded["z"], 1);
  });
});

describe("encodeBatchTagData", () => {
  it("should encode an array of tag data", () => {
    const tags = [
      { title: "Song 1", artist: "Artist 1" },
      { title: "Song 2", artist: "Artist 2" },
    ] as unknown as ExtendedTag[];
    const result = encodeBatchTagData(tags);
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as unknown[];
    assertEquals(decoded.length, 2);
  });
});

describe("encodeMessagePackStream", () => {
  it("should yield encoded chunks for each item", () => {
    const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const chunks = [...encodeMessagePackStream(items)];
    assertEquals(
      chunks.map((c) => decode(c)),
      [{ a: 1 }, { b: 2 }, { c: 3 }],
    );
  });

  it("should handle empty iterable", () => {
    const chunks = [...encodeMessagePackStream([])];
    assertEquals(chunks.length, 0);
  });
});

describe("estimateMessagePackSize", () => {
  it("should return a positive size for valid data", () => {
    const size = estimateMessagePackSize({ title: "Test", artist: "Artist" });
    assert(size > 0);
  });

  it("should return a consistent size for the same data", () => {
    const data = { title: "Test", artist: "Artist", year: 2025 };
    assertEquals(estimateMessagePackSize(data), estimateMessagePackSize(data));
  });
});

describe("encodeFastTagData", () => {
  it("should encode basic tag fields", () => {
    const result = encodeFastTagData({
      title: ["Fast"],
      artist: ["Quick"],
      album: ["Speed"],
      year: 2025,
      track: 1,
    });
    assertInstanceOf(result, Uint8Array);
    const decoded = decode(result) as Record<string, unknown>;
    assertEquals(decoded["title"], ["Fast"]);
    assertEquals(decoded["year"], 2025);
  });
});

describe("canEncodeToMessagePack", () => {
  it("should return true for encodable data", () => {
    assertEquals(canEncodeToMessagePack({ a: 1 }), true);
    assertEquals(canEncodeToMessagePack("hello"), true);
    assertEquals(canEncodeToMessagePack(42), true);
    assertEquals(canEncodeToMessagePack(null), true);
    assertEquals(canEncodeToMessagePack([1, 2, 3]), true);
  });

  it("should return false for circular references", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular["self"] = circular;
    assertEquals(canEncodeToMessagePack(circular), false);
  });
});

describe("compareEncodingEfficiency", () => {
  it("should return size comparison metrics", () => {
    const data = { title: "Test Song", artist: "Test Artist", year: 2025 };
    const result = compareEncodingEfficiency(data);
    assert(result.messagePackSize > 0);
    assert(result.jsonSize > 0);
    assert(result.sizeReduction >= 0);
    assertEquals(result.speedImprovement, 10);
  });
});
