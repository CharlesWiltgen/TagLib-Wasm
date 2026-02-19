import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { isDenoCompiled } from "../src/runtime/deno-detect.ts";

describe("isDenoCompiled", () => {
  it("returns false in regular Deno runtime", () => {
    assertEquals(isDenoCompiled(), false);
  });

  it("checks Deno.mainModule for deno-compile:// prefix", () => {
    assertEquals(Deno.mainModule.includes("deno-compile://"), false);
  });
});
