/**
 * @fileoverview Read-side alias layer (taglib-7ru2).
 *
 * Legacy/common wire names resolve to the canonical property:
 *   ALBUM ARTIST/ALBUM_ARTIST -> albumArtist
 *   ORGANIZATION/PUBLISHER    -> label
 *   UPC/EAN/GTIN              -> barcode
 *   TOTALTRACKS/TOTALDISCS    -> totalTracks/totalDiscs
 *   MUSICBRAINZ_ALBUMTYPE     -> releaseType
 *   MUSICBRAINZ_ALBUMSTATUS   -> releaseStatus
 *   CONTENTADVISORY/EXPLICIT  -> itunesAdvisory
 *   DATE then YEAR as fallback (typed surface only; YEAR stays raw on
 *   properties() so raw round-trips are byte-stable)
 * Writes through setProperties/setProperty normalize alias names to the
 * canonical wire key, so both backends behave identically.
 *
 * Real legacy-name files are built by byte-surgery on the FLAC fixture:
 * FLAC metadata blocks carry no CRC, so inserting Vorbis comment fields is
 * safe and exact.
 */

import { describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TagLib } from "../src/taglib.ts";
import { remapKeysFromTagLib } from "../src/constants/properties.ts";
import { applyTags, readTags, writeTagsBatch } from "../src/simple/index.ts";
import { mapPropertiesToExtendedTag } from "../src/utils/tag-mapping.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
const OTHER: Record<string, "wasi" | "emscripten"> = {
  wasi: "emscripten",
  emscripten: "wasi",
};

/** Insert Vorbis comments into (or remove them from) a FLAC file's
 * VORBIS_COMMENT metadata block. FLAC metadata has no CRC, so the patch is
 * byte-exact. */
function patchFlacComments(
  src: Uint8Array,
  add: Array<[string, string]>,
  remove: string[],
): Uint8Array {
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  let off = 4;
  let blockHeader = -1;
  let blockLen = 0;
  while (off < src.length) {
    const h = src[off];
    const len = (src[off + 1] << 16) | (src[off + 2] << 8) | src[off + 3];
    if ((h & 0x7f) === 4) {
      blockHeader = off;
      blockLen = len;
      break;
    }
    off += 4 + len;
    if (h & 0x80) throw new Error("no vorbis comment block in fixture");
  }
  const d = blockHeader + 4;
  const vl = dv.getUint32(d, true);
  let p = d + 4 + vl;
  const count = dv.getUint32(p, true);
  p += 4;
  const fields: string[] = [];
  for (let i = 0; i < count; i++) {
    const fl = dv.getUint32(p, true);
    p += 4;
    const field = new TextDecoder().decode(src.slice(p, p + fl));
    p += fl;
    const name = field.slice(0, field.indexOf("="));
    if (!remove.includes(name)) fields.push(field);
  }
  for (const [name, value] of add) fields.push(`${name}=${value}`);

  const enc = new TextEncoder();
  const vendor = src.slice(d + 4, d + 4 + vl);
  // Block layout: vendor_len(4 LE) + vendor + count(4 LE) + [len(4 LE) + field]*.
  const vlBuf = new Uint8Array(4);
  new DataView(vlBuf.buffer).setUint32(0, vl, true);
  const chunks: Uint8Array[] = [vlBuf, vendor];
  const countBuf = new Uint8Array(4);
  new DataView(countBuf.buffer).setUint32(0, fields.length, true);
  chunks.push(countBuf);
  for (const f of fields) {
    const fb = enc.encode(f);
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, fb.length, true);
    chunks.push(lenBuf, fb);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const newBlock = new Uint8Array(total);
  let q = 0;
  for (const c of chunks) {
    newBlock.set(c, q);
    q += c.length;
  }
  if (newBlock.length > 0xffffff) throw new Error("comment block too large");

  const out = new Uint8Array(src.length - blockLen + newBlock.length);
  out.set(src.slice(0, blockHeader), 0);
  out[blockHeader] = src[blockHeader];
  out[blockHeader + 1] = (newBlock.length >> 16) & 0xff;
  out[blockHeader + 2] = (newBlock.length >> 8) & 0xff;
  out[blockHeader + 3] = newBlock.length & 0xff;
  out.set(newBlock, blockHeader + 4);
  out.set(
    src.slice(blockHeader + 4 + blockLen),
    blockHeader + 4 + newBlock.length,
  );
  return out;
}

let legacyFixture: Uint8Array | undefined;
function legacyFlac(): Promise<Uint8Array> {
  return (async () => {
    legacyFixture ??= patchFlacComments(
      new Uint8Array(await readFile(FIXTURE_PATH.flac)),
      [
        ["ALBUM ARTIST", "VA"],
        ["ORGANIZATION", "Reprise"],
        ["TOTALTRACKS", "12"],
        ["CONTENTADVISORY", "1"],
        ["MUSICBRAINZ_ALBUMTYPE", "EP"],
        ["MUSICBRAINZ_ALBUMSTATUS", "Official"],
      ],
      [],
    );
    return legacyFixture;
  })();
}

let yearOnlyFixture: Uint8Array | undefined;
function yearOnlyFlac(): Promise<Uint8Array> {
  return (async () => {
    yearOnlyFixture ??= patchFlacComments(
      new Uint8Array(await readFile(FIXTURE_PATH.flac)),
      [["YEAR", "1986"]],
      ["DATE"],
    );
    return yearOnlyFixture;
  })();
}

describe("alias resolution units (taglib-7ru2)", () => {
  it("remapKeysFromTagLib resolves every alias name to its camel key", () => {
    const mapped = remapKeysFromTagLib({
      "ALBUM ARTIST": ["VA"],
      ALBUM_ARTIST: ["VA"],
      ORGANIZATION: ["Reprise"],
      PUBLISHER: ["Reprise"],
      UPC: ["093624577429"],
      EAN: ["093624577429"],
      GTIN: ["093624577429"],
      TOTALTRACKS: ["12"],
      TOTALDISCS: ["2"],
      MUSICBRAINZ_ALBUMTYPE: ["EP"],
      "MusicBrainz Album Type": ["EP"],
      MUSICBRAINZ_ALBUMSTATUS: ["Official"],
      "MusicBrainz Album Status": ["Official"],
      CONTENTADVISORY: ["1"],
    });
    expect(mapped.albumArtist).toStrictEqual(["VA"]);
    expect(mapped.label).toStrictEqual(["Reprise"]);
    expect(mapped.barcode).toStrictEqual(["093624577429"]);
    expect(mapped.totalTracks).toStrictEqual(["12"]);
    expect(mapped.totalDiscs).toStrictEqual(["2"]);
    expect(mapped.releaseType).toStrictEqual(["EP"]);
    expect(mapped.releaseStatus).toStrictEqual(["Official"]);
    expect(mapped.itunesAdvisory).toStrictEqual(["1"]);
    // EXPLICIT resolves to the same group.
    expect(
      remapKeysFromTagLib({ EXPLICIT: ["0"] }).itunesAdvisory,
    ).toStrictEqual(["0"]);
  });

  it("canonical spelling wins when both are present", () => {
    const mapped = remapKeysFromTagLib({
      ALBUMARTIST: ["Canonical"],
      "ALBUM ARTIST": ["Legacy"],
    });
    expect(mapped.albumArtist).toStrictEqual(["Canonical"]);
  });

  it("typed map resolves aliases and consumes YEAR", () => {
    const tag = mapPropertiesToExtendedTag({
      "ALBUM ARTIST": ["VA"],
      TOTALTRACKS: ["12"],
      CONTENTADVISORY: ["1"],
      YEAR: ["1986"],
    } as never);
    expect(tag.albumArtist).toStrictEqual(["VA"]);
    expect(tag.totalTracks).toStrictEqual(12);
    expect(tag.itunesAdvisory).toStrictEqual(["1"]);
    expect(tag.year).toStrictEqual(1986);
    expect(tag.date).toStrictEqual("1986");
    expect((tag as Record<string, unknown>)["YEAR"]).toStrictEqual(undefined);
  });

  it("DATE wins over YEAR when both present", () => {
    // The pipeline hands the typed map camelized keys (date) plus raw
    // pass-through keys (YEAR).
    const tag = mapPropertiesToExtendedTag({
      date: ["2020-05-05"],
      YEAR: ["1986"],
    } as never);
    expect(tag.year).toStrictEqual(2020);
    expect(tag.date).toStrictEqual("2020-05-05");
  });
});

describe("legacy-name FLAC read on both backends (taglib-7ru2)", () => {
  for (const backend of BACKENDS) {
    it(`[${backend}] legacy fields resolve to the typed surface`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await legacyFlac());
      const tag = mapPropertiesToExtendedTag(file.properties());
      expect(tag.albumArtist).toStrictEqual(["VA"]);
      expect(tag.label).toStrictEqual(["Reprise"]);
      expect(tag.totalTracks).toStrictEqual(12);
      expect(tag.itunesAdvisory).toStrictEqual(["1"]);
      expect(tag.releaseType).toStrictEqual(["EP"]);
      expect(tag.releaseStatus).toStrictEqual(["Official"]);
      expect(tag.year).toStrictEqual(1986); // from DATE=1986-03-25
      file.dispose();
    });

    it(`[${backend}] properties() presents canonical camel keys`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await legacyFlac());
      const props = file.properties() as Record<string, string[]>;
      expect(props.albumArtist).toStrictEqual(["VA"]);
      expect(props.label).toStrictEqual(["Reprise"]);
      expect(props.totalTracks).toStrictEqual(["12"]);
      expect(props.itunesAdvisory).toStrictEqual(["1"]);
      expect(props.releaseType).toStrictEqual(["EP"]);
      expect(props["MUSICBRAINZ_ALBUMSTATUS"]).toStrictEqual(undefined);
      expect(props.releaseStatus).toStrictEqual(["Official"]);
      expect(props["ALBUM ARTIST"]).toStrictEqual(undefined);
      file.dispose();
    });

    it(`[${backend}] YEAR fallback works on a real DATE-less file`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await yearOnlyFlac());
      const tag = mapPropertiesToExtendedTag(file.properties());
      expect(tag.year).toStrictEqual(1986);
      expect(tag.date).toStrictEqual("1986");
      // The property surface keeps the raw YEAR key (byte-stable).
      const props = file.properties() as Record<string, string[]>;
      expect(props.YEAR).toStrictEqual(["1986"]);
      expect(props.date).toStrictEqual(undefined);
      file.dispose();
    });
  }
});

describe("write normalization (taglib-7ru2)", () => {
  for (const backend of BACKENDS) {
    it(`[${backend}] setProperties with an alias name writes the canonical key`, async () => {
      const src = new Uint8Array(await readFile(FIXTURE_PATH.flac));
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperties({ "ALBUM ARTIST": ["VA"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const text = new TextDecoder().decode(buf);
      expect(text.includes("ALBUMARTIST=VA")).toBeTruthy();
      expect(!text.includes("ALBUM ARTIST=VA")).toBeTruthy();

      const tlR = await TagLib.initialize({ forceWasmType: OTHER[backend] });
      const reopened = await tlR.open(buf);
      const props = reopened.properties() as Record<string, string[]>;
      expect(props.albumArtist).toStrictEqual(["VA"]);
      reopened.dispose();
    });

    it(`[${backend}] getProperty resolves an alias name`, async () => {
      const src = new Uint8Array(await readFile(FIXTURE_PATH.flac));
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(new Uint8Array(src));
      file.setProperty("TOTALTRACKS", "12");
      expect(file.getProperty("TOTALTRACKS")?.[0]).toStrictEqual("12");
      expect(file.getProperty("totalTracks")?.[0]).toStrictEqual("12");
      file.dispose();
    });
  }
});

describe("typed write canonicalizes a legacy APEv2-named comment", () => {
  // Consumer flow: a source FLAC carries the APEv2-style names an older tool
  // wrote. A typed batch write must leave ONE canonical field, not a
  // duplicate — no direct raw property write/clear is needed.
  const CASES = [
    {
      legacy: "MUSICBRAINZ_ALBUMTYPE",
      typed: "releaseType",
      canonical: "RELEASETYPE",
      value: "Album",
    },
    {
      legacy: "MUSICBRAINZ_ALBUMSTATUS",
      typed: "releaseStatus",
      canonical: "RELEASESTATUS",
      value: "Official",
    },
  ] as const;

  for (const backend of BACKENDS) {
    for (const { legacy, typed, canonical, value } of CASES) {
      it(`[${backend}] ${legacy} disappears after a typed ${typed} write`, async () => {
        const dir = await mkdtemp(join(tmpdir(), "taglib-alias-"));
        try {
          const path = join(dir, "legacy.flac");
          const src = patchFlacComments(
            new Uint8Array(await readFile(FIXTURE_PATH.flac)),
            [[legacy, value]],
            [],
          );
          await writeFile(path, src);
          await TagLib.initialize({ forceWasmType: backend });
          const tags =
            typed === "releaseType"
              ? { releaseType: [value] }
              : { releaseStatus: [value] };
          const result = await writeTagsBatch([{ path, tags }], {
            concurrency: 1,
          });
          expect(result.items[0].status).toStrictEqual("ok");

          const buf = new Uint8Array(await readFile(path));
          const text = new TextDecoder().decode(buf);
          expect(text.includes(legacy), `${legacy} should be gone`).toBe(false);
          expect(text.includes(canonical), `${canonical} expected`).toBe(true);

          const readBack = await readTags(buf);
          expect((readBack as Record<string, unknown>)[typed]).toStrictEqual([
            value,
          ]);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    }
  }
});

describe("typed write replaces a pre-existing RELEASETYPE value", () => {
  // The reported symptom: a FLAC source whose legacy comment reads
  // RELEASETYPE=Compilation must come back with only the new value. This is
  // the disk writer; applyTags(path) intentionally returns bytes and never
  // touches the file, so a caller using it sees the old field survive.
  for (const backend of BACKENDS) {
    it(`[${backend}] Compilation is replaced and the APEv2 duplicate removed`, async () => {
      const dir = await mkdtemp(join(tmpdir(), "taglib-alias-"));
      try {
        const path = join(dir, "legacy.flac");
        const src = patchFlacComments(
          new Uint8Array(await readFile(FIXTURE_PATH.flac)),
          [
            ["RELEASETYPE", "Compilation"],
            ["MUSICBRAINZ_ALBUMTYPE", "Compilation"],
          ],
          [],
        );
        await writeFile(path, src);
        await TagLib.initialize({ forceWasmType: backend });
        const result = await writeTagsBatch(
          [{ path, tags: { releaseType: ["Album"] } }],
          { concurrency: 1 },
        );
        expect(result.items[0].status).toStrictEqual("ok");

        const buf = new Uint8Array(await readFile(path));
        const text = new TextDecoder().decode(buf);
        expect(text.includes("RELEASETYPE=Album")).toBe(true);
        expect(text.includes("RELEASETYPE=Compilation")).toBe(false);
        expect(text.includes("MUSICBRAINZ_ALBUMTYPE")).toBe(false);

        const tags = await readTags(buf);
        expect(tags.releaseType).toStrictEqual(["Album"]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("typed round-trip with legacy names (taglib-7ru2)", () => {
  it("readTags -> applyTags preserves resolved values and canonicalizes YEAR", async () => {
    const src = await yearOnlyFlac();
    const tags = await readTags(src);
    expect(tags.year).toStrictEqual(1986);
    expect(tags.date).toStrictEqual("1986");

    const back = await applyTags(src, tags);
    const text = new TextDecoder().decode(back);
    // The typed surface canonicalizes the fallback: YEAR becomes DATE.
    expect(text.includes("DATE=1986")).toBeTruthy();
    expect(!text.includes("YEAR=1986")).toBeTruthy();
    const reread = await readTags(back);
    expect(reread.year).toStrictEqual(1986);
  });
});
