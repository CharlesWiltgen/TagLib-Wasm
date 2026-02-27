/**
 * @fileoverview Cross-backend parity tests.
 *
 * Verifies that WASI and Emscripten produce identical results for the
 * shared feature set. This is the most important validation file: if
 * parity tests pass, users can trust that switching backends is safe.
 */

import { assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  EmscriptenBackendAdapter,
  extForFormat,
  HAS_EMSCRIPTEN,
  HAS_WASI,
  readFixture,
  WasiBackendAdapter,
} from "./backend-adapter.ts";
import { type Format, FORMATS } from "./shared-fixtures.ts";

const SKIP = !HAS_WASI || !HAS_EMSCRIPTEN;

describe({ name: "Cross-Backend Parity", ignore: SKIP }, () => {
  const wasi = new WasiBackendAdapter();
  const emscripten = new EmscriptenBackendAdapter();

  beforeAll(async () => {
    await wasi.init();
    await emscripten.init();
  });

  afterAll(async () => {
    await wasi.dispose();
    await emscripten.dispose();
  });

  for (const format of FORMATS) {
    it(`should produce identical tags for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiTags = await wasi.readTags(buffer, ext);
      const emTags = await emscripten.readTags(buffer, ext);

      assertEquals(
        wasiTags.title,
        emTags.title,
        `${format}: title mismatch`,
      );
      assertEquals(
        wasiTags.artist,
        emTags.artist,
        `${format}: artist mismatch`,
      );
      assertEquals(
        wasiTags.album,
        emTags.album,
        `${format}: album mismatch`,
      );
      assertEquals(
        wasiTags.year,
        emTags.year,
        `${format}: year mismatch`,
      );
      assertEquals(
        wasiTags.track,
        emTags.track,
        `${format}: track mismatch`,
      );
    });

    it(`should produce matching properties for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiProps = await wasi.readProperties(buffer, ext);
      const emProps = await emscripten.readProperties(buffer, ext);

      assertExists(wasiProps["TITLE"], `${format}: WASI should have TITLE`);
      assertExists(emProps["TITLE"], `${format}: Emscripten should have TITLE`);
      assertEquals(
        wasiProps["TITLE"],
        emProps["TITLE"],
        `${format}: TITLE mismatch`,
      );
      assertEquals(
        wasiProps["ARTIST"],
        emProps["ARTIST"],
        `${format}: ARTIST mismatch`,
      );
    });

    it(`should produce matching format for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiFormat = await wasi.readFormat(buffer, ext);
      const emFormat = await emscripten.readFormat(buffer, ext);

      assertEquals(
        wasiFormat,
        emFormat,
        `${format}: format mismatch (wasi=${wasiFormat}, em=${emFormat})`,
      );
    });

    it(`should produce matching audio properties for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiProps = await wasi.readAudioProperties(buffer, ext);
      const emProps = await emscripten.readAudioProperties(buffer, ext);

      assertEquals(
        wasiProps.sampleRate,
        emProps.sampleRate,
        `${format}: sampleRate mismatch`,
      );
      assertEquals(
        wasiProps.channels,
        emProps.channels,
        `${format}: channels mismatch`,
      );
      // Bitrate can differ slightly due to encoding differences
      const bitrateDiff = Math.abs(wasiProps.bitrate - emProps.bitrate);
      assertEquals(
        bitrateDiff <= 10,
        true,
        `${format}: bitrate difference ${bitrateDiff} > 10 (wasi=${wasiProps.bitrate}, em=${emProps.bitrate})`,
      );
      assertEquals(
        wasiProps.duration,
        emProps.duration,
        `${format}: duration mismatch`,
      );
    });

    it(`should produce matching extended audio properties for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiProps = await wasi.readExtendedAudioProperties(buffer, ext);
      const emProps = await emscripten.readExtendedAudioProperties(buffer, ext);

      assertEquals(
        wasiProps.codec,
        emProps.codec,
        `${format}: codec mismatch`,
      );
      assertEquals(
        wasiProps.containerFormat,
        emProps.containerFormat,
        `${format}: containerFormat mismatch`,
      );
      assertEquals(
        wasiProps.isLossless,
        emProps.isLossless,
        `${format}: isLossless mismatch`,
      );
      assertEquals(
        wasiProps.bitsPerSample,
        emProps.bitsPerSample,
        `${format}: bitsPerSample mismatch`,
      );
    });

    it(`should produce matching picture count for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiCount = await wasi.readPictureCount(buffer, ext);
      const emCount = await emscripten.readPictureCount(buffer, ext);

      assertEquals(
        wasiCount,
        emCount,
        `${format}: picture count mismatch (wasi=${wasiCount}, em=${emCount})`,
      );
    });

    it(`should produce matching rating count for ${format}`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);

      const wasiCount = await wasi.readRatingCount(buffer, ext);
      const emCount = await emscripten.readRatingCount(buffer, ext);

      assertEquals(
        wasiCount,
        emCount,
        `${format}: rating count mismatch (wasi=${wasiCount}, em=${emCount})`,
      );
    });

    it(`should read WASI-written tags with Emscripten (${format})`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);
      const writtenTags = {
        title: "WASI Wrote This",
        artist: "Cross Backend",
        album: "Interop Album",
      };

      const modified = await wasi.writeTags(buffer, writtenTags, ext);
      assertExists(modified, `${format}: WASI writeTags returned null`);

      const readBack = await emscripten.readTags(modified!, ext);
      assertEquals(
        readBack.title,
        writtenTags.title,
        `${format}: Emscripten failed to read WASI-written title`,
      );
      assertEquals(
        readBack.artist,
        writtenTags.artist,
        `${format}: Emscripten failed to read WASI-written artist`,
      );
      assertEquals(
        readBack.album,
        writtenTags.album,
        `${format}: Emscripten failed to read WASI-written album`,
      );
    });

    it(`should read Emscripten-written tags with WASI (${format})`, async () => {
      const buffer = await readFixture(format);
      const ext = extForFormat(format);
      const writtenTags = {
        title: "Emscripten Wrote This",
        artist: "Cross Backend",
        album: "Interop Album",
      };

      const modified = await emscripten.writeTags(buffer, writtenTags, ext);
      assertExists(modified, `${format}: Emscripten writeTags returned null`);

      const readBack = await wasi.readTags(modified!, ext);
      assertEquals(
        readBack.title,
        writtenTags.title,
        `${format}: WASI failed to read Emscripten-written title`,
      );
      assertEquals(
        readBack.artist,
        writtenTags.artist,
        `${format}: WASI failed to read Emscripten-written artist`,
      );
      assertEquals(
        readBack.album,
        writtenTags.album,
        `${format}: WASI failed to read Emscripten-written album`,
      );
    });
  }
});
