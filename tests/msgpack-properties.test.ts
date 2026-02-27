/**
 * @fileoverview Property-based tests for MessagePack implementation
 *
 * Tests invariants and round-trip properties to ensure MessagePack
 * serialization/deserialization is robust and correct.
 *
 * Test run counts are chosen based on complexity and criticality:
 * - 1000 runs: Core round-trip properties (most critical)
 * - 500 runs: Audio properties (medium complexity)
 * - 100 runs: Complex operations (pictures, Unicode, size efficiency)
 * - 10 runs: Large data tests (performance considerations)
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import fc from "fast-check";
import {
  decodeAudioProperties,
  decodePicture,
  decodeTagData,
  encodeAudioProperties,
  encodePicture,
  encodeTagData,
  isValidMessagePack,
} from "../src/msgpack/index.ts";
import type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PictureType,
} from "../src/types.ts";

describe("MessagePack", () => {
  it("tag data round-trip property", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.option(fc.string(), { nil: undefined }),
          artist: fc.option(fc.string(), { nil: undefined }),
          album: fc.option(fc.string(), { nil: undefined }),
          year: fc.option(fc.integer({ min: 1900, max: 2100 }), {
            nil: undefined,
          }),
          track: fc.option(fc.integer({ min: 0, max: 999 }), {
            nil: undefined,
          }),
          genre: fc.option(fc.string(), { nil: undefined }),
          comment: fc.option(fc.string(), { nil: undefined }),
          albumArtist: fc.option(fc.string(), { nil: undefined }),
          composer: fc.option(fc.string(), { nil: undefined }),
        }),
        (tagData) => {
          const encoded = encodeTagData(tagData as unknown as ExtendedTag);
          const decoded = decodeTagData(encoded) as Record<string, unknown>;

          // Check each field preserves its value
          for (const [key, value] of Object.entries(tagData)) {
            if (value === undefined || value === null || value === "") {
              // Undefined/null/empty values should be omitted
              assert(!(key in decoded) || decoded[key] === undefined);
            } else {
              assertEquals(decoded[key], value);
            }
          }

          return true;
        },
      ),
      { numRuns: 1000 }, // High count: Most critical property
    );
  });

  it("encoding produces valid format", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string(),
          artist: fc.string(),
          year: fc.integer({ min: 0, max: 9999 }),
        }),
        (tagData) => {
          const encoded = encodeTagData(tagData as unknown as ExtendedTag);

          // Must produce non-empty Uint8Array
          assert(encoded instanceof Uint8Array);
          assert(encoded.length > 0);

          // Must be valid MessagePack
          assert(isValidMessagePack(encoded));

          return true;
        },
      ),
      { numRuns: 1000 }, // High count: Format validation is critical
    );
  });

  it("encoding is deterministic", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string(),
          artist: fc.string(),
          year: fc.integer(),
        }),
        (tagData) => {
          const encoded1 = encodeTagData(tagData as unknown as ExtendedTag);
          const encoded2 = encodeTagData(tagData as unknown as ExtendedTag);

          // Same input should produce identical output
          assertEquals(encoded1.length, encoded2.length);
          for (let i = 0; i < encoded1.length; i++) {
            assertEquals(encoded1[i], encoded2[i]);
          }

          return true;
        },
      ),
      { numRuns: 1000 }, // High count: Determinism is critical
    );
  });

  it("audio properties round-trip property", () => {
    fc.assert(
      fc.property(
        fc.record({
          duration: fc.float({ min: 0, max: 10000, noNaN: true }),
          bitrate: fc.integer({ min: 0, max: 320000 }),
          sampleRate: fc.integer({ min: 8000, max: 192000 }),
          channels: fc.integer({ min: 1, max: 8 }),
          bitsPerSample: fc.option(fc.integer({ min: 8, max: 32 }), {
            nil: undefined,
          }),
          codec: fc.option(fc.string(), { nil: undefined }),
          containerFormat: fc.option(fc.string(), { nil: undefined }),
          isLossless: fc.boolean(),
        }),
        (props) => {
          const encoded = encodeAudioProperties(props as AudioProperties);
          const decoded = decodeAudioProperties(encoded);

          // Numeric properties should be preserved exactly or very close
          if (props.duration !== undefined) {
            assert(Math.abs(decoded.duration - props.duration) < 0.001);
          }
          assertEquals(decoded.bitrate, props.bitrate);
          assertEquals(decoded.sampleRate, props.sampleRate);
          assertEquals(decoded.channels, props.channels);
          assertEquals(decoded.isLossless, props.isLossless);

          return true;
        },
      ),
      { numRuns: 500 }, // Medium count: Audio data is important but less critical than core tags
    );
  });

  it("picture round-trip property", () => {
    fc.assert(
      fc.property(
        fc.record({
          mimeType: fc.constantFrom("image/jpeg", "image/png", "image/gif"),
          data: fc.uint8Array({ minLength: 1, maxLength: 1024 }),
          type: fc.constantFrom(
            "FrontCover",
            "BackCover",
            "LeafletPage",
            "Artist",
            "BandLogo",
            "Other",
          ),
          description: fc.option(fc.string(), { nil: undefined }),
        }),
        (picture) => {
          const encoded = encodePicture(picture as Picture);
          const decoded = decodePicture(encoded);

          // All properties should be preserved
          assertEquals(decoded.mimeType, picture.mimeType);
          assertEquals(decoded.type, picture.type);
          assertEquals(decoded.description, picture.description);

          // Binary data should match exactly
          assertEquals(decoded.data.length, picture.data.length);
          for (let i = 0; i < picture.data.length; i++) {
            assertEquals(decoded.data[i], picture.data[i]);
          }

          return true;
        },
      ),
      { numRuns: 100 }, // Lower count: Binary data tests are more expensive
    );
  });

  it("large data handling", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1000, maxLength: 10000 }),
          data: fc.uint8Array({ minLength: 10000, maxLength: 100000 }),
        }),
        (input) => {
          const picture: Picture = {
            mimeType: "image/jpeg",
            data: input.data,
            type: "FrontCover" as PictureType,
            description: input.title,
          };

          const encoded = encodePicture(picture);
          const decoded = decodePicture(encoded);

          // Large data should round-trip correctly
          assertEquals(decoded.description, picture.description);
          assertEquals(decoded.data.length, picture.data.length);

          // Verify data integrity with checksum
          const checksum = (arr: Uint8Array) =>
            arr.reduce((sum, byte) => (sum + byte) % 65536, 0);

          assertEquals(checksum(decoded.data), checksum(picture.data));

          return true;
        },
      ),
      { numRuns: 10 }, // Very low count: Large data tests are expensive
    );
  });

  it("size efficiency property", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 10, maxLength: 100 }),
          artist: fc.string({ minLength: 10, maxLength: 100 }),
          album: fc.string({ minLength: 10, maxLength: 100 }),
          year: fc.integer({ min: 1900, max: 2100 }),
          track: fc.integer({ min: 1, max: 99 }),
          genre: fc.string({ minLength: 5, maxLength: 30 }),
          comment: fc.string({ minLength: 20, maxLength: 200 }),
        }),
        (tagData) => {
          const msgpackSize =
            encodeTagData(tagData as unknown as ExtendedTag).length;
          const jsonSize =
            new TextEncoder().encode(JSON.stringify(tagData)).length;

          // MessagePack should typically be smaller or similar size
          // Allow up to 20% larger for edge cases
          assert(msgpackSize <= jsonSize * 1.2);

          return true;
        },
      ),
      { numRuns: 100 }, // Medium count: Performance properties need good coverage
    );
  });

  it("empty values handling", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.constantFrom("", null, undefined),
          artist: fc.constantFrom("", null, undefined),
          year: fc.constantFrom(0, null, undefined),
        }),
        (tagData) => {
          const encoded = encodeTagData(tagData as any);
          const decoded = decodeTagData(encoded) as Record<string, unknown>;

          // Empty strings and undefined should be omitted
          // Null values are preserved
          if (tagData.title === "" || tagData.title === undefined) {
            assert(!("title" in decoded) || decoded.title === undefined);
          } else if (tagData.title === null) {
            assertEquals(decoded.title, null);
          }

          if (tagData.artist === "" || tagData.artist === undefined) {
            assert(!("artist" in decoded) || decoded.artist === undefined);
          } else if (tagData.artist === null) {
            assertEquals(decoded.artist, null);
          }

          // Zero values should be preserved
          if (tagData.year === 0) {
            assertEquals(decoded.year, 0);
          }

          return true;
        },
      ),
      { numRuns: 100 }, // Medium count: Edge cases need good coverage
    );
  });

  it("Unicode handling", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1 }), // Unicode is default in v4
          artist: fc.string({ minLength: 1 }),
          comment: fc.string({ minLength: 1 }),
        }),
        (tagData) => {
          const encoded = encodeTagData(tagData as unknown as ExtendedTag);
          const decoded = decodeTagData(encoded) as Record<string, unknown>;

          // Unicode should be preserved exactly (non-empty strings)
          assertEquals(decoded.title, tagData.title);
          assertEquals(decoded.artist, tagData.artist);
          assertEquals(decoded.comment, tagData.comment);

          return true;
        },
      ),
      { numRuns: 100 }, // Medium count: Unicode is complex but not most critical
    );
  });

  it("field order independence", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string(),
          fc.string(),
          fc.integer(),
        ),
        (inputs) => {
          const [title, artist, year] = inputs;

          // Create same data with different field order
          const data1 = { title, artist, year } as unknown as ExtendedTag;
          const data2 = { year, title, artist } as unknown as ExtendedTag;
          const data3 = { artist, year, title } as unknown as ExtendedTag;

          const decoded1 = decodeTagData(encodeTagData(data1)) as Record<
            string,
            unknown
          >;
          const decoded2 = decodeTagData(encodeTagData(data2)) as Record<
            string,
            unknown
          >;
          const decoded3 = decodeTagData(encodeTagData(data3)) as Record<
            string,
            unknown
          >;

          // All should produce equivalent results
          assertEquals(decoded1.title, decoded2.title);
          assertEquals(decoded2.title, decoded3.title);
          assertEquals(decoded1.artist, decoded2.artist);
          assertEquals(decoded2.artist, decoded3.artist);
          assertEquals(decoded1.year, decoded2.year);
          assertEquals(decoded2.year, decoded3.year);

          return true;
        },
      ),
      { numRuns: 100 }, // Medium count: Commutativity needs good verification
    );
  });
});
