/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { MethodSpy } from "@std/testing/mock";
import { assertSpyCalls, spy } from "@std/testing/mock";
import {
  applyTags,
  applyTagsToBuffer,
  resetDeprecationWarnings,
  updateTags,
  writeTagsToFile,
} from "./index.ts";
import { setBufferMode } from "./config.ts";

const TEST_MP3 = "./tests/test-files/mp3/kiss-snippet.mp3";

setBufferMode(true);

describe("deprecation warnings", () => {
  // deno-lint-ignore no-explicit-any
  let warnSpy: MethodSpy<Console, any[], void>;

  beforeEach(() => {
    resetDeprecationWarnings();
    warnSpy = spy(console, "warn");
  });

  afterEach(() => {
    warnSpy.restore();
  });

  it("should warn once when applyTags() is called", async () => {
    const buffer = await Deno.readFile(TEST_MP3);

    await applyTags(new Uint8Array(buffer), { title: "Test" });
    assertSpyCalls(warnSpy, 1);
    assertEquals(
      warnSpy.calls[0].args[0],
      "applyTags() is deprecated. Use applyTagsToBuffer() instead.",
    );

    await applyTags(new Uint8Array(buffer), { title: "Test 2" });
    assertSpyCalls(warnSpy, 1);
  });

  it("should warn once when updateTags() is called", async () => {
    const tmpFile = await Deno.makeTempFile({ suffix: ".mp3" });
    try {
      await Deno.copyFile(TEST_MP3, tmpFile);

      await updateTags(tmpFile, { title: "Test" });
      assertSpyCalls(warnSpy, 1);
      assertEquals(
        warnSpy.calls[0].args[0],
        "updateTags() is deprecated. Use writeTagsToFile() instead.",
      );

      await updateTags(tmpFile, { title: "Test 2" });
      assertSpyCalls(warnSpy, 1);
    } finally {
      await Deno.remove(tmpFile);
    }
  });

  it("should not warn when applyTagsToBuffer() is called", async () => {
    const buffer = await Deno.readFile(TEST_MP3);
    await applyTagsToBuffer(new Uint8Array(buffer), { title: "Test" });
    assertSpyCalls(warnSpy, 0);
  });

  it("should not warn when writeTagsToFile() is called", async () => {
    const tmpFile = await Deno.makeTempFile({ suffix: ".mp3" });
    try {
      await Deno.copyFile(TEST_MP3, tmpFile);
      await writeTagsToFile(tmpFile, { title: "Test" });
      assertSpyCalls(warnSpy, 0);
    } finally {
      await Deno.remove(tmpFile);
    }
  });
});
