/**
 * @fileoverview Parameterized format detection tests across both backends.
 */

import { assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, type describe, it } from "@std/testing/bdd";
import {
  type BackendAdapter,
  extForFormat,
  forEachBackend,
  readFixture,
} from "./backend-adapter.ts";
import { type Format, FORMATS } from "./shared-fixtures.ts";

forEachBackend("Format Detection", (adapter: BackendAdapter) => {
  beforeAll(async () => {
    await adapter.init();
  });

  afterAll(async () => {
    await adapter.dispose();
  });

  for (const format of FORMATS) {
    it(`should detect ${format} format from valid file`, async () => {
      const buffer = await readFixture(format);
      const tags = await adapter.readTags(buffer, extForFormat(format));
      assertExists(tags, `${format}: should successfully read tags`);
    });
  }

  it("should reject empty buffer", async () => {
    const empty = new Uint8Array(0);
    let threw = false;
    try {
      await adapter.readTags(empty, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "empty buffer should throw");
  });

  it("should reject random bytes", async () => {
    const random = crypto.getRandomValues(new Uint8Array(256));
    let threw = false;
    try {
      await adapter.readTags(random, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "random bytes should throw");
  });

  it("should reject tiny buffer", async () => {
    const tiny = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    let threw = false;
    try {
      await adapter.readTags(tiny, "mp3");
    } catch {
      threw = true;
    }
    assertEquals(threw, true, "tiny buffer should throw");
  });
});
