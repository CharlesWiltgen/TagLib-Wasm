/**
 * Typed fractional BPM writes are canonicalized to an integer on both
 * backends (taglib-ory8).
 *
 * Defect: applyTags({ bpm: 120.5 }) stringified the value verbatim, so ID3v2
 * TBPM stored "120.5" while MP4's integer tmpo atom truncated it to 120 —
 * the same input producing format-divergent files. The fix narrows in
 * normalizeTagInput (the typed write path), mirroring the read side's
 * parseLeadingInt rule, so a wire "120.5" reads back as 120 and a typed
 * write of 120.5 writes "120" on every format.
 *
 * The raw wire surface is a deliberate escape hatch and is NOT narrowed —
 * verbatim raw "120.5" round-trips are pinned in property-raw-values.test.ts
 * (taglib-qpl covers the wire layer).
 *
 * Backend note: normalization happens in TS before the wire, so one write
 * produces identical bytes regardless of writer backend; the loop below is
 * that EACH backend reads the written file the same way. The mp3 instance is
 * the defect guard (pre-fix it read "120.5"); the m4a instance is a baseline
 * asserting cross-format agreement — TagLib already truncated tmpo, so it
 * could not fail on the original defect.
 */

import { assertEquals } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { applyTags, readTags } from "../src/simple/tag-operations.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
type Backend = (typeof BACKENDS)[number];

const taglibs = {} as Record<Backend, TagLib>;

beforeAll(async () => {
  for (const backend of BACKENDS) {
    taglibs[backend] = await TagLib.initialize({ forceWasmType: backend });
  }
});

/** Every property value under a BPM-ish key ("bpm" camel, "BPM", mp4 "tmpo"). */
async function readBpmValues(
  backend: Backend,
  bytes: Uint8Array,
): Promise<string[]> {
  const file = await taglibs[backend].open(bytes);
  try {
    const props = file.properties() as Record<string, string[]>;
    const values: string[] = [];
    for (const [key, value] of Object.entries(props)) {
      if (/^bpm$|^BPM$|^tmpo$/i.test(key)) values.push(...value);
    }
    return values;
  } finally {
    file.dispose();
  }
}

describe("typed fractional bpm write (taglib-ory8)", () => {
  for (const format of ["mp3", "m4a"] as const) {
    it(`canonicalizes 120.5 to integer BPM on both backends [${format}]`, async () => {
      const original = await Deno.readFile(FIXTURE_PATH[format]);
      const modified = await applyTags(original, { bpm: 120.5 });

      for (const backend of BACKENDS) {
        assertEquals(
          await readBpmValues(backend, modified),
          ["120"],
          `${backend} read a fractional BPM from a typed 120.5 write on ${format}`,
        );
      }
      // Typed surface agrees everywhere (read-side narrowing of the wire
      // value — passes pre-fix too, since 120.5 narrows to 120).
      const tags = await readTags(modified);
      assertEquals(tags.bpm, 120);
    });
  }
});
