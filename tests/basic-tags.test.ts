/**
 * @fileoverview Parameterized basic tag tests across both backends.
 */

import { assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, type describe, it } from "@std/testing/bdd";
import {
  type BackendAdapter,
  extForFormat,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";
import { EXPECTED_KISS_TAGS, type Format, FORMATS } from "./shared-fixtures.ts";

forEachBackend("Basic Tags", (adapter: BackendAdapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  for (const format of FORMATS) {
    it(`should read tags from ${format}`, async () => {
      const buffer = await readFixture(format);
      const tags = await adapter.readTags(buffer, extForFormat(format));

      assertExists(tags.title, `${format}: title missing`);
      assertEquals(tags.title, EXPECTED_KISS_TAGS.title);
    });
  }

  for (const format of FORMATS) {
    it(`should write and read back tags (${format})`, async () => {
      const buffer = await readFixture(format);
      const newTags = {
        title: "Test Title",
        artist: "Test Artist",
        album: "Test Album",
      };

      const modified = await adapter.writeTags(
        buffer,
        newTags,
        extForFormat(format),
      );
      assertExists(modified, `${format}: writeTags returned null`);

      const readBack = await adapter.readTags(
        modified!,
        extForFormat(format),
      );
      assertEquals(readBack.title, "Test Title");
      assertEquals(readBack.artist, "Test Artist");
      assertEquals(readBack.album, "Test Album");
    });
  }

  it("should overwrite existing tags with new values", async () => {
    const buffer = await readFixture("mp3");
    const modified = await adapter.writeTags(
      buffer,
      { title: "Replaced", artist: "New Artist", album: "New Album" },
      "mp3",
    );
    assertExists(modified);

    const readBack = await adapter.readTags(modified!, "mp3");
    assertEquals(readBack.title, "Replaced");
    assertEquals(readBack.artist, "New Artist");
    assertEquals(readBack.album, "New Album");
  });

  it("should handle unicode tags", async () => {
    const buffer = await readFixture("flac");
    const unicodeTags = {
      title: "日本語タイトル",
      artist: "Артист",
      album: "专辑",
    };

    const modified = await adapter.writeTags(
      buffer,
      unicodeTags,
      "flac",
    );
    assertExists(modified);

    const readBack = await adapter.readTags(modified!, "flac");
    assertEquals(readBack.title, unicodeTags.title);
    assertEquals(readBack.artist, unicodeTags.artist);
    assertEquals(readBack.album, unicodeTags.album);
  });
});
