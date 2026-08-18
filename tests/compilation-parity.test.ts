/**
 * @fileoverview COMPILATION boolean wire contract (taglib-c9b).
 *
 * Pinned contract: COMPILATION is "1"/"0" strings end to end on the raw
 * surface (properties(), getProperty) and a boolean on the typed surface
 * (readExtendedTag — what readTags/scanFolder use). Both backends must
 * agree: a value written by WASI reads identically on Emscripten and vice
 * versa.
 *
 * Regression (2026-08-18): the WASI FIELD_BOOLEAN branch serialized
 * COMPILATION as an mpack bool, so WASI's raw surface showed "true"/"false"
 * (String(bool)) and the typed surface read a written-true COMPILATION as
 * false. The Emscripten instances in this file are the BASELINE — the
 * defect is one-backend; every WASI assertion below failed against the
 * pre-fix binary while its Emscripten twin passed (observed 2026-08-18).
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { readExtendedTag } from "../src/utils/tag-mapping.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
const OTHER: Record<string, "wasi" | "emscripten"> = {
  wasi: "emscripten",
  emscripten: "wasi",
};

describe("COMPILATION boolean contract (taglib-c9b)", () => {
  for (const backend of BACKENDS) {
    for (const format of ["mp3", "flac", "m4a"] as const) {
      it(`${backend}: typed boolean and canonical '1'/'0' raw surface (${format})`, async () => {
        const taglib = await TagLib.initialize({ forceWasmType: backend });
        const src = await Deno.readFile(FIXTURE_PATH[format]);

        // Write true.
        using written = await taglib.open(new Uint8Array(src));
        written.setProperties({ compilation: ["1"] });
        written.save();
        const buf = written.getFileBuffer();

        using file = await taglib.open(buf);
        assertEquals(readExtendedTag(file).compilation, true);
        assertEquals(file.properties().compilation, ["1"]);
        assertEquals(file.getProperty("COMPILATION"), ["1"]);

        // Write false.
        using writtenFalse = await taglib.open(buf);
        writtenFalse.setProperties({ compilation: ["0"] });
        writtenFalse.save();
        const bufFalse = writtenFalse.getFileBuffer();

        using fileFalse = await taglib.open(bufFalse);
        assertEquals(readExtendedTag(fileFalse).compilation, false);
        assertEquals(fileFalse.properties().compilation, ["0"]);
        assertEquals(fileFalse.getProperty("COMPILATION"), ["0"]);
      });

      it(`${backend}: written bytes read identically by the other backend (${format})`, async () => {
        const taglib = await TagLib.initialize({ forceWasmType: backend });
        const src = await Deno.readFile(FIXTURE_PATH[format]);

        using written = await taglib.open(new Uint8Array(src));
        written.setProperties({ compilation: ["1"] });
        written.save();
        const buf = written.getFileBuffer();

        const other = await TagLib.initialize({
          forceWasmType: OTHER[backend],
        });
        using file = await other.open(buf);
        assertEquals(readExtendedTag(file).compilation, true);
        assertEquals(file.properties().compilation, ["1"]);
        assertEquals(file.getProperty("COMPILATION"), ["1"]);
      });

      it(`${backend}: literal 'true' COMPILATION reads as compilation=true (flac)`, async () => {
        const taglib = await TagLib.initialize({ forceWasmType: backend });
        const src = await Deno.readFile(FIXTURE_PATH.flac);

        // Non-canonical disk value: a tool wrote the literal string "true".
        // The typed surface must agree across backends — WASI's shim
        // canonicalizes to "1" at the wire, Emscripten's PropertyMap is
        // verbatim ("true"), so the mapper accepts both spellings (taglib-c9b).
        using written = await taglib.open(new Uint8Array(src));
        written.setProperty("COMPILATION", "true");
        written.save();
        const buf = written.getFileBuffer();

        using file = await taglib.open(buf);
        assertEquals(readExtendedTag(file).compilation, true);
      });
    }
  }
});
