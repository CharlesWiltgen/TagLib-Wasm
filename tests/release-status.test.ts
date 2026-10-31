/**
 * @fileoverview Typed releaseStatus property.
 *
 * RELEASESTATUS is translated natively by TagLib 2.3.2 on every format
 * (ID3v2 TXXX 'MusicBrainz Album Status', MP4 freeform atom, APEv2
 * MUSICBRAINZ_ALBUMSTATUS, ASF 'MusicBrainz/Album Status', Vorbis/Matroska
 * raw) and round-trips as a raw property on all of them — but there was no
 * typed entry, so readTags() never surfaced it and callers had to know the
 * per-format names. The write aliases MUSICBRAINZ_ALBUMSTATUS and
 * "MusicBrainz Album Status" normalize to RELEASESTATUS, so carrying an
 * APEv2-style name cannot mint a nonstandard field on FLAC or MP4.
 */

import { describe, expect, it } from "vite-plus/test";
import { readFile } from "node:fs/promises";
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

describe("RELEASESTATUS typed mapping", () => {
  it("read: raw RELEASESTATUS surfaces as releaseStatus string[]", () => {
    const tag = mapPropertiesToExtendedTag({ RELEASESTATUS: ["Official"] });
    expect(tag.releaseStatus).toStrictEqual(["Official"]);
  });

  it("write: string and string[] forms both normalize", () => {
    expect(
      normalizeTagInput({ releaseStatus: "Official" }).releaseStatus,
    ).toStrictEqual(["Official"]);
    expect(
      normalizeTagInput({ releaseStatus: ["Official", "Promotion"] })
        .releaseStatus,
    ).toStrictEqual(["Official", "Promotion"]);
  });

  it("absent when not present", () => {
    const tag = mapPropertiesToExtendedTag({ TITLE: ["Kiss"] });
    expect(tag.releaseStatus).toStrictEqual(undefined);
  });
});

// Wire-name byte checks per format. TXXX descriptions (MP3) and ASF
// attribute names are encoding-dependent, so those formats are covered by
// the read-back assertion only; the rest have plain-ASCII wire names.
const WIRE_BYTES: Record<string, string | undefined> = {
  m4a: "MusicBrainz Album Status",
  wv: "MUSICBRAINZ_ALBUMSTATUS",
  mka: "RELEASESTATUS",
  opus: "RELEASESTATUS",
  flac: "RELEASESTATUS",
};

async function roundTrip(
  writeBackend: "wasi" | "emscripten",
  format: keyof typeof FIXTURE_PATH & string,
): Promise<{ readBack: Record<string, string[]>; buffer: Uint8Array }> {
  const src = new Uint8Array(
    await readFile(FIXTURE_PATH[format as keyof typeof FIXTURE_PATH]),
  );
  const tl = await TagLib.initialize({ forceWasmType: writeBackend });
  const file = await tl.open(new Uint8Array(src));
  file.setProperties({ releaseStatus: ["Official"] });
  file.save();
  const buf = file.getFileBuffer();
  file.dispose();

  const tlR = await TagLib.initialize({ forceWasmType: OTHER[writeBackend] });
  const reopened = await tlR.open(buf);
  const readBack = reopened.properties() as Record<string, string[]>;
  reopened.dispose();
  return { readBack, buffer: buf };
}

describe("RELEASESTATUS round-trip (typed camel key)", () => {
  const FORMATS = ["mp3", "m4a", "wv", "mka", "opus", "wma", "flac"] as const;
  for (const backend of BACKENDS) {
    for (const format of FORMATS) {
      it(`[${backend}] ${format}: Official survives save and reads back on the other backend`, async () => {
        const { readBack, buffer } = await roundTrip(backend, format);
        expect(readBack.releaseStatus).toStrictEqual(["Official"]);
        const wire = WIRE_BYTES[format];
        if (wire) {
          expect(
            new TextDecoder().decode(buffer).includes(wire),
            `${format} bytes should carry ${wire}`,
          ).toBeTruthy();
        }
      });
    }
  }

  for (const backend of BACKENDS) {
    it(`[${backend}] cross-backend parity on flac (write ${backend} -> read ${OTHER[backend]})`, async () => {
      const { readBack } = await roundTrip(backend, "flac");
      expect(readBack.releaseStatus).toStrictEqual(["Official"]);
    });
  }
});

describe("RELEASESTATUS typed simple-API round-trip", () => {
  it("applyTags(string) -> readTags returns [string]", async () => {
    const src = new Uint8Array(await readFile(FIXTURE_PATH.flac));
    const modified = await applyTags(src, { releaseStatus: "Official" });
    const tags = await readTags(modified);
    expect(tags.releaseStatus).toStrictEqual(["Official"]);
  });

  it("readTags -> applyTags round-trips the value losslessly", async () => {
    const src = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
    const withStatus = await applyTags(src, {
      releaseStatus: ["Official", "Promotion"],
    });
    const tags = await readTags(withStatus);
    const back = await applyTags(withStatus, tags);
    expect((await readTags(back)).releaseStatus).toStrictEqual([
      "Official",
      "Promotion",
    ]);
  });
});

describe("RELEASESTATUS write aliases normalize to the canonical key", () => {
  // The APEv2-style names are what a tool carrying raw keys is likely to
  // write. Without the alias they land as literal fields on FLAC/MP4, where
  // Picard never looks for them.
  const ALIASES = [
    "MUSICBRAINZ_ALBUMSTATUS",
    "MusicBrainz Album Status",
  ] as const;

  for (const backend of BACKENDS) {
    for (const alias of ALIASES) {
      it(`[${backend}] flac: ${alias} writes RELEASESTATUS, not the raw name`, async () => {
        const src = new Uint8Array(await readFile(FIXTURE_PATH.flac));
        const tl = await TagLib.initialize({ forceWasmType: backend });
        const file = await tl.open(new Uint8Array(src));
        file.setProperties({ [alias]: ["Official"] });
        file.save();
        const buf = file.getFileBuffer();
        file.dispose();

        const text = new TextDecoder().decode(buf);
        expect(text.includes("RELEASESTATUS")).toBe(true);
        expect(text.includes(alias)).toBe(false);

        const tlR = await TagLib.initialize({
          forceWasmType: OTHER[backend],
        });
        const reopened = await tlR.open(buf);
        expect(reopened.getProperty("releaseStatus")).toStrictEqual([
          "Official",
        ]);
        reopened.dispose();
      });
    }

    // On MP4 the canonical atom name carries the spaced form, so only the
    // underscore spelling distinguishes a raw write from a canonical one.
    it(`[${backend}] m4a: MUSICBRAINZ_ALBUMSTATUS writes the Picard freeform atom`, async () => {
      const src = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ MUSICBRAINZ_ALBUMSTATUS: ["Official"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const text = new TextDecoder().decode(buf);
      expect(text.includes("MusicBrainz Album Status")).toBe(true);
      expect(text.includes("MUSICBRAINZ_ALBUMSTATUS")).toBe(false);

      const tlR = await TagLib.initialize({
        forceWasmType: OTHER[backend],
      });
      const reopened = await tlR.open(buf);
      expect(reopened.getProperty("releaseStatus")).toStrictEqual(["Official"]);
      reopened.dispose();
    });
  }
});
