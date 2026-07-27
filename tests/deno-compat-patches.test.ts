/**
 * The Deno compatibility patches applied to Emscripten's generated glue
 * (taglib-2z1b).
 *
 * These are regexes run over machine-generated JavaScript, so they are exactly
 * the kind of thing that stops matching when the generator's output changes
 * shape. What made that dangerous was not the mismatch but the silence: every
 * patch was optional and a single `modified` flag was set if ANY of them
 * applied, so the script printed success after applying one of five.
 *
 * The failure that produced was worse than doing nothing. The instantiation
 * patch INSERTS references to `ENVIRONMENT_IS_DENO`, which the detection patch
 * is what defines — so applying one without the other yields glue that throws
 * `ReferenceError: ENVIRONMENT_IS_DENO is not defined` before doing anything.
 * A debug (`-g2`) build emits unminified glue and hit exactly that.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  applyDenoCompatPatches,
  PATCH_NAMES,
} from "../scripts/fix-deno-compat.js";

/** Emscripten glue, minified the way a release (-O3) build emits it. */
const MINIFIED = [
  `var ENVIRONMENT_IS_WEB=typeof window=="object";`,
  `var ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";`,
  `if(ENVIRONMENT_IS_NODE){const{createRequire}=await import("node:module");var require=createRequire(import.meta.url)}`,
  `var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){readBinary=f=>{return 1}}`,
  `if(!ENVIRONMENT_IS_NODE){throw new Error("x")}`,
  `var imports={a:wasmImports};`,
].join("\n");

/**
 * The same glue as a debug (-g2) build emits it. Copied from real emcc output
 * rather than invented, because the two shapes that actually defeated the
 * patterns were not whitespace: a `//` comment and a `/** @suppress *\/`
 * annotation inside the createRequire block, and a QUOTED import key.
 */
const UNMINIFIED = [
  `var ENVIRONMENT_IS_WEB = typeof window == "object";`,
  `var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";`,
  `if (ENVIRONMENT_IS_NODE) {`,
  `  // We need to use \`createRequire()\` to construct the require()\` function.`,
  `  const {createRequire} = await import("node:module");`,
  `  /** @suppress{duplicate} */ var require = createRequire(import.meta.url);`,
  `}`,
  `var readAsync, readBinary;\nif (ENVIRONMENT_IS_NODE) { readBinary = f => { return 1 } }`,
  `if (!ENVIRONMENT_IS_NODE) { throw new Error("x") }`,
  `  var imports = {\n    "a": wasmImports\n  };`,
].join("\n");

describe("applyDenoCompatPatches", () => {
  it("applies every patch to minified glue", () => {
    const result = applyDenoCompatPatches(MINIFIED);
    assertEquals(result.missing, []);
    assertEquals(result.applied, [...PATCH_NAMES]);
  });

  it("applies every patch to unminified glue", () => {
    // The taglib-2z1b regression: a -g2 build could not be run under Deno
    // because four of five patterns assumed minified spacing.
    const result = applyDenoCompatPatches(UNMINIFIED);
    assertEquals(result.missing, []);
    assertEquals(result.applied, [...PATCH_NAMES]);
  });

  it("emits the bare import key the build guard greps for", () => {
    // build-wasm.sh compares the glue's import key against the wasm's import
    // module by grepping `var imports={<key>:wasmImports`. An unminified build
    // quotes that key, so the patch has to normalise it back or the guard
    // cannot see it and fails the build.
    for (const source of [MINIFIED, UNMINIFIED]) {
      const { content } = applyDenoCompatPatches(source);
      assertEquals(
        /var imports=\{[A-Za-z_$][\w$]*:wasmImports/.test(content),
        true,
        "guard-visible bare import key missing after patching",
      );
      assertEquals(
        content.includes(`"./a":wasmImports`),
        true,
        "JSR unfurl alias missing after patching",
      );
    }
  });

  it("defines ENVIRONMENT_IS_DENO whenever it references it", () => {
    // The invariant that the half-applied build violated. Checked on both
    // shapes, since it is the shape change that caused it.
    for (const source of [MINIFIED, UNMINIFIED]) {
      const { content } = applyDenoCompatPatches(source);
      assertEquals(
        /var\s+ENVIRONMENT_IS_DENO\s*=/.test(content),
        true,
        "patched glue references ENVIRONMENT_IS_DENO without defining it",
      );
    }
  });

  it("reports every patch that did not apply, by name", () => {
    // Glue carrying ONLY the instantiation check: the one patch that used to
    // apply alone and take the build down with it.
    const partial = `if(!ENVIRONMENT_IS_NODE){throw new Error("x")}`;
    const result = applyDenoCompatPatches(partial);
    assertEquals(result.applied, ["wasm-instantiation-checks"]);
    assertEquals(
      result.missing,
      PATCH_NAMES.filter((n) => n !== "wasm-instantiation-checks"),
    );
  });

  it("is idempotent", () => {
    // The build regenerates the glue every time, but a re-run must not double
    // patch — the instantiation rewrite in particular used to nest itself into
    // ((!A||B)||B) because its own output still matched its pattern.
    const once = applyDenoCompatPatches(MINIFIED);
    const twice = applyDenoCompatPatches(once.content);
    assertEquals(twice.content, once.content);
    assertEquals(twice.missing, []);
  });
});
