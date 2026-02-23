/**
 * @fileoverview Property-based roundtrip tests using fast-check.
 *
 * Proves data integrity invariants across arbitrary tag values:
 * - Roundtrip: write → read → match
 * - Idempotency: write same tags twice → same result
 */

import { afterAll, beforeAll, it } from "@std/testing/bdd";
import fc from "fast-check";
import {
  type BackendAdapter,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";

// Non-empty strings: TagLib's C API treats empty strings as "don't change"
// in some backends, so we test with actual values.
const safeString = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => !s.includes("\0"),
);

const tagRecord = fc.record({
  title: safeString,
  artist: safeString,
  album: safeString,
});

forEachBackend("Tag Roundtrip Properties", (adapter: BackendAdapter) => {
  let flacBuffer: Uint8Array;

  beforeAll(async () => {
    await adapter.init();
    flacBuffer = await readFixture("flac");
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  it("roundtrip preserves arbitrary tag values (100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(tagRecord, async (tags) => {
        const modified = await adapter.writeTags(flacBuffer, tags, "flac");
        if (!modified) return true; // skip if write not supported

        const readBack = await adapter.readTags(modified, "flac") as Record<
          string,
          unknown
        >;
        return (
          readBack.title === tags.title &&
          readBack.artist === tags.artist &&
          readBack.album === tags.album
        );
      }),
      { numRuns: 100 }, // 100 runs: balances coverage with test speed
    );
  });

  it("idempotency: writing same tags twice produces same result (50 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(tagRecord, async (tags) => {
        const first = await adapter.writeTags(flacBuffer, tags, "flac");
        if (!first) return true;

        const second = await adapter.writeTags(first, tags, "flac");
        if (!second) return true;

        const firstTags = await adapter.readTags(first, "flac") as Record<
          string,
          unknown
        >;
        const secondTags = await adapter.readTags(second, "flac") as Record<
          string,
          unknown
        >;

        return (
          firstTags.title === secondTags.title &&
          firstTags.artist === secondTags.artist &&
          firstTags.album === secondTags.album
        );
      }),
      { numRuns: 50 }, // 50 runs: each iteration does 2 writes + 2 reads
    );
  });

  it("roundtrip with numeric tags (50 runs)", async () => {
    // year=0 and track=0 are treated as "unset" by some backends
    const numericTags = fc.record({
      title: safeString,
      year: fc.integer({ min: 1, max: 9999 }),
      track: fc.integer({ min: 1, max: 999 }),
    });

    await fc.assert(
      fc.asyncProperty(numericTags, async (tags) => {
        const modified = await adapter.writeTags(flacBuffer, tags, "flac");
        if (!modified) return true;

        const readBack = await adapter.readTags(modified, "flac") as Record<
          string,
          unknown
        >;
        return (
          readBack.title === tags.title &&
          readBack.year === tags.year &&
          readBack.track === tags.track
        );
      }),
      { numRuns: 50 }, // 50 runs: numeric edge cases well covered
    );
  });
});
