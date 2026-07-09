import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { assertFrameId, assertMp3, toPublicFrame } from "./id3v2-frames.ts";
import { MetadataError, UnsupportedFormatError } from "../errors/classes.ts";

describe("assertFrameId", () => {
  it("accepts valid 4-char IDs", () => {
    for (const id of ["TIT2", "TXXX", "RGAD", "WFED", "ID32"]) {
      assertFrameId(id, "write"); // does not throw
    }
  });

  it("rejects malformed IDs", () => {
    for (const id of ["", "TIT", "TIT22", "tit2", "TI 2", "TI-2", "ТIT2"]) {
      assertThrows(() => assertFrameId(id, "write"), MetadataError);
    }
  });
});

describe("assertMp3", () => {
  it("passes for MP3 and throws UnsupportedFormatError otherwise", () => {
    assertMp3("MP3");
    assertThrows(() => assertMp3("FLAC"), UnsupportedFormatError);
    assertThrows(() => assertMp3("WAV"), UnsupportedFormatError);
  });
});

describe("toPublicFrame", () => {
  it("drops zero flags and preserves non-zero flags", () => {
    const data = new Uint8Array([1]);
    assertEquals(toPublicFrame({ id: "RGAD", data, flags: 0 }), {
      id: "RGAD",
      data,
    });
    assertEquals(toPublicFrame({ id: "RGAD", data, flags: 0x4000 }), {
      id: "RGAD",
      data,
      flags: 0x4000,
    });
    assertEquals(toPublicFrame({ id: "RGAD", data }), { id: "RGAD", data });
  });
});
