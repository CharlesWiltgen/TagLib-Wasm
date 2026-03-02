/**
 * @fileoverview Tests for complex properties constants and metadata
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  COMPLEX_PROPERTIES,
  COMPLEX_PROPERTY_KEY,
  type ComplexPropertyKey,
} from "../src/constants/complex-properties.ts";

describe("Complex Properties Constants", () => {
  it("COMPLEX_PROPERTIES - contains expected properties", () => {
    assertExists(COMPLEX_PROPERTIES.PICTURE);
    assertExists(COMPLEX_PROPERTIES.RATING);
    assertExists(COMPLEX_PROPERTIES.LYRICS);
  });

  it("COMPLEX_PROPERTIES.PICTURE - has correct metadata", () => {
    const pic = COMPLEX_PROPERTIES.PICTURE;
    assertEquals(pic.key, "PICTURE");
    assertEquals(pic.type, "binary");
    assertEquals(pic.description, "Embedded album art or images");
    assertEquals(pic.supportedFormats.includes("ID3v2"), true);
    assertEquals(pic.supportedFormats.includes("MP4"), true);
    assertExists(pic.mappings.id3v2);
    if (typeof pic.mappings.id3v2 === "object") {
      assertEquals(pic.mappings.id3v2.frame, "APIC");
    }
  });

  it("COMPLEX_PROPERTIES.RATING - has correct metadata", () => {
    const rating = COMPLEX_PROPERTIES.RATING;
    assertEquals(rating.key, "RATING");
    assertEquals(rating.type, "object");
    assertEquals(rating.description, "Track rating (normalized 0.0-1.0)");
    assertEquals(rating.supportedFormats.includes("ID3v2"), true);
    assertEquals(rating.supportedFormats.includes("Vorbis"), true);
    assertEquals(rating.supportedFormats.includes("MP4"), true);
    assertExists(rating.mappings.id3v2);
    if (typeof rating.mappings.id3v2 === "object") {
      assertEquals(rating.mappings.id3v2.frame, "POPM");
    }
    assertEquals(rating.mappings.vorbis, "RATING");
  });

  it("COMPLEX_PROPERTIES.LYRICS - has correct metadata", () => {
    const lyrics = COMPLEX_PROPERTIES.LYRICS;
    assertEquals(lyrics.key, "LYRICS");
    assertEquals(lyrics.type, "object");
    assertEquals(lyrics.supportedFormats.includes("ID3v2"), true);
    assertExists(lyrics.mappings.id3v2);
    if (typeof lyrics.mappings.id3v2 === "object") {
      assertEquals(lyrics.mappings.id3v2.frame, "USLT");
    }
  });

  it("COMPLEX_PROPERTY_KEY - provides simple key access", () => {
    assertEquals(COMPLEX_PROPERTY_KEY.PICTURE, "PICTURE");
    assertEquals(COMPLEX_PROPERTY_KEY.RATING, "RATING");
    assertEquals(COMPLEX_PROPERTY_KEY.LYRICS, "LYRICS");

    const key: ComplexPropertyKey = COMPLEX_PROPERTY_KEY.RATING;
    assertEquals(key, "RATING");
  });
});
