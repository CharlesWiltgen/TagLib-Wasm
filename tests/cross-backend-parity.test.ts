/**
 * @fileoverview Cross-backend parity tests.
 *
 * Verifies that WASI and Emscripten produce identical results for the
 * shared feature set. This is the most important validation file: if
 * parity tests pass, users can trust that switching backends is safe.
 */

import { assertEquals, type assertExists } from "@std/assert";
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
        wasiProps.length,
        emProps.length,
        `${format}: length mismatch`,
      );
    });
  }
});
