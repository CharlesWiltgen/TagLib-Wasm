// @ts-nocheck — Bun-only file; uses bun:test and import.meta.dir
/**
 * @fileoverview Bun integration tests for taglib-wasm batch/folder APIs.
 *
 * Uses Bun's native test runner (bun:test) with Node.js-compatible file I/O.
 * Verifies readTagsBatch, readMetadataBatch, scanFolder, and write roundtrip
 * actually work under the Bun runtime.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  applyTags,
  readMetadataBatch,
  readTags,
  readTagsBatch,
  scanFolder,
} from "../index.ts";

const TEST_FILES_DIR = resolve(import.meta.dir, "test-files");

const FIXTURE_PATH = {
  mp3: resolve(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
  flac: resolve(TEST_FILES_DIR, "flac/kiss-snippet.flac"),
  ogg: resolve(TEST_FILES_DIR, "ogg/kiss-snippet.ogg"),
};

const EXPECTED_KISS_TAGS = {
  title: ["Kiss"],
  artist: ["Prince"],
  album: ["Parade - Music from the Motion Picture Under the Cherry Moon"],
} as const;

describe("readTagsBatch", () => {
  it("should read tags from multiple formats", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readTagsBatch(files);

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
    expect(typeof result.duration).toBe("number");

    for (const item of result.items) {
      if (item.status === "ok") {
        expect(item.data.title).toEqual(EXPECTED_KISS_TAGS.title);
        expect(item.data.artist).toEqual(EXPECTED_KISS_TAGS.artist);
        expect(item.data.album).toEqual(EXPECTED_KISS_TAGS.album);
      }
    }
  });

  it("should handle errors with continueOnError", async () => {
    const files = [FIXTURE_PATH.mp3, "/nonexistent/file.mp3"];
    const result = await readTagsBatch(files, { continueOnError: true });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe("ok");
    expect(result.items[1].status).toBe("error");
    expect(result.items[1].path).toBe("/nonexistent/file.mp3");
  });

  it("should respect concurrency option", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readTagsBatch(files, { concurrency: 1 });

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
  });
});

describe("readMetadataBatch", () => {
  it("should read tags and properties in single pass", async () => {
    const files = [FIXTURE_PATH.mp3, FIXTURE_PATH.flac, FIXTURE_PATH.ogg];
    const result = await readMetadataBatch(files);

    expect(result.items).toHaveLength(3);

    for (const item of result.items) {
      expect(item.status).toBe("ok");
      if (item.status === "ok") {
        expect(item.data.tags.title).toEqual(EXPECTED_KISS_TAGS.title);
        expect(item.data.properties).toBeDefined();
        expect(item.data.properties!.sampleRate).toBe(44100);
        expect(item.data.properties!.channels).toBe(2);
        expect(typeof item.data.hasCoverArt).toBe("boolean");
      }
    }
  });
});

describe("scanFolder", () => {
  it("should scan directory recursively", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,
      forceBufferMode: true,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(5);
    expect(typeof result.duration).toBe("number");

    const okItems = result.items.filter((i) => i.status === "ok");
    expect(okItems.length).toBeGreaterThanOrEqual(5);
  });

  it("should filter by extension", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      extensions: [".mp3"],
      recursive: true,
      forceBufferMode: true,
    });

    for (const item of result.items) {
      expect(item.path.endsWith(".mp3")).toBe(true);
    }
  });

  it("should respect maxFiles limit", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      maxFiles: 2,
      recursive: true,
      forceBufferMode: true,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.status === "ok")).toBe(true);
  });
});

describe("write roundtrip", () => {
  it("should persist tag changes through write/read cycle", async () => {
    const mp3Buffer = await readFile(FIXTURE_PATH.mp3);

    const modified = await applyTags(new Uint8Array(mp3Buffer), {
      title: "Modified Title",
      artist: "Modified Artist",
    });

    const tags = await readTags(new Uint8Array(modified));
    expect(tags.title).toEqual(["Modified Title"]);
    expect(tags.artist).toEqual(["Modified Artist"]);
    expect(tags.album).toEqual(EXPECTED_KISS_TAGS.album);
  });
});
