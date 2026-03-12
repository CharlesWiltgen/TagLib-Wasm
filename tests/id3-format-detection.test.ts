/**
 * @fileoverview Regression tests for GitHub #21: FLAC detected as MP3.
 *
 * When reading from buffers, TagLib's FileRef content sniffing checks
 * MPEG::File::isSupported() first, which matches any stream starting
 * with an ID3v2 header — even non-MP3 formats like FLAC and TTA.
 *
 * The fix uses magic-byte detection to skip ID3v2 headers and identify
 * the actual audio format before constructing format-specific File objects.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { afterAll, beforeAll, it } from "@std/testing/bdd";
import { type BackendAdapter, forEachBackend } from "./backend-adapter.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

forEachBackend(
  "ID3v2 Format Detection (GitHub #21)",
  (adapter: BackendAdapter) => {
    beforeAll(async () => {
      await adapter.init();
    });

    afterAll(async () => {
      await adapter.dispose();
    });

    it("should detect FLAC buffer as FLAC, not MP3", async () => {
      const buffer = await Deno.readFile(FIXTURE_PATH.flac);
      assertEquals(
        buffer[0] === 0x66 && buffer[1] === 0x4C, // "fL"
        true,
        "test fixture should start with fLaC magic",
      );
      const format = await adapter.readFormat(buffer, "flac");
      assertEquals(format, "FLAC");
    });

    it("should detect ID3v2-prefixed TTA as TTA, not MP3", async () => {
      const buffer = await Deno.readFile(FIXTURE_PATH.tta);
      assertEquals(
        buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33, // "ID3"
        true,
        "test fixture should start with ID3v2 header",
      );
      const format = await adapter.readFormat(buffer, "tta");
      assertNotEquals(
        format,
        "MP3",
        "TTA with ID3v2 prefix must not be detected as MP3",
      );
      assertEquals(format, "TTA");
    });

    it("should detect synthetic ID3v2-prefixed FLAC as FLAC", async () => {
      const flac = await Deno.readFile(FIXTURE_PATH.flac);

      // Build a minimal ID3v2.3 header (10 bytes, no frames, size=0)
      const id3Header = new Uint8Array([
        0x49,
        0x44,
        0x33, // "ID3"
        0x03,
        0x00, // version 2.3, no flags
        0x00, // flags
        0x00,
        0x00,
        0x00,
        0x00, // syncsafe size = 0
      ]);

      const prefixed = new Uint8Array(id3Header.length + flac.length);
      prefixed.set(id3Header);
      prefixed.set(flac, id3Header.length);

      const format = await adapter.readFormat(prefixed, "flac");
      assertEquals(
        format,
        "FLAC",
        "FLAC with ID3v2 prefix must be detected as FLAC",
      );
    });

    it("should still detect plain MP3 as MP3", async () => {
      const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
      const format = await adapter.readFormat(buffer, "mp3");
      assertEquals(format, "MP3");
    });
  },
);
