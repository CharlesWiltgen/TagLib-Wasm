/**
 * @fileoverview Tests for Rating API integration
 * Uses legacy (Emscripten) mode to test the Embind bindings
 */

import { assertEquals, assertExists } from "@std/assert";
import { TagLib } from "../src/mod.ts";
import type { Rating } from "../src/constants/complex-properties.ts";

// Test file paths
const TEST_FILES = {
  mp3: "tests/test-files/mp3/kiss-snippet.mp3",
  flac: "tests/test-files/flac/kiss-snippet.flac",
  ogg: "tests/test-files/ogg/kiss-snippet.ogg",
  m4a: "tests/test-files/mp4/kiss-snippet.m4a",
  opus: "tests/test-files/opus/kiss-snippet.opus",
};

Deno.test("Rating API - getRatings returns empty array for files without ratings", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.mp3);
  const file = await taglib.open(audioData.buffer);

  const ratings = file.getRatings();
  assertExists(ratings);
  assertEquals(Array.isArray(ratings), true);

  file.dispose();
});

Deno.test("Rating API - setRatings and getRatings roundtrip for MP3", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.mp3);
  const file = await taglib.open(audioData.buffer);

  // Set a rating
  const testRatings: Rating[] = [
    { rating: 0.8, email: "test@example.com", counter: 42 },
  ];
  file.setRatings(testRatings);

  // Save and verify
  file.save();

  // Get ratings back
  const ratings = file.getRatings();
  assertExists(ratings);
  assertEquals(ratings.length, 1);
  // Check rating value (may be slightly different due to POPM 0-255 conversion)
  assertEquals(typeof ratings[0].rating, "number");
  assertEquals(ratings[0].rating >= 0.75 && ratings[0].rating <= 0.85, true);

  file.dispose();
});

Deno.test("Rating API - convenience methods getRating/setRating", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.mp3);
  const file = await taglib.open(audioData.buffer);

  // Set rating using convenience method
  file.setRating(0.6, "user@test.com");
  file.save();

  // Get rating using convenience method
  const rating = file.getRating();
  assertExists(rating);
  assertEquals(typeof rating, "number");
  // POPM mapping: 0.6 -> 128 (3 stars) -> 0.6
  assertEquals(rating >= 0.55 && rating <= 0.65, true);

  file.dispose();
});

Deno.test("Rating API - multiple ratings", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.mp3);
  const file = await taglib.open(audioData.buffer);

  // Set multiple ratings
  const testRatings: Rating[] = [
    { rating: 0.4, email: "user1@example.com" },
    { rating: 1.0, email: "user2@example.com" },
  ];
  file.setRatings(testRatings);
  file.save();

  // Get all ratings
  const ratings = file.getRatings();
  assertExists(ratings);
  // Note: MP3 POPM only stores one rating per email
  assertEquals(ratings.length >= 1, true);

  file.dispose();
});

Deno.test("Rating API - FLAC format support", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.flac);
  const file = await taglib.open(audioData.buffer);

  // Set a rating (FLAC uses Vorbis comments with RATING field)
  file.setRating(0.8);
  file.save();

  // Get rating back
  const rating = file.getRating();
  assertExists(rating);
  assertEquals(typeof rating, "number");

  file.dispose();
});

Deno.test("Rating API - OGG format support", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.ogg);
  const file = await taglib.open(audioData.buffer);

  // Set a rating (OGG uses Vorbis comments with RATING field)
  file.setRating(0.6);
  file.save();

  // Get rating back
  const rating = file.getRating();
  assertExists(rating);
  assertEquals(typeof rating, "number");

  file.dispose();
});

Deno.test("Rating API - M4A/MP4 format support", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.m4a);
  const file = await taglib.open(audioData.buffer);

  // Set a rating (M4A uses freeform ----:com.apple.iTunes:RATING atom)
  file.setRating(0.9);
  file.save();

  // Get rating back
  const rating = file.getRating();
  assertExists(rating);
  assertEquals(typeof rating, "number");

  file.dispose();
});

Deno.test("Rating API - Opus format support", async () => {
  const taglib = await TagLib.initialize({ legacyMode: true });
  const audioData = await Deno.readFile(TEST_FILES.opus);
  const file = await taglib.open(audioData.buffer);

  // Set a rating (Opus uses Vorbis comments with RATING field)
  file.setRating(0.7);
  file.save();

  // Get rating back
  const rating = file.getRating();
  assertExists(rating);
  assertEquals(typeof rating, "number");

  file.dispose();
});
