/**
 * @fileoverview Regression tests for GitHub #23 (taglib-bk7): full ISO DATE
 * strings (e.g. "1975-10-31") must survive read/write instead of being
 * truncated to the year.
 *
 * Cross-backend: the same assertions run against BOTH the WASI and Emscripten
 * backends. The bug was WASI-only; these tests lock in parity so the public
 * `properties()` contract behaves identically regardless of backend.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { mergeTagUpdates } from "../src/utils/tag-mapping.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";
import { HAS_EMSCRIPTEN, HAS_WASI } from "./backend-adapter.ts";

const FULL_DATE = "1975-10-31";
const EXPECTED_YEAR = 1975;
const FORMATS = ["mp3", "flac", "m4a"] as const;

type WasmType = "wasi" | "emscripten";

const BACKENDS: { kind: WasmType; available: boolean }[] = [
  { kind: "wasi", available: HAS_WASI },
  { kind: "emscripten", available: HAS_EMSCRIPTEN },
];

for (const { kind, available } of BACKENDS) {
  describe({
    name: `DATE full-string round-trip [${kind}]`,
    ignore: !available,
  }, () => {
    async function open(buffer: Uint8Array) {
      const taglib = await TagLib.initialize({ forceWasmType: kind });
      return await taglib.open(buffer);
    }

    for (const format of FORMATS) {
      it(`preserves full ISO date through setProperties/properties (${format})`, async () => {
        const src = await Deno.readFile(FIXTURE_PATH[format]);

        const f1 = await open(new Uint8Array(src));
        f1.setProperties({ ...f1.properties(), date: [FULL_DATE] });
        f1.save();
        const out = new Uint8Array(f1.getFileBuffer());
        f1.dispose();

        const f2 = await open(out);
        try {
          assertEquals(
            f2.properties().date,
            [FULL_DATE],
            `${format}: date truncated`,
          );
          assertEquals(
            f2.tag().year,
            EXPECTED_YEAR,
            `${format}: year mismatch`,
          );
        } finally {
          f2.dispose();
        }
      });

      it(`preserves full date when editing an unrelated tag (${format})`, async () => {
        const src = await Deno.readFile(FIXTURE_PATH[format]);

        const f1 = await open(new Uint8Array(src));
        f1.setProperties({ ...f1.properties(), date: [FULL_DATE] });
        f1.save();
        const withDate = new Uint8Array(f1.getFileBuffer());
        f1.dispose();

        const f2 = await open(withDate);
        f2.setProperties({ ...f2.properties(), artist: ["New Artist"] });
        f2.save();
        const edited = new Uint8Array(f2.getFileBuffer());
        f2.dispose();

        const f3 = await open(edited);
        try {
          assertEquals(
            f3.properties().date,
            [FULL_DATE],
            `${format}: date lost after unrelated edit`,
          );
          assertEquals(
            f3.properties().artist,
            ["New Artist"],
            `${format}: artist not written`,
          );
        } finally {
          f3.dispose();
        }
      });
    }

    it("writes a full date via the TagInput.date field (mergeTagUpdates)", async () => {
      const src = await Deno.readFile(FIXTURE_PATH.mp3);

      const f1 = await open(new Uint8Array(src));
      mergeTagUpdates(f1, { date: FULL_DATE, artist: "Writer" });
      f1.save();
      const out = new Uint8Array(f1.getFileBuffer());
      f1.dispose();

      const f2 = await open(out);
      try {
        assertEquals(f2.properties().date, [FULL_DATE]);
        assertEquals(f2.tag().year, EXPECTED_YEAR);
      } finally {
        f2.dispose();
      }
    });

    it("tag().setYear() overrides a previously-stored full date", async () => {
      const src = await Deno.readFile(FIXTURE_PATH.mp3);

      // Store a full ISO date first.
      const f1 = await open(new Uint8Array(src));
      f1.setProperties({ ...f1.properties(), date: [FULL_DATE] });
      f1.save();
      const withDate = new Uint8Array(f1.getFileBuffer());
      f1.dispose();

      // Then set the numeric year via the Tag API — it must win, not be
      // shadowed by the stale full-date string (cross-backend parity).
      const f2 = await open(withDate);
      f2.tag().setYear(2024);
      f2.save();
      const edited = new Uint8Array(f2.getFileBuffer());
      f2.dispose();

      const f3 = await open(edited);
      try {
        assertEquals(f3.tag().year, 2024);
        assertEquals(f3.properties().date, ["2024"]);
      } finally {
        f3.dispose();
      }
    });
  });
}
