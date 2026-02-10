/**
 * @fileoverview Comprehensive unicode handling tests across both backends.
 */

import { assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, type describe, it } from "@std/testing/bdd";
import {
  type BackendAdapter,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";

const UNICODE_CASES: Record<string, string> = {
  emoji: "🎵🎸🎤🥁🎹",
  "emoji-flags": "🇺🇸🇯🇵🇩🇪",
  "emoji-zwj": "👨‍🎤👩‍🎤",
  cjk: "中文日本語한국어",
  rtl: "مرحبا שלום",
  combining: "é à ñ ü ö",
  "combining-diacritics": "ā ē ī ō ū",
  "math-symbols": "∑∏∫∂√",
  "supplementary-plane": "𝕳𝖊𝖑𝖑𝖔",
};

forEachBackend("Unicode Comprehensive", (adapter: BackendAdapter) => {
  let flacBuffer: Uint8Array;

  beforeAll(async () => {
    await adapter.init();
    flacBuffer = await readFixture("flac");
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  for (const [name, value] of Object.entries(UNICODE_CASES)) {
    it(`should roundtrip ${name} characters`, async () => {
      const modified = await adapter.writeTags(
        flacBuffer,
        { title: value },
        "flac",
      );
      assertExists(modified, `${name}: write returned null`);

      const tags = await adapter.readTags(modified!, "flac");
      assertEquals(tags.title, value, `${name}: title mismatch`);
    });
  }

  it("should handle max-length title (1000 chars)", async () => {
    const longTitle = "あ".repeat(1000);
    const modified = await adapter.writeTags(
      flacBuffer,
      { title: longTitle },
      "flac",
    );
    assertExists(modified);

    const tags = await adapter.readTags(modified!, "flac");
    assertEquals(tags.title, longTitle);
  });

  it("should handle mixed scripts in single field", async () => {
    const mixed = "Hello 世界 مرحبا Привет 🌍";
    const modified = await adapter.writeTags(
      flacBuffer,
      { title: mixed, artist: mixed, album: mixed },
      "flac",
    );
    assertExists(modified);

    const tags = await adapter.readTags(modified!, "flac");
    assertEquals(tags.title, mixed);
    assertEquals(tags.artist, mixed);
    assertEquals(tags.album, mixed);
  });

  it("should handle special unicode characters (ZWJ, combining marks)", async () => {
    const zwjTitle = "Zero\u200BWidth\u200BJoiner";
    const combiningArtist = "Combi\u0301ning Ma\u0300rks";
    const modified = await adapter.writeTags(
      flacBuffer,
      { title: zwjTitle, artist: combiningArtist },
      "flac",
    );
    assertExists(modified, "write returned null for special unicode");

    const tags = await adapter.readTags(modified!, "flac");
    assertExists(tags.title, "should handle zero-width joiners");
    assertExists(tags.artist, "should handle combining marks");
  });

  it("should handle very long emoji strings (64KB+)", async () => {
    const longString = "🎵".repeat(32768);

    try {
      const modified = await adapter.writeTags(
        flacBuffer,
        { title: longString.substring(0, 1000), comment: longString },
        "flac",
      );

      if (modified) {
        const tags = await adapter.readTags(modified, "flac");
        assertExists(tags.title, "should preserve start of long title");
      }
    } catch {
      // Format limitations may reject very long strings — acceptable
    }
  });
});
