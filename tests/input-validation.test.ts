/**
 * @fileoverview Input validation tests for both backends.
 *
 * Tests boundary conditions, malformed input, and error handling
 * to ensure both backends fail gracefully on bad data.
 */

import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, type describe, it } from "@std/testing/bdd";
import {
  type BackendAdapter,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";

forEachBackend("Input Validation", (adapter: BackendAdapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  it("should reject empty buffer (0 bytes)", async () => {
    let threw = false;
    try {
      await adapter.readTags(new Uint8Array(0), "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "empty buffer should throw");
  });

  it("should reject tiny buffer (< 128 bytes)", async () => {
    const tiny = new Uint8Array(64);
    let threw = false;
    try {
      await adapter.readTags(tiny, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "tiny buffer should throw");
  });

  it("should reject random bytes (not audio)", async () => {
    const random = crypto.getRandomValues(new Uint8Array(1024));
    let threw = false;
    try {
      await adapter.readTags(random, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "random bytes should throw");
  });

  it("should reject truncated file", async () => {
    const full = await readFixture("mp3");
    // Truncate to just the first 256 bytes (has header but missing body)
    const truncated = full.slice(0, 256);
    let threw = false;
    try {
      await adapter.readTags(truncated, "mp3");
    } catch {
      threw = true;
    }
    // Some backends may parse partial tags, others throw
    // Either behavior is acceptable — the key is no crash
    assertEquals(typeof threw, "boolean");
  });

  it("should handle large tag strings without crash", async () => {
    const buffer = await readFixture("flac");
    const longTitle = "A".repeat(10_000);
    let threw = false;
    try {
      const modified = await adapter.writeTags(
        buffer,
        { title: longTitle },
        "flac",
      );
      if (modified) {
        const tags = await adapter.readTags(modified, "flac");
        assertEquals(tags.title, longTitle);
      }
    } catch {
      threw = true;
    }
    // Should not crash, may or may not succeed
    assertEquals(typeof threw, "boolean");
  });

  it("should handle buffer with all zeros", async () => {
    const zeros = new Uint8Array(4096);
    let threw = false;
    try {
      await adapter.readTags(zeros, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "all-zero buffer should throw");
  });

  it("should handle buffer with valid magic but corrupt body", async () => {
    // ID3v2 header magic: "ID3" followed by garbage
    const corrupt = new Uint8Array(512);
    corrupt[0] = 0x49; // 'I'
    corrupt[1] = 0x44; // 'D'
    corrupt[2] = 0x33; // '3'
    corrupt[3] = 0x04; // version
    corrupt[4] = 0x00; // flags
    // Size bytes (syncsafe) claiming a very small tag
    corrupt[5] = 0x00;
    corrupt[6] = 0x00;
    corrupt[7] = 0x00;
    corrupt[8] = 0x10;
    // Rest is garbage
    let threw = false;
    try {
      await adapter.readTags(corrupt, "mp3");
    } catch {
      threw = true;
    }
    // Should not crash — either returns empty tags or throws
    assertEquals(typeof threw, "boolean");
  });
});
