/**
 * @fileoverview Batch writes: writeTagsBatch + editTagsBatch (taglib-pmhp).
 *
 * The Simple API's read side has batch surfaces (readTagsBatch,
 * readMetadataBatch); the write side had none — consumers hand-rolled
 * open -> mutate -> saveToFile loops with per-file try/catch, status
 * counts, and abort checks. writeTagsBatch ships the same BatchOptions
 * contract (concurrency/continueOnError/onProgress/signal) for writes,
 * with per-file status, atomicity (a failed file stays pre-write), and
 * abort between files. updateFolderTags is removed in favor of this
 * surface (single batch-write convention).
 */

import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import {
  editTagsBatch,
  readTags,
  setBufferMode,
  writeTagsBatch,
} from "../src/simple/index.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

interface TempFiles {
  mp3: string;
  flac: string;
  corrupt: string;
}

async function makeTempFiles(): Promise<TempFiles> {
  const dir = await Deno.makeTempDir();
  const mp3 = `${dir}/song1.mp3`;
  const flac = `${dir}/song2.flac`;
  const corrupt = `${dir}/broken.mp3`;
  await Deno.writeFile(mp3, await Deno.readFile(FIXTURE_PATH.mp3));
  await Deno.writeFile(flac, await Deno.readFile(FIXTURE_PATH.flac));
  await Deno.writeFile(corrupt, new Uint8Array(4096)); // not audio
  return { mp3, flac, corrupt };
}

async function bytesOf(path: string): Promise<Uint8Array> {
  return await Deno.readFile(path);
}

function runScenarios(): void {
  it("writeTagsBatch applies tags to every file; ok items preserve input order", async () => {
    const { mp3, flac } = await makeTempFiles();
    const result = await writeTagsBatch([
      { path: mp3, tags: { title: "New Title" } },
      { path: flac, tags: { artist: "New Artist" } },
    ]);
    assertEquals(result.items.length, 2);
    assertEquals(result.items.every((i) => i.status === "ok"), true);
    assertEquals(result.items[0].path, mp3);
    assertEquals(result.items[1].path, flac);
    const mp3Tags = await readTags(mp3);
    const flacTags = await readTags(flac);
    assertEquals(mp3Tags.title, ["New Title"]);
    assertEquals(flacTags.artist, ["New Artist"]);
  });

  it("onProgress reports processed/total with the current file", async () => {
    const { mp3, flac } = await makeTempFiles();
    const calls: Array<[number, number, string]> = [];
    await writeTagsBatch(
      [
        { path: mp3, tags: { title: "A" } },
        { path: flac, tags: { title: "B" } },
      ],
      {
        concurrency: 1,
        onProgress: (processed, total, file) =>
          calls.push([processed, total, file]),
      },
    );
    assertEquals(calls, [
      [1, 2, mp3],
      [2, 2, flac],
    ]);
  });

  it("failed file is left in its pre-write state; others still succeed", async () => {
    const { mp3, corrupt } = await makeTempFiles();
    const before = await bytesOf(corrupt);
    const result = await writeTagsBatch([
      { path: corrupt, tags: { title: "X" } },
      { path: mp3, tags: { title: "OK" } },
    ]);
    assertEquals(result.items[0].status, "error");
    assertEquals(result.items[1].status, "ok");
    // Atomicity: the failed file's bytes are untouched.
    assertEquals(await bytesOf(corrupt), before);
    const tags = await readTags(mp3);
    assertEquals(tags.title, ["OK"]);
  });

  it("continueOnError=false rejects on the first failure", async () => {
    const { mp3, corrupt } = await makeTempFiles();
    await assertRejects(
      () =>
        writeTagsBatch(
          [
            { path: corrupt, tags: { title: "X" } },
            { path: mp3, tags: { title: "OK" } },
          ],
          { continueOnError: false },
        ),
    );
  });

  it("AbortSignal stops between files, never mid-save", async () => {
    const { mp3, flac } = await makeTempFiles();
    const flacBefore = await bytesOf(flac);
    const controller = new AbortController();
    await assertRejects(
      () =>
        writeTagsBatch(
          [
            { path: mp3, tags: { title: "First" } },
            { path: flac, tags: { title: "Second" } },
          ],
          {
            concurrency: 1,
            signal: controller.signal,
            onProgress: (processed) => {
              if (processed === 1) controller.abort();
            },
          },
        ),
      DOMException,
      "aborted",
    );
    // First file was written, second never opened: bytes unchanged.
    const tags = await readTags(mp3);
    assertEquals(tags.title, ["First"]);
    assertEquals(await bytesOf(flac), flacBefore);
  });

  it("editTagsBatch mutator variant applies per-file edits and saves", async () => {
    const { mp3, flac } = await makeTempFiles();
    const result = await editTagsBatch(
      [mp3, flac],
      (audioFile) => audioFile.tag().setTitle("Mutated"),
    );
    assertEquals(result.items.length, 2);
    assertEquals(result.items.every((i) => i.status === "ok"), true);
    const mp3Tags = await readTags(mp3);
    const flacTags = await readTags(flac);
    assertEquals(mp3Tags.title, ["Mutated"]);
    assertEquals(flacTags.title, ["Mutated"]);
  });

  it("empty input returns an empty result", async () => {
    const result = await writeTagsBatch([]);
    assertEquals(result.items, []);
  });

  // --- Post-review contracts (tuneup write-model review) ---

  it("editTagsBatch delivers the correct path per invocation under concurrency", async () => {
    const { mp3, flac } = await makeTempFiles();
    const third = `${mp3.replace("song1", "song3")}`.replace(".mp3", ".flac");
    await Deno.writeFile(third, await Deno.readFile(FIXTURE_PATH.flac));
    const seen = new Map<string, string>();
    await editTagsBatch(
      [mp3, flac, third],
      (audioFile, path) => {
        seen.set(path, "called");
        // Title is derived from the path, so an order-coupled (wrong) path
        // assignment would produce a mismatched title.
        audioFile.tag().setTitle(`title-of-${path.split("/").pop()}`);
      },
      { concurrency: 3 },
    );
    assertEquals(seen.size, 3);
    for (const path of [mp3, flac, third]) {
      const tags = await readTags(path);
      assertEquals(tags.title, [`title-of-${path.split("/").pop()}`]);
    }
  });

  it("writeTagsBatch properties: raw wire-key sets (modeled + multi-value)", async () => {
    const { mp3 } = await makeTempFiles();
    const result = await writeTagsBatch([
      {
        path: mp3,
        properties: { BARCODE: ["LC1234"], PERFORMER: ["A", "B"] },
      },
    ]);
    assertEquals(result.items[0].status, "ok");
    const tags = await readTags(mp3, {
      includeProperties: ["BARCODE", "PERFORMER"],
    });
    assertEquals(tags.extraProperties, {
      BARCODE: ["LC1234"],
      PERFORMER: ["A", "B"],
    });
  });

  it("writeTagsBatch properties: removal via empty array, no carrier", async () => {
    const { mp3 } = await makeTempFiles();
    // Seed a COMPILATION frame.
    const tl = await TagLib.initialize();
    const seed = await tl.open(mp3);
    seed.setProperty("COMPILATION", "1");
    await seed.saveToFile(mp3);
    seed.dispose();

    const result = await writeTagsBatch([
      { path: mp3, properties: { COMPILATION: [] } },
    ]);
    assertEquals(result.items[0].status, "ok");

    const reopened = await tl.open(mp3);
    const props = reopened.properties() as Record<string, string[]>;
    reopened.dispose();
    assertEquals(props.compilation, undefined); // no key, no [""] carrier
    const tags = await readTags(mp3);
    assertEquals(tags.compilation, undefined);
  });

  it("writeTagsBatch PUBLISHER+LABEL pair in a single save", async () => {
    const { mp3 } = await makeTempFiles();
    // Seed a stale legacy PUBLISHER frame.
    const tl = await TagLib.initialize();
    const seed = await tl.open(mp3);
    seed.setProperty("PUBLISHER", "Legacy");
    await seed.saveToFile(mp3);
    seed.dispose();

    const result = await writeTagsBatch([
      {
        path: mp3,
        properties: { LABEL: ["Apple"], PUBLISHER: [] },
      },
    ]);
    assertEquals(result.items[0].status, "ok");

    const reopened = await tl.open(mp3);
    const props = reopened.properties() as Record<string, string[]>;
    reopened.dispose();
    assertEquals(props.label, ["Apple"]);
    assertEquals(props.publisher, undefined); // removed, no carrier
  });

  it("writeTagsBatch combines tags + properties in one update", async () => {
    const { mp3 } = await makeTempFiles();
    const tl = await TagLib.initialize();
    const seed = await tl.open(mp3);
    seed.setProperty("COMPILATION", "1");
    await seed.saveToFile(mp3);
    seed.dispose();

    const result = await writeTagsBatch([
      {
        path: mp3,
        tags: { title: "Combined" },
        properties: { BARCODE: ["X1"], COMPILATION: [] },
      },
    ]);
    assertEquals(result.items[0].status, "ok");

    const reopened = await tl.open(mp3);
    const props = reopened.properties() as Record<string, string[]>;
    reopened.dispose();
    assertEquals(props.title, ["Combined"]);
    assertEquals(props.barcode, ["X1"]);
    assertEquals(props.compilation, undefined);
  });
}

describe("writeTagsBatch (taglib-pmhp) [wasi]", () => {
  setBufferMode(false);
  runScenarios();
});

describe("writeTagsBatch (taglib-pmhp) [emscripten]", () => {
  setBufferMode(true);
  runScenarios();
});
