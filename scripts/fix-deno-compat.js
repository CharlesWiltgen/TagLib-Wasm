#!/usr/bin/env node

/**
 * Fix Deno compatibility issues in the generated taglib-wrapper.js
 * This script patches the Emscripten-generated code to properly handle Deno environment
 *
 * Every patch here is REQUIRED. They are regexes over machine-generated
 * JavaScript, so they stop matching whenever emcc changes the shape of its
 * output — and a partial application is worse than none, because
 * `wasm-instantiation-checks` inserts references to `ENVIRONMENT_IS_DENO` that
 * only `deno-environment-detection` defines. Applying one without the other
 * produced glue that threw `ReferenceError: ENVIRONMENT_IS_DENO is not defined`
 * before doing anything, while this script reported success and exited 0
 * (taglib-2z1b). So a patch that does not match is a hard failure, named.
 *
 * The patterns tolerate arbitrary whitespace because a debug build (`-g2`)
 * emits the same glue unminified, and being unable to build a debuggable module
 * is precisely the wrong thing to discover mid-crash-investigation.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

/**
 * Each patch declares:
 *   find     — matches the UNPATCHED construct
 *   replace  — string or function, as for String.replace
 *   applied  — optional: matches glue this patch has ALREADY been applied to,
 *              so a re-run reports success rather than a spurious failure.
 *              Omitted when `find` matches its own output (patch 2), which is
 *              idempotent by construction.
 */
/**
 * Whitespace that may also contain comments. A minified build has none of this;
 * an unminified one interleaves both a `//` line comment and a
 * `/** @suppress{duplicate} *\/` annotation into the createRequire block, which
 * plain `\s*` cannot span. Used only at the two positions where emcc actually
 * emits comments, to keep the surrounding patterns cheap to backtrack.
 */
const GAP = String.raw`(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*`;

export const PATCHES = [
  {
    // Emscripten has no Deno branch: it sees `process` and assumes Node.
    // The trailing lookahead makes this refuse its own output, so a re-run does
    // not insert a second definition. Every `find` here must do that or match
    // its output exactly; that is what keeps the set idempotent.
    name: "deno-environment-detection",
    find:
      /var\s+ENVIRONMENT_IS_NODE\s*=\s*globalThis\.process\?\.versions\?\.node\s*&&\s*globalThis\.process\?\.type\s*!=\s*"renderer"(?!\s*&&\s*!ENVIRONMENT_IS_DENO)/,
    replace:
      `var ENVIRONMENT_IS_DENO=typeof Deno!=="undefined";var ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer"&&!ENVIRONMENT_IS_DENO`,
    applied: /var\s+ENVIRONMENT_IS_DENO\s*=/,
  },
  {
    // Normalises the createRequire block; `find` deliberately also matches its
    // own output, so this one is idempotent without an `applied` probe.
    name: "node-module-loading",
    find: new RegExp(
      `if\\s*\\(\\s*ENVIRONMENT_IS_NODE(?:\\s*&&\\s*!ENVIRONMENT_IS_DENO)?\\s*\\)\\s*\\{` +
        GAP +
        `const\\s*\\{\\s*createRequire\\s*\\}\\s*=\\s*await\\s+import\\(\\s*"(?:node:)?module"\\s*\\)\\s*;?` +
        GAP +
        `var\\s+require\\s*=\\s*createRequire\\(\\s*import\\.meta\\.url\\s*\\)\\s*;?\\s*\\}`,
    ),
    replace:
      `if(ENVIRONMENT_IS_NODE){const{createRequire}=await import("module");var require=createRequire(import.meta.url)}`,
  },
  {
    name: "deno-file-reading",
    find:
      /var\s+readAsync\s*,\s*readBinary\s*;\s*if\s*\(\s*ENVIRONMENT_IS_NODE\s*\)\s*\{/,
    replace:
      `var readAsync,readBinary;if(ENVIRONMENT_IS_DENO){readBinary=async filename=>{if(filename instanceof URL||filename.startsWith("http")){const resp=await fetch(filename);return new Uint8Array(await resp.arrayBuffer())}else{return await Deno.readFile(filename)}};readAsync=readBinary}else if(ENVIRONMENT_IS_NODE){`,
    applied:
      /var\s+readAsync\s*,\s*readBinary\s*;\s*if\s*\(\s*ENVIRONMENT_IS_DENO\s*\)/,
  },
  {
    // Deno must take the same instantiation path as the web build. The negative
    // lookahead keeps a re-run from nesting this into ((!A||B)||B).
    name: "wasm-instantiation-checks",
    find: /!ENVIRONMENT_IS_NODE(?!\s*\|\|\s*ENVIRONMENT_IS_DENO)/g,
    replace: "(!ENVIRONMENT_IS_NODE||ENVIRONMENT_IS_DENO)",
    applied: /\(\s*!ENVIRONMENT_IS_NODE\s*\|\|\s*ENVIRONMENT_IS_DENO\s*\)/,
  },
  {
    // `deno publish` (>= 2.8.2, denoland/deno#34549) rewrites the minified
    // import MODULE name inside every published .wasm ("a" -> "./a") and leaves
    // the glue alone, so the wasm imports from "./a" while the glue provides
    // { a: ... }: `Import #0 "./a": module is not an object or function`.
    // Supplying both names is harmless off-JSR and required on it. See
    // jsr-io/jsr#1466.
    // The key is bare when minified and quoted when not. The replacement always
    // emits the bare, minified form: the build guard in build-wasm.sh greps for
    // `var imports={<key>:wasmImports` to compare the glue's key against the
    // wasm's import module, and a quoted key would slip past it.
    name: "jsr-import-unfurl-alias",
    find:
      /var\s+imports\s*=\s*\{\s*("?)([A-Za-z_$][\w$]*)\1\s*:\s*wasmImports\s*\}/,
    replace: (_match, _quote, key) =>
      `var imports={${key}:wasmImports,"./${key}":wasmImports}`,
    applied: /var\s+imports\s*=\s*\{[^}]*"\.\/[^"]*"\s*:\s*wasmImports/,
  },
];

/** Patch names in application order. */
export const PATCH_NAMES = PATCHES.map((p) => p.name);

/**
 * Apply every patch to `source`.
 *
 * Returns the patched text plus the names that applied and the names that did
 * not. A name in `missing` means the construct it targets was neither found nor
 * already patched — the caller must treat that as a build failure rather than
 * shipping half-patched glue.
 */
export function applyDenoCompatPatches(source) {
  let content = source;
  const applied = [];
  const missing = [];

  for (const patch of PATCHES) {
    if (patch.find.global) patch.find.lastIndex = 0;
    if (patch.find.test(content)) {
      if (patch.find.global) patch.find.lastIndex = 0;
      content = content.replace(patch.find, patch.replace);
      applied.push(patch.name);
    } else if (patch.applied?.test(content)) {
      applied.push(patch.name);
    } else {
      missing.push(patch.name);
    }
  }

  return { content, applied, missing };
}

function main() {
  // The target is build/taglib-wrapper.js by default and dist/taglib-wrapper.js
  // when postbuild passes it. Both need the same patches and the same hard
  // failure: dist/ is what ships to npm, and it used to be patched by a
  // near-duplicate script that kept the any-of-N-is-success behaviour this one
  // was fixed to drop (taglib-2z1b).
  const root = dirname(fileURLToPath(import.meta.url));
  const wrapperPath = process.argv[2]
    ? join(root, "..", process.argv[2])
    : join(root, "../build/taglib-wrapper.js");

  console.log(`🔧 Applying Deno compatibility fixes to ${wrapperPath}...`);

  const { content, applied, missing } = applyDenoCompatPatches(
    readFileSync(wrapperPath, "utf8"),
  );

  for (const name of applied) console.log(`  ✓ ${name}`);

  if (missing.length > 0) {
    // Do NOT write. Half-patched glue is broken in every environment, and a
    // build that fails here is far cheaper than one that ships that.
    console.error(
      `\n❌ ${missing.length} of ${PATCHES.length} Deno compatibility patches did not apply:`,
    );
    for (const name of missing) console.error(`     - ${name}`);
    console.error(
      "\n   taglib-wrapper.js was left unmodified. Emscripten's output shape\n" +
        "   probably changed; update the matching pattern in\n" +
        "   scripts/fix-deno-compat.js and re-run the build.",
    );
    process.exit(1);
  }

  writeFileSync(wrapperPath, content);
  console.log("\n✅ Deno compatibility fixes applied successfully!");
}

// Only act when run directly (`node scripts/fix-deno-compat.js`); importing
// this module for tests must have no side effects.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
