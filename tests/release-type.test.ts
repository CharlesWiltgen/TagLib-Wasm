/**
 * @fileoverview Typed releaseType property (taglib-ecy4).
 *
 * RELEASETYPE is translated natively by TagLib 2.3.1 on every format
 * (ID3v2 TXXX 'MusicBrainz Album Type', MP4 freeform atom, APEv2
 * MUSICBRAINZ_ALBUMTYPE, ASF 'MusicBrainz/Album Type', Vorbis/Matroska raw)
 * and round-trips as a raw property on all of them — but there was no
 * typed entry, so readTags() never surfaced it. Multi-value is legal
 * (album + EP), so the typed field is string[].
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { applyTags, readTags } from "../src/simple/index.ts";
import {
  mapPropertiesToExtendedTag,
  normalizeTagInput,
} from "../src/utils/tag-mapping.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
const OTHER: Record<string, "wasi" | "emscripten"> = {
  wasi: "emscripten",
  emscripten: "wasi",
};

describe("RELEASETYPE typed mapping (taglib-ecy4)", () => {
  it("read: raw RELEASETYPE surfaces as releaseType string[]", () => {
    const tag = mapPropertiesToExtendedTag({ RELEASETYPE: ["album", "EP"] });
    assertEquals(tag.releaseType, ["album", "EP"]);
  });

  it("write: string and string[] forms both normalize", () => {
    assertEquals(normalizeTagInput({ releaseType: "single" }).releaseType, [
      "single",
    ]);
    assertEquals(
      normalizeTagInput({ releaseType: ["album", "EP"] }).releaseType,
      ["album", "EP"],
    );
  });

  it("absent when not present", () => {
    const tag = mapPropertiesToExtendedTag({ TITLE: ["Kiss"] });
    assertEquals(tag.releaseType, undefined);
  });
});

// Wire-name byte checks per format. TXXX descriptions (MP3) and ASF
// attribute names are encoding-dependent, so those formats are covered by
// the read-back assertion only; the rest have plain-ASCII wire names.
const WIRE_BYTES: Record<string, string | undefined> = {
  m4a: "MusicBrainz Album Type",
  wv: "MUSICBRAINZ_ALBUMTYPE",
  mka: "RELEASETYPE",
  opus: "RELEASETYPE",
  flac: "RELEASETYPE",
};

async function roundTrip(
  writeBackend: "wasi" | "emscripten",
  format: keyof typeof FIXTURE_PATH & string,
): Promise<{ readBack: Record<string, string[]>; buffer: Uint8Array }> {
  const src = await Deno.readFile(
    FIXTURE_PATH[format as keyof typeof FIXTURE_PATH],
  );
  const tl = await TagLib.initialize({ forceWasmType: writeBackend });
  const file = await tl.open(new Uint8Array(src));
  file.setProperties({ RELEASETYPE: ["album", "EP"] });
  file.save();
  const buf = file.getFileBuffer();
  file.dispose();

  const tlR = await TagLib.initialize({ forceWasmType: OTHER[writeBackend] });
  const reopened = await tlR.open(buf);
  const readBack = reopened.properties() as Record<string, string[]>;
  reopened.dispose();
  return { readBack, buffer: buf };
}

describe("RELEASETYPE multi-value round-trip (taglib-ecy4)", () => {
  const FORMATS = ["mp3", "m4a", "wv", "mka", "opus", "wma", "flac"] as const;
  for (const format of FORMATS) {
    it(`${format}: album + EP survive save and read back on the other backend`, async () => {
      const { readBack, buffer } = await roundTrip("wasi", format);
      assertEquals(readBack.releaseType, ["album", "EP"]);
      const wire = WIRE_BYTES[format];
      if (wire) {
        assert(
          new TextDecoder().decode(buffer).includes(wire),
          `${format} bytes should carry ${wire}`,
        );
      }
    });
  }

  for (const backend of BACKENDS) {
    it(`[${backend}] cross-backend parity on opus (write ${backend} -> read ${OTHER[backend]})`, async () => {
      const { readBack } = await roundTrip(backend, "opus");
      assertEquals(readBack.releaseType, ["album", "EP"]);
    });
  }
});

describe("RELEASETYPE typed simple-API round-trip (taglib-ecy4)", () => {
  it("applyTags(string) -> readTags returns [string]", async () => {
    const src = await Deno.readFile(FIXTURE_PATH.opus);
    const modified = await applyTags(src, { releaseType: "single" });
    const tags = await readTags(modified);
    assertEquals(tags.releaseType, ["single"]);
  });

  it("applyTags(string[]) -> readTags returns the array verbatim", async () => {
    const src = await Deno.readFile(FIXTURE_PATH.flac);
    const modified = await applyTags(src, { releaseType: ["album", "EP"] });
    const tags = await readTags(modified);
    assertEquals(tags.releaseType, ["album", "EP"]);
  });

  it("readTags -> applyTags round-trips multi-value losslessly", async () => {
    const src = await Deno.readFile(FIXTURE_PATH.opus);
    const withType = await applyTags(src, { releaseType: ["album", "EP"] });
    const tags = await readTags(withType);
    const back = await applyTags(withType, tags);
    assertEquals((await readTags(back)).releaseType, ["album", "EP"]);
  });
});
