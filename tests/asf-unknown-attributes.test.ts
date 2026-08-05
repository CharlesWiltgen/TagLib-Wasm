/**
 * @fileoverview ASF unknown-attribute support (taglib-984r).
 *
 * ASF::Tag::setProperties returns untranslated keys as ignoredProps (never
 * written) and properties() reports untranslated attributes as unsupported
 * data (never surfaced) — so ReplayGain/ITUNESADVISORY/R128 on WMA were
 * silently dropped, and the WASI same-handle read echoed the write back
 * (optimistic cache). The shim now writes ignored keys as real ASF
 * attributes and reports unsupported ones on read.
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
const OTHER: Record<string, "wasi" | "emscripten"> = {
  wasi: "emscripten",
  emscripten: "wasi",
};

async function roundTrip(
  writeBackend: "wasi" | "emscripten",
  props: Record<string, string[]>,
): Promise<{
  readBack: Record<string, string[]>;
  sameHandle: Record<string, string[]>;
}> {
  const src = await Deno.readFile(FIXTURE_PATH.wma);
  const tl = await TagLib.initialize({ forceWasmType: writeBackend });
  const file = await tl.open(new Uint8Array(src));
  file.setProperties({ ...props });
  file.save();
  const buf = file.getFileBuffer();
  const sameHandle = file.properties() as Record<string, string[]>;
  file.dispose();

  const tlR = await TagLib.initialize({ forceWasmType: OTHER[writeBackend] });
  const reopened = await tlR.open(buf);
  const readBack = reopened.properties() as Record<string, string[]>;
  reopened.dispose();
  return { readBack, sameHandle };
}

describe("ASF unknown attributes (taglib-984r)", () => {
  for (const backend of BACKENDS) {
    it(`[${backend}] unknown attributes round-trip to disk and read truthfully`, async () => {
      const props = {
        replayGainTrackGain: ["-3.00 dB"],
        "X-CUSTOM-TAG": ["1"],
        "X-CUSTOM-ATTRIBUTE": ["custom-value"],
      };
      const { readBack, sameHandle } = await roundTrip(backend, props);

      // Disk truth (read by the OTHER backend): nothing dropped.
      assertEquals(readBack.replayGainTrackGain, ["-3.00 dB"]);
      assertEquals(readBack["X-CUSTOM-TAG"], ["1"]);
      assertEquals(readBack["X-CUSTOM-ATTRIBUTE"], ["custom-value"]);

      // Same-handle read (WASI cache echo) must agree with disk.
      assertEquals(sameHandle.replayGainTrackGain, ["-3.00 dB"]);
      assertEquals(sameHandle["X-CUSTOM-TAG"], ["1"]);
    });

    it(`[${backend}] multi-value unknown attribute keeps order across a save`, async () => {
      const { readBack } = await roundTrip(backend, {
        "X-CUSTOM-TAG": ["a", "b", "c"],
      });
      assertEquals(readBack["X-CUSTOM-TAG"], ["a", "b", "c"]);
    });

    it(`[${backend}] unknown attribute removal via empty list`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ "X-CUSTOM-TAG": ["1"] });
      file.save();
      const withAttr = file.getFileBuffer();
      file.dispose();

      const tl2 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file2 = await tl2.open(withAttr);
      file2.setProperties({ "X-CUSTOM-TAG": [] });
      file2.save();
      const cleared = file2.getFileBuffer();
      file2.dispose();

      const tl3 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file3 = await tl3.open(cleared);
      const props = file3.properties() as Record<string, string[]>;
      file3.dispose();
      assertEquals(props["X-CUSTOM-TAG"], undefined);
    });

    it(`[${backend}] unknown attributes survive a no-op save`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ "X-CUSTOM-TAG": ["1"] });
      file.save();
      const once = file.getFileBuffer();
      file.dispose();

      const tl2 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file2 = await tl2.open(once);
      file2.save(); // no-op
      const twice = file2.getFileBuffer();
      file2.dispose();

      const tl3 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file3 = await tl3.open(twice);
      const props = file3.properties() as Record<string, string[]>;
      file3.dispose();
      assertEquals(props["X-CUSTOM-TAG"], ["1"]);
    });

    it(`[${backend}] lowercase-named attributes survive saves (name case normalizes)`, async () => {
      // Attribute names are preserved verbatim on READ (e.g. the Vorbis-case
      // "replaygain_track_gain" found in the wild); a WRITE normalizes the
      // name to TagLib's PropertyMap case (PropertyMap::insert uppercases).
      // The contract is no data loss: the old WASI decoder dropped lowercase
      // wire keys, so a no-op save DELETED the attribute (taglib-984r
      // review). The value must survive any number of saves, identically on
      // both backends.
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ "replaygain_track_gain": ["-3.00 dB"] });
      file.save();
      const once = file.getFileBuffer();
      file.dispose();

      const tl2 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file2 = await tl2.open(once);
      // The value is there; the name has normalized to the canonical case.
      const props2 = file2.properties() as Record<string, string[]>;
      const surviving = props2["replayGainTrackGain"] ??
        props2["replaygain_track_gain"];
      assertEquals(surviving, ["-3.00 dB"]);
      file2.save(); // no-op: must not strip the attribute
      const twice = file2.getFileBuffer();
      file2.dispose();

      const tl3 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file3 = await tl3.open(twice);
      const props = file3.properties() as Record<string, string[]>;
      file3.dispose();
      const survived = props["replayGainTrackGain"] ??
        props["replaygain_track_gain"];
      assertEquals(survived, ["-3.00 dB"]);
    });

    it(`[${backend}] read surfaces mixed-case attribute names verbatim`, async () => {
      // The fixture carries a capital-"A" "Author" attribute; the read merge
      // reports it exactly as stored, not normalized.
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      const props = file.properties() as Record<string, string[]>;
      assertEquals(props.AUTHOR, ["Prince and The Revolution"]);
      file.dispose();
    });

    it(`[${backend}] writing a key with a differently-cased on-disk attribute replaces it, not duplicates`, async () => {
      // wma-lowercase-attr.wma is a REAL wild file produced by ffmpeg: it
      // carries the Vorbis-case attribute "replaygain_track_gain". The
      // PropertyMap normalizes incoming names to upper case, so the write
      // must replace the differently-cased original, not leave a stale
      // duplicate (taglib-984r review).
      const src = await Deno.readFile(
        "tests/test-files/wma/wma-lowercase-attr.wma",
      );
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(src);
      file.setProperties({ "replaygain_track_gain": ["-9.99 dB"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const text = new TextDecoder("utf-16le").decode(buf);
      // Exactly one attribute: the canonical rewrite with the new value.
      assert(text.includes("REPLAYGAIN_TRACK_GAIN"));
      assert(!text.includes("replaygain_track_gain"));

      const tlR = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const reopened = await tlR.open(buf);
      const props = reopened.properties() as Record<string, string[]>;
      assertEquals(props.replayGainTrackGain, ["-9.99 dB"]);
      reopened.dispose();
    });
  }
});
