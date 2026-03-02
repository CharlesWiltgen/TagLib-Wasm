/**
 * @fileoverview Tests for complex properties API and rating utilities
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  COMPLEX_PROPERTIES,
  COMPLEX_PROPERTY_KEY,
  type ComplexPropertyKey,
  type Rating,
} from "../src/constants/complex-properties.ts";
import {
  clamp,
  fromNormalized,
  fromPercent,
  fromPopm,
  fromStars,
  isValid,
  normalized,
  popm,
  RatingUtils,
  toNormalized,
  toPercent,
  toPopm,
  toStars,
} from "../src/utils/rating.ts";

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

describe("Rating Utilities", () => {
  it("toNormalized - converts POPM (0-255) to normalized (0.0-1.0)", () => {
    assertEquals(toNormalized(popm(0)), 0);
    assertEquals(toNormalized(popm(255)), 1);
    assertEquals(toNormalized(popm(128)), 128 / 255);
    assertEquals(toNormalized(popm(64)), 64 / 255);
  });

  it("fromNormalized - converts normalized to POPM with rounding", () => {
    assertEquals(fromNormalized(normalized(0)), 0);
    assertEquals(fromNormalized(normalized(1)), 255);
    assertEquals(fromNormalized(normalized(0.5)), 128); // Rounds 127.5 to 128
    assertEquals(fromNormalized(normalized(0.25)), 64); // Rounds 63.75 to 64
  });

  it("toStars - converts normalized to star rating", () => {
    // 5-star scale (default)
    assertEquals(toStars(normalized(0)), 0);
    assertEquals(toStars(normalized(0.2)), 1);
    assertEquals(toStars(normalized(0.4)), 2);
    assertEquals(toStars(normalized(0.6)), 3);
    assertEquals(toStars(normalized(0.8)), 4);
    assertEquals(toStars(normalized(1.0)), 5);

    // 10-star scale
    assertEquals(toStars(normalized(0.5), 10), 5);
    assertEquals(toStars(normalized(1.0), 10), 10);
  });

  it("fromStars - converts star rating to normalized", () => {
    // 5-star scale (default)
    assertEquals(fromStars(0), 0);
    assertEquals(fromStars(1), 0.2);
    assertEquals(fromStars(2.5), 0.5);
    assertEquals(fromStars(5), 1.0);

    // 10-star scale
    assertEquals(fromStars(5, 10), 0.5);
    assertEquals(fromStars(10, 10), 1.0);
  });

  it("toPopm - converts normalized to standard POPM values", () => {
    assertEquals(toPopm(normalized(0)), 0); // Unrated
    assertEquals(toPopm(normalized(0.2)), 1); // 1 star
    assertEquals(toPopm(normalized(0.4)), 64); // 2 stars
    assertEquals(toPopm(normalized(0.6)), 128); // 3 stars
    assertEquals(toPopm(normalized(0.8)), 196); // 4 stars
    assertEquals(toPopm(normalized(1.0)), 255); // 5 stars
  });

  it("fromPopm - converts POPM to normalized star levels", () => {
    assertEquals(fromPopm(popm(0)), 0); // Unrated
    assertEquals(fromPopm(popm(1)), 0.2); // 1 star
    assertEquals(fromPopm(popm(64)), 0.4); // 2 stars
    assertEquals(fromPopm(popm(128)), 0.6); // 3 stars
    assertEquals(fromPopm(popm(196)), 0.8); // 4 stars
    assertEquals(fromPopm(popm(255)), 1.0); // 5 stars

    // In-between values should map to lower star level
    assertEquals(fromPopm(popm(50)), 0.4); // Still 2 stars
    assertEquals(fromPopm(popm(100)), 0.6); // Still 3 stars
    assertEquals(fromPopm(popm(200)), 1.0); // 5 stars (>196)
  });

  it("toPercent - converts normalized to percentage", () => {
    assertEquals(toPercent(normalized(0)), 0);
    assertEquals(toPercent(normalized(0.5)), 50);
    assertEquals(toPercent(normalized(1.0)), 100);
    assertEquals(toPercent(normalized(0.75)), 75);
  });

  it("fromPercent - converts percentage to normalized", () => {
    assertEquals(fromPercent(0), 0);
    assertEquals(fromPercent(50), 0.5);
    assertEquals(fromPercent(100), 1.0);
    assertEquals(fromPercent(75), 0.75);
  });

  it("clamp - clamps values to 0.0-1.0 range", () => {
    assertEquals(clamp(0.5), 0.5);
    assertEquals(clamp(0), 0);
    assertEquals(clamp(1), 1);
    assertEquals(clamp(-0.5), 0);
    assertEquals(clamp(1.5), 1);
    assertEquals(clamp(-100), 0);
    assertEquals(clamp(100), 1);
  });

  it("isValid - validates rating values", () => {
    assertEquals(isValid(0), true);
    assertEquals(isValid(0.5), true);
    assertEquals(isValid(1), true);
    assertEquals(isValid(-0.1), false);
    assertEquals(isValid(1.1), false);
    assertEquals(isValid(NaN), false);
  });

  it("RatingUtils namespace - exports all utilities", () => {
    assertExists(RatingUtils.normalized);
    assertExists(RatingUtils.popm);
    assertExists(RatingUtils.toNormalized);
    assertExists(RatingUtils.fromNormalized);
    assertExists(RatingUtils.toStars);
    assertExists(RatingUtils.fromStars);
    assertExists(RatingUtils.toPopm);
    assertExists(RatingUtils.fromPopm);
    assertExists(RatingUtils.toPercent);
    assertExists(RatingUtils.fromPercent);
    assertExists(RatingUtils.clamp);
    assertExists(RatingUtils.isValid);
    assertExists(RatingUtils.POPM_STAR_VALUES);
  });
});

describe("Roundtrip Tests", () => {
  it("normalized roundtrip - precision preserved", () => {
    for (let i = 0; i <= 255; i++) {
      const nr = toNormalized(popm(i));
      const recovered = fromNormalized(nr);
      assertEquals(recovered, i);
    }
  });

  it("stars roundtrip - whole stars preserved", () => {
    for (let stars = 0; stars <= 5; stars++) {
      const nr = fromStars(stars);
      const recovered = toStars(nr);
      assertEquals(recovered, stars);
    }
  });

  it("POPM star mapping roundtrip", () => {
    const popmValues = [0, 1, 64, 128, 196, 255];
    for (const p of popmValues) {
      const nr = fromPopm(popm(p));
      const recovered = toPopm(nr);
      assertEquals(recovered, p);
    }
  });
});

describe("Rating Interface", () => {
  it("Rating interface - type compatibility", () => {
    const minRating: Rating = { rating: 0.8 };
    assertEquals(minRating.rating, 0.8);
    assertEquals(minRating.email, undefined);
    assertEquals(minRating.counter, undefined);

    const fullRating: Rating = {
      rating: 0.8,
      email: "user@example.com",
      counter: 42,
    };
    assertEquals(fullRating.rating, 0.8);
    assertEquals(fullRating.email, "user@example.com");
    assertEquals(fullRating.counter, 42);
  });
});
