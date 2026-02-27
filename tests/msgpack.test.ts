/**
 * @fileoverview Tests for MessagePack integration
 *
 * Tests MessagePack encoding/decoding functionality for audio metadata,
 * performance comparisons, and integration with the C API data format.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  compareEncodingEfficiency,
  createMessagePackProcessor,
  decodeAudioProperties,
  decodeMessagePackAuto,
  decodePicture,
  decodeTagData,
  defaultMessagePackProcessor,
  encodeAudioProperties,
  encodePicture,
  encodeTagData,
  getMessagePackInfo,
  isValidMessagePack,
  MessagePackUtils,
} from "../src/msgpack/index.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PictureType,
} from "../src/types.ts";

// Test data — raw msgpack codec layer uses single strings (not arrays)
const sampleTagData = {
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  year: 2025,
  track: 5,
  genre: "Rock",
  albumArtist: "Various Artists",
  composer: "Test Composer",
} as unknown as ExtendedTag;

const sampleAudioProperties: AudioProperties = {
  duration: 180.5,
  bitrate: 320,
  sampleRate: 44100,
  channels: 2,
  bitsPerSample: 16,
  codec: "MP3",
  containerFormat: "MP3",
  isLossless: false,
};

const samplePicture: Picture = {
  mimeType: "image/jpeg",
  data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]),
  type: "FrontCover" as PictureType, // Front cover
  description: "Album cover",
};

describe("MessagePack", () => {
  it("encodeTagData - encodes tag data to MessagePack", () => {
    const encoded = encodeTagData(sampleTagData);

    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(encoded.length > 0, true);
    assertEquals(isValidMessagePack(encoded), true);
  });

  it("decodeTagData - decodes MessagePack tag data", () => {
    const encoded = encodeTagData(sampleTagData);
    const decoded = decodeTagData(encoded);

    assertEquals(decoded.title, sampleTagData.title);
    assertEquals(decoded.artist, sampleTagData.artist);
    assertEquals(decoded.album, sampleTagData.album);
    assertEquals(decoded.year, sampleTagData.year);
    assertEquals(decoded.track, sampleTagData.track);
  });

  it("encodeAudioProperties - encodes audio properties to MessagePack", () => {
    const encoded = encodeAudioProperties(sampleAudioProperties);

    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(encoded.length > 0, true);
    assertEquals(isValidMessagePack(encoded), true);
  });

  it("decodeAudioProperties - decodes MessagePack audio properties", () => {
    const encoded = encodeAudioProperties(sampleAudioProperties);
    const decoded = decodeAudioProperties(encoded);

    assertEquals(decoded.duration, sampleAudioProperties.duration);
    assertEquals(decoded.bitrate, sampleAudioProperties.bitrate);
    assertEquals(decoded.sampleRate, sampleAudioProperties.sampleRate);
    assertEquals(decoded.channels, sampleAudioProperties.channels);
    assertEquals(decoded.codec, sampleAudioProperties.codec);
  });

  it("encodePicture - encodes picture data to MessagePack", () => {
    const encoded = encodePicture(samplePicture);

    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(encoded.length > 0, true);
    assertEquals(isValidMessagePack(encoded), true);
  });

  it("decodePicture - decodes MessagePack picture data", () => {
    const encoded = encodePicture(samplePicture);
    const decoded = decodePicture(encoded);

    assertEquals(decoded.mimeType, samplePicture.mimeType);
    assertEquals(decoded.type, samplePicture.type);
    assertEquals(decoded.description, samplePicture.description);
    assertEquals(decoded.data instanceof Uint8Array, true);
    assertEquals(decoded.data.length, samplePicture.data.length);
  });

  it("decodeMessagePackAuto - automatically detects data type", () => {
    const encodedTag = encodeTagData(sampleTagData);
    const decodedTag = decodeMessagePackAuto(encodedTag);
    assertEquals(typeof decodedTag, "object");
    assertEquals((decodedTag as ExtendedTag).title, sampleTagData.title);

    const encodedAudio = encodeAudioProperties(sampleAudioProperties);
    const decodedAudio = decodeMessagePackAuto(encodedAudio);
    assertEquals(typeof decodedAudio, "object");
    assertEquals(
      (decodedAudio as AudioProperties).bitrate,
      sampleAudioProperties.bitrate,
    );
  });

  it("isValidMessagePack - validates MessagePack data", () => {
    const validData = encodeTagData(sampleTagData);
    assertEquals(isValidMessagePack(validData), true);

    const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    assertEquals(isValidMessagePack(invalidData), false);

    const emptyData = new Uint8Array(0);
    assertEquals(isValidMessagePack(emptyData), false);
  });

  it("getMessagePackInfo - provides data information", () => {
    const encoded = encodeTagData(sampleTagData);
    const info = getMessagePackInfo(encoded);

    assertEquals(info.isValid, true);
    assertEquals(info.approximateSize, encoded.length);
    assertEquals(info.type, "map"); // Tag data is object/map
  });

  it("compareEncodingEfficiency - compares MessagePack vs JSON", () => {
    const comparison = compareEncodingEfficiency(sampleTagData);

    assertEquals(comparison.messagePackSize > 0, true);
    assertEquals(comparison.jsonSize > 0, true);
    assertEquals(comparison.sizeReduction >= 0, true);
    assertEquals(comparison.speedImprovement, 10);
  });

  it("MessagePackUtils.decode - smart decode functionality", () => {
    const encodedTag = encodeTagData(sampleTagData);
    const decoded = MessagePackUtils.decode(encodedTag);

    assertEquals(typeof decoded, "object");
    assertEquals((decoded as ExtendedTag).title, sampleTagData.title);
  });

  it("MessagePackUtils.safeDecodeTagData - safe decoding with error handling", () => {
    const validEncoded = encodeTagData(sampleTagData);
    const validDecoded = MessagePackUtils.safeDecodeTagData(validEncoded);
    assertEquals(validDecoded?.title, sampleTagData.title);

    const invalidData = new Uint8Array([0x00, 0x01, 0x02]);
    const invalidDecoded = MessagePackUtils.safeDecodeTagData(invalidData);
    assertEquals(invalidDecoded, null);
  });

  it("MessagePackUtils.getPerformanceComparison - performance metrics", () => {
    const metrics = MessagePackUtils.getPerformanceComparison(sampleTagData);

    assertEquals(typeof metrics.messagePackSize, "number");
    assertEquals(typeof metrics.jsonSize, "number");
    assertEquals(typeof metrics.sizeReduction, "number");
    assertEquals(metrics.estimatedSpeedImprovement, 10);
    assertEquals(metrics.messagePackSize > 0, true);
    assertEquals(metrics.jsonSize > 0, true);
  });

  it("MessagePackUtils.toJson - convert MessagePack to JSON", () => {
    const encoded = encodeTagData(sampleTagData);
    const jsonString = MessagePackUtils.toJson(encoded);

    assertEquals(typeof jsonString, "string");
    const parsed = JSON.parse(jsonString);
    assertEquals(parsed.title, sampleTagData.title);
    assertEquals(parsed.artist, sampleTagData.artist);
  });

  it("MessagePackUtils.fromJson - convert JSON to MessagePack", () => {
    const jsonString = JSON.stringify(sampleTagData);
    const encoded = MessagePackUtils.fromJson(jsonString);

    assertEquals(encoded instanceof Uint8Array, true);
    assertEquals(isValidMessagePack(encoded), true);

    const decoded = decodeTagData(encoded);
    assertEquals(decoded.title, sampleTagData.title);
  });

  it("MessagePackUtils.batchDecode - batch processing", () => {
    const encoded1 = encodeTagData(sampleTagData);
    const encoded2 = encodeAudioProperties(sampleAudioProperties);
    const invalidData = new Uint8Array([0x00, 0x01]);

    const results = MessagePackUtils.batchDecode([
      encoded1,
      encoded2,
      invalidData,
    ]);

    assertEquals(results.length, 3);
    assertEquals(results[0].success, true);
    assertEquals(results[1].success, true);
    assertEquals(results[2].success, false);
    assertExists(results[0].data);
    assertExists(results[1].data);
    assertExists(results[2].error);
  });

  it("MessagePackUtils.isTagLibCompatible - compatibility check", () => {
    assertEquals(MessagePackUtils.isTagLibCompatible(sampleTagData), true);
    assertEquals(
      MessagePackUtils.isTagLibCompatible(sampleAudioProperties),
      true,
    );
    assertEquals(MessagePackUtils.isTagLibCompatible(samplePicture), true);
    assertEquals(
      MessagePackUtils.isTagLibCompatible({ random: "data" }),
      false,
    );
    assertEquals(MessagePackUtils.isTagLibCompatible("string"), false);
    assertEquals(MessagePackUtils.isTagLibCompatible(null), false);
  });

  it("createMessagePackProcessor - custom processor creation", () => {
    const processor = createMessagePackProcessor({
      validateInput: true,
      enableMetrics: false,
      maxBufferSize: 1024 * 1024, // 1MB
    });

    const encoded = encodeTagData(sampleTagData);
    const decoded = processor.decode(encoded);

    assertEquals(typeof decoded, "object");
    assertEquals((decoded as ExtendedTag).title, sampleTagData.title);

    const reencoded = processor.encode(sampleTagData);
    assertEquals(reencoded instanceof Uint8Array, true);
    assertEquals(isValidMessagePack(reencoded), true);
  });

  it("defaultMessagePackProcessor - default processor functionality", () => {
    const encoded = encodeTagData(sampleTagData);
    const decoded = defaultMessagePackProcessor.decode(encoded);

    assertEquals(typeof decoded, "object");
    assertEquals((decoded as ExtendedTag).title, sampleTagData.title);
  });

  it("round-trip - encode then decode preserves data", () => {
    const testCases = [
      sampleTagData,
      sampleAudioProperties,
      samplePicture,
    ];

    for (const testData of testCases) {
      const encoded = encodeTagData(testData as ExtendedTag);
      const decoded = decodeTagData(encoded);

      for (const [key, value] of Object.entries(testData)) {
        if (value !== undefined) {
          assertEquals((decoded as any)[key], value);
        }
      }
    }
  });

  it("handles special values", () => {
    const specialData = {
      title: "Test",
      year: 0, // Zero value
      track: undefined, // Undefined (should be omitted)
      comment: "", // Empty string (should be omitted)
      genre: null as any, // Null value
      albumArtist: "Valid Artist",
    } as unknown as ExtendedTag;

    const encoded = encodeTagData(specialData);
    const decoded = decodeTagData(encoded) as Record<string, unknown>;

    assertEquals(decoded.title, "Test");
    assertEquals(decoded.year, 0); // Zero should be preserved
    assertEquals(decoded.albumArtist, "Valid Artist");
    assertEquals("track" in decoded, false); // Undefined should be omitted
    assertEquals("comment" in decoded, false); // Empty string should be omitted
  });

  it("handles large binary data", () => {
    const largePicture: Picture = {
      ...samplePicture,
      data: new Uint8Array(1024 * 1024), // 1MB of data
    };

    for (let i = 0; i < largePicture.data.length; i++) {
      largePicture.data[i] = i % 256;
    }

    const encoded = encodePicture(largePicture);
    const decoded = decodePicture(encoded);

    assertEquals(decoded.data.length, largePicture.data.length);
    assertEquals(decoded.data[0], 0);
    assertEquals(decoded.data[255], 255);
    assertEquals(decoded.data[256], 0); // Pattern should repeat
  });

  it("performance comparison is reasonable", () => {
    const comparison = compareEncodingEfficiency(sampleTagData);

    assertEquals(comparison.messagePackSize <= comparison.jsonSize, true);
    assertEquals(comparison.sizeReduction >= 0, true);
    assertEquals(comparison.sizeReduction <= 90, true);
  });
});
