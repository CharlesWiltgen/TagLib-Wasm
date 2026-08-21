/**
 * @fileoverview Batch/simple reads: includeProperties for arbitrary wire keys
 * (taglib-3s1f).
 *
 * readMetadataBatch/readTagsBatch are the one-stop read path — except for
 * keys outside the typed ExtendedTag set, which previously forced a second
 * Full-API open pass per file (tuneup's enrich.ts). includeProperties
 * surfaces raw WIRE keys on the typed read result under extraProperties,
 * without extra opens: the PropertyMap is already fetched per file on both
 * backends (WASI: open-time snapshot; Emscripten: built once per call).
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import {
  applyTags,
  readMetadata,
  readMetadataBatch,
  readTags,
  readTagsBatch,
  setBufferMode,
} from "../src/simple/index.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const RELEASE_ID = "11111111-2222-3333-4444-555555555555";

/** Seed an MP3 with one modeled and one unmodeled wire key. */
async function seedMp3(): Promise<Uint8Array> {
  const src = await Deno.readFile(FIXTURE_PATH.mp3);
  const tl = await TagLib.initialize();
  const file = await tl.open(src);
  file.setProperty("MUSICBRAINZ_RELEASEID", RELEASE_ID);
  file.setProperty("CATALOGNUMBER", "LC1234");
  file.save();
  const buf = file.getFileBuffer();
  file.dispose();
  return buf;
}

function runScenarios(): void {
  it("readMetadataBatch: modeled + unmodeled wire keys in extraProperties, absent keys omitted", async () => {
    const seeded = await seedMp3();
    const { items } = await readMetadataBatch([seeded], {
      includeProperties: ["MUSICBRAINZ_RELEASEID", "CATALOGNUMBER", "NOPE"],
    });
    const item = items[0];
    if (item.status === "error") throw item.error;
    assertEquals(item.data.tags.extraProperties, {
      MUSICBRAINZ_RELEASEID: [RELEASE_ID],
      CATALOGNUMBER: ["LC1234"],
    });
  });

  it("readTagsBatch: same option surfaces extras per item", async () => {
    const seeded = await seedMp3();
    const { items } = await readTagsBatch([seeded], {
      includeProperties: ["CATALOGNUMBER"],
    });
    const item = items[0];
    if (item.status === "error") throw item.error;
    assertEquals(item.data.extraProperties, { CATALOGNUMBER: ["LC1234"] });
  });

  it("readTags (single-file): same option, same field", async () => {
    const seeded = await seedMp3();
    const tags = await readTags(seeded, {
      includeProperties: ["CATALOGNUMBER", "NOPE"],
    });
    assertEquals(tags.extraProperties, { CATALOGNUMBER: ["LC1234"] });
  });

  it("readMetadata (single-file): same option, same field", async () => {
    const seeded = await seedMp3();
    const meta = await readMetadata(seeded, {
      includeProperties: ["CATALOGNUMBER"],
    });
    assertEquals(meta.tags.extraProperties, { CATALOGNUMBER: ["LC1234"] });
  });

  it("without the option extraProperties is absent", async () => {
    const seeded = await seedMp3();
    const tags = await readTags(seeded);
    assertEquals(tags.extraProperties, undefined);
    const { items } = await readMetadataBatch([seeded]);
    const item = items[0];
    if (item.status === "error") throw item.error;
    assertEquals(item.data.tags.extraProperties, undefined);
  });

  it("readTags -> applyTags round-trip never writes EXTRAPROPERTIES", async () => {
    const seeded = await seedMp3();
    const tags = await readTags(seeded, {
      includeProperties: ["CATALOGNUMBER"],
    });
    const out = await applyTags(seeded, tags);
    const again = await readTags(out);
    assertEquals(again.extraProperties, undefined);
    // The wire must not carry a synthetic key.
    const tl = await TagLib.initialize();
    const file = await tl.open(out);
    const props = file.properties();
    file.dispose();
    assertEquals(
      (props as Record<string, string[]>).EXTRAPROPERTIES,
      undefined,
    );
    // The unmodeled key itself must survive the round-trip.
    const after = await readTags(out, { includeProperties: ["CATALOGNUMBER"] });
    assertEquals(after.extraProperties, { CATALOGNUMBER: ["LC1234"] });
  });
}

describe("includeProperties (taglib-3s1f) [wasi]", () => {
  setBufferMode(false);
  runScenarios();
});

describe("includeProperties (taglib-3s1f) [emscripten]", () => {
  setBufferMode(true);
  runScenarios();
});
