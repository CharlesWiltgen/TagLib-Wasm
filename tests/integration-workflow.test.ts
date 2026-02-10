/**
 * @fileoverview Integration workflow tests simulating real user scenarios.
 */

import { assertEquals, assertExists, assertGreater } from "@std/assert";
import { afterAll, beforeAll, type describe, it } from "@std/testing/bdd";
import {
  type BackendAdapter,
  extForFormat,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";
import { type Format, FORMATS } from "./shared-fixtures.ts";

forEachBackend("Integration Workflows", (adapter: BackendAdapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  it("library scan: read tags from all 5 formats", async () => {
    const results: Record<string, string> = {};

    for (const format of FORMATS) {
      const buffer = await readFixture(format);
      const tags = await adapter.readTags(buffer, extForFormat(format));
      results[format] = tags.title;
    }

    assertEquals(Object.keys(results).length, 5);
    for (const format of FORMATS) {
      assertEquals(results[format], "Kiss", `${format}: wrong title`);
    }
  });

  it("tag editor: read → modify → save → verify", async () => {
    const buffer = await readFixture("mp3");

    // Read original
    const original = await adapter.readTags(buffer, "mp3");
    assertEquals(original.title, "Kiss");

    // Modify
    const modified = await adapter.writeTags(
      buffer,
      {
        title: "Modified Kiss",
        artist: "Modified Artist",
        year: 2026,
      },
      "mp3",
    );
    assertExists(modified);

    // Verify persistence
    const readBack = await adapter.readTags(modified!, "mp3");
    assertEquals(readBack.title, "Modified Kiss");
    assertEquals(readBack.artist, "Modified Artist");
    assertEquals(readBack.year, 2026);
  });

  it("batch processing: process all formats sequentially", async () => {
    const processed: string[] = [];

    for (const format of FORMATS) {
      const buffer = await readFixture(format);
      const tags = await adapter.readTags(buffer, extForFormat(format));
      const props = await adapter.readAudioProperties(
        buffer,
        extForFormat(format),
      );

      assertExists(tags.title);
      assertGreater(props.sampleRate, 0);
      processed.push(format);
    }

    assertEquals(processed.length, 5);
  });

  it("format converter metadata: read from one format, write to another", async () => {
    // Read tags from MP3
    const mp3Buffer = await readFixture("mp3");
    const mp3Tags = await adapter.readTags(mp3Buffer, "mp3");

    // Write those tags to FLAC
    const flacBuffer = await readFixture("flac");
    const modified = await adapter.writeTags(
      flacBuffer,
      {
        title: mp3Tags.title,
        artist: mp3Tags.artist,
        album: mp3Tags.album,
      },
      "flac",
    );
    assertExists(modified);

    // Verify the FLAC file has the MP3's metadata
    const flacTags = await adapter.readTags(modified!, "flac");
    assertEquals(flacTags.title, mp3Tags.title);
    assertEquals(flacTags.artist, mp3Tags.artist);
    assertEquals(flacTags.album, mp3Tags.album);
  });
});
