/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { TagLib } from "../src/taglib.ts";

const FIXTURE_DIR = join("tests", "test-files", "mp3", "bitrate-mode");

async function readBitrateMode(
  filename: string,
): Promise<string | undefined> {
  const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
  const buffer = await Deno.readFile(join(FIXTURE_DIR, filename));
  const file = await taglib.open(buffer);
  try {
    const props = file.audioProperties();
    return props?.bitrateMode;
  } finally {
    file.dispose();
  }
}

Deno.test("bitrateMode: CBR LAME file -> 'CBR'", async () => {
  assertEquals(await readBitrateMode("cbr-lame.mp3"), "CBR");
});

Deno.test("bitrateMode: VBR LAME file -> 'VBR'", async () => {
  assertEquals(await readBitrateMode("vbr-lame.mp3"), "VBR");
});

Deno.test("bitrateMode: ABR LAME file -> 'ABR'", async () => {
  assertEquals(await readBitrateMode("abr-lame.mp3"), "ABR");
});

Deno.test("bitrateMode: VBRI file -> 'VBR'", async () => {
  assertEquals(await readBitrateMode("vbri.mp3"), "VBR");
});

Deno.test("bitrateMode: no-Xing file -> undefined", async () => {
  assertEquals(await readBitrateMode("no-xing.mp3"), undefined);
});
