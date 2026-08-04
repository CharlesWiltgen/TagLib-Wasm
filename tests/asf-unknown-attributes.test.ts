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

import { assertEquals } from "@std/assert";
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
        ITUNESADVISORY: ["1"],
        R128_TRACK_GAIN: ["1280"],
      };
      const { readBack, sameHandle } = await roundTrip(backend, props);

      // Disk truth (read by the OTHER backend): nothing dropped.
      assertEquals(readBack.replayGainTrackGain, ["-3.00 dB"]);
      assertEquals(readBack.ITUNESADVISORY, ["1"]);
      assertEquals(readBack.R128_TRACK_GAIN, ["1280"]);

      // Same-handle read (WASI cache echo) must agree with disk.
      assertEquals(sameHandle.replayGainTrackGain, ["-3.00 dB"]);
      assertEquals(sameHandle.ITUNESADVISORY, ["1"]);
    });

    it(`[${backend}] multi-value unknown attribute keeps order across a save`, async () => {
      const { readBack } = await roundTrip(backend, {
        ITUNESADVISORY: ["a", "b", "c"],
      });
      assertEquals(readBack.ITUNESADVISORY, ["a", "b", "c"]);
    });

    it(`[${backend}] unknown attribute removal via empty list`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ ITUNESADVISORY: ["1"] });
      file.save();
      const withAttr = file.getFileBuffer();
      file.dispose();

      const tl2 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file2 = await tl2.open(withAttr);
      file2.setProperties({ ITUNESADVISORY: [] });
      file2.save();
      const cleared = file2.getFileBuffer();
      file2.dispose();

      const tl3 = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const file3 = await tl3.open(cleared);
      const props = file3.properties() as Record<string, string[]>;
      file3.dispose();
      assertEquals(props.ITUNESADVISORY, undefined);
    });

    it(`[${backend}] unknown attributes survive a no-op save`, async () => {
      const src = await Deno.readFile(FIXTURE_PATH.wma);
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ ITUNESADVISORY: ["1"] });
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
      assertEquals(props.ITUNESADVISORY, ["1"]);
    });
  }
});
