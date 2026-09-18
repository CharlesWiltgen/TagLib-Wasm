/// <reference lib="deno.ns" />

/**
 * Browser entry-point contract (taglib-kgni).
 *
 * Measured on the published taglib-wasm@2.2.3: `dist/index.browser.js` shipped
 * 19 runtime exports fewer than `dist/index.js`, so
 * `import { scanFolder } from "taglib-wasm"` failed a browser-targeted build
 * with a *bundler* error ("No matching export in dist/index.browser.js") and no
 * explanation, while the same import worked on Node. Three properties keep that
 * from coming back:
 *
 *  1. Every Node-barrel export that can run in a browser is exported by the
 *     browser barrel. The classification is by capability, read off the module
 *     graph — not by whether a name sounds browser-friendly. A function whose
 *     only implementation writes to a path cannot work in a browser however
 *     webby its name is (`copyCoverArt`, `savePictureToFile`, ...), while a
 *     pure one can (`bwf`, `groupAlbums`). Any export that lands in one barrel
 *     only must be added to CLASSIFICATION below, with a reason.
 *  2. The browser barrel's *type* surface equals the Node barrel's. A type
 *     describes data and data crosses networks, so typing a server-produced
 *     `FolderScanResult` in a browser must compile; it is the functions that
 *     walk a filesystem which cannot. Importing one of those is a compile
 *     error, because the `browser` `exports` condition routes TypeScript to
 *     dist/index.browser.d.ts (README, "Bundle Size and Tree-Shaking").
 *  3. Every browser entry's runtime graph is browser-safe — no `node:*`
 *     builtin, no package dependency that is not declared, and none of the
 *     WASI/unified-loader/filesystem modules. This is what makes (1) a
 *     classification rather than an assertion: the walker follows the same
 *     edges `scripts/build-js.mjs`'s browserRedirectPlugin rewrites.
 */

import { assert, assertEquals } from "@std/assert";
// Namespace imports so the export surface itself is the observable: the two
// barrels are compared name by name, not called.
import * as nodeEntry from "../index.ts";
import * as browserEntry from "../index.browser.ts";

const ROOT = new URL("../", import.meta.url);

/** Where a Node-barrel runtime export can live. */
type Disposition = "browser" | "node-only";

/**
 * Every runtime export the two barrels disagree about, classified by the code
 * behind it. This is the expectation the surface test enforces, so a new export
 * added to `index.ts` alone (or `index.browser.ts` alone) fails until someone
 * decides where it belongs. Reasons name the capability that decides it.
 */
const CLASSIFICATION: Record<
  string,
  { where: Disposition; because: string }
> = {
  bwf: {
    where: "browser",
    because: "pure `bext` codec over bytes — bext.ts has no runtime imports",
  },
  discFolderInfo: {
    where: "browser",
    because: "pure directory-name grammar, no I/O (taglib-ys7m split)",
  },
  groupAlbums: {
    where: "browser",
    because:
      "pure grouping over a FolderScanResult, runtime-agnostic by contract",
  },
  isDenoCompiled: {
    where: "browser",
    because: "reads `typeof Deno` and returns false where Deno is absent; " +
      "deno-detect.ts has no imports (the embedding helpers that do " +
      "Deno I/O — initializeForDenoCompile, prepareWasmForEmbedding — stay out)",
  },
  copyCoverArt: {
    where: "node-only",
    because: "writes the target audio file to a path (utils/write.ts)",
  },
  exportAllPictures: {
    where: "node-only",
    because: "writes each picture to a directory path",
  },
  exportCoverArt: {
    where: "node-only",
    because: "writes an image file to a path",
  },
  exportFolderMetadata: {
    where: "node-only",
    because: "walks a directory and writes a JSON file",
  },
  exportPictureByType: {
    where: "node-only",
    because: "writes an image file to a path",
  },
  findCoverArtFiles: {
    where: "node-only",
    because: "reads sibling cover files from the audio file's directory",
  },
  findDuplicates: {
    where: "node-only",
    because: "takes a folder path and calls scanFolder",
  },
  importCoverArt: {
    where: "node-only",
    because: "reads an image path and rewrites the audio path",
  },
  importPictureWithType: {
    where: "node-only",
    because: "reads an image path and rewrites the audio path",
  },
  initializeForDenoCompile: {
    where: "node-only",
    because: "Deno-compiled-binary bootstrap (Deno.mainModule, file URLs)",
  },
  loadPictureFromFile: {
    where: "node-only",
    because: "reads an image from a path and sniffs its extension",
  },
  prepareWasmForEmbedding: {
    where: "node-only",
    because: "Deno compile embedding, resolves file paths",
  },
  savePictureToFile: {
    where: "node-only",
    because: "writes an image file to a path",
  },
  scanFolder: {
    where: "node-only",
    because: "walks a directory (platform filesystem I/O)",
  },
  scanForAlbums: {
    where: "node-only",
    because: "walks a directory via scanFolder",
  },
};

const BROWSER_SAFE = Object.entries(CLASSIFICATION)
  .filter(([, c]) => c.where === "browser").map(([name]) => name).sort();
const NODE_ONLY = Object.entries(CLASSIFICATION)
  .filter(([, c]) => c.where === "node-only").map(([name]) => name).sort();

/**
 * Subpaths that deliberately have no `browser` condition. `./folder` is
 * filesystem-bound and keeps failing loudly in a browser build (a build error
 * beats a stub that throws at runtime); `./disc-folder` and `./rating` are
 * single pure-JavaScript artifacts that are already browser-safe as shipped.
 */
const NO_BROWSER_CONDITION = ["./disc-folder", "./folder", "./rating"];

// ---------------------------------------------------------------------------
// Export-surface extraction
//
// `import` gives the runtime surface; a type-only export is invisible at
// runtime, so the declared surface is parsed from the source and the parsed
// *value* set is cross-checked against the namespace object, which keeps the
// parser honest instead of letting it drift into a second, weaker contract.
// ---------------------------------------------------------------------------

interface DeclaredSurface {
  values: string[];
  types: string[];
}

async function declaredSurface(
  path: string,
  seen: Set<string> = new Set(),
): Promise<DeclaredSurface> {
  if (seen.has(path)) return { values: [], types: [] };
  seen.add(path);
  const source = stripComments(await Deno.readTextFile(new URL(path, ROOT)));
  const values = new Set<string>();
  const types = new Set<string>();

  for (
    const match of source.matchAll(
      /export\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g,
    )
  ) {
    const [, typeKeyword, body, specifier] = match;
    for (const raw of body.split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      const name = item.replace(/^type\s+/, "").split(/\s+as\s+/).pop()!.trim();
      const isType = typeKeyword !== undefined || item.startsWith("type ");
      (isType ? types : values).add(name);
    }
    // `export type { … } from` carries no runtime edge; the mixed form does.
    void specifier;
  }

  for (
    const match of source.matchAll(
      /export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*"([^"]+)"/g,
    )
  ) {
    values.add(match[1]);
  }

  for (const match of source.matchAll(/export\s+\*\s+from\s*"([^"]+)"/g)) {
    const nested = await declaredSurface(
      resolveRelative(path, match[1]),
      seen,
    );
    for (const name of nested.values) values.add(name);
    for (const name of nested.types) types.add(name);
  }

  return { values: [...values].sort(), types: [...types].sort() };
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /^[ \t]*\/\/.*$/gm,
    "",
  );
}

// ---------------------------------------------------------------------------
// Runtime-graph walk
// ---------------------------------------------------------------------------

function resolveRelative(from: string, specifier: string): string {
  const cut = from.lastIndexOf("/");
  const dir = cut === -1 ? "" : from.slice(0, cut);
  const parts = (dir === "" ? [] : dir.split("/")).concat(specifier.split("/"));
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/**
 * Specifiers of the statements that survive bundling. Type-only imports are
 * erased by esbuild, so they carry no runtime edge and must not be walked;
 * dynamic `import("…")` always counts.
 */
function runtimeSpecifiers(source: string): string[] {
  const text = stripComments(source);
  const out: string[] = [];
  for (
    const match of text.matchAll(
      /(?:^|\n)[ \t]*(import|export)\b([\s\S]*?)from\s*["']([^"']+)["']/g,
    )
  ) {
    const body = match[2];
    const braced = /\{[\s\S]*\}/.test(body);
    const items = braced
      ? body.replace(/^[\s\S]*?\{([\s\S]*)\}\s*$/, "$1").split(",").map((s) =>
        s.trim()
      ).filter(Boolean)
      : [];
    const allTypes = items.length > 0 &&
      items.every((i) => i.startsWith("type "));
    if (/^\s*type\b/.test(body) || allTypes) continue;
    out.push(match[3]);
  }
  for (
    const match of text.matchAll(
      /(?:^|[^\w$.'"`])(?:import|export)\s*\(\s*["']([^"']+)["']/g,
    )
  ) {
    out.push(match[1]);
  }
  for (
    const match of text.matchAll(/(?:^|\n)[ \t]*import\s*["']([^"']+)["']/g)
  ) {
    out.push(match[1]);
  }
  return out;
}

/** Stubs the browser plugin substitutes, and the loader import it mirrors. */
const STUBBED_MODULES: Record<string, true> = {
  "src/runtime/platform-io.ts": true,
  "src/utils/node-fs.ts": true,
};
const LOADER_REDIRECT = {
  from: "src/runtime/module-loader.ts",
  to: "src/runtime/module-loader-browser.ts",
};

/** Modules a browser entry must never reach (the WASI/filesystem tree). */
const NODE_ONLY_MODULES =
  /^(?:src\/deno-compile\.ts|src\/file-utils\/|src\/folder-api\/(?:directory-walker|file-processors|folder-operations|scan-for-albums|scan-operations)\.ts|src\/runtime\/(?:module-loader|wasi-fs-node|wasi-host-loader)\.ts|src\/runtime\/unified-loader\/|src\/runtime\/wasi-adapter\/)/;

interface RuntimeGraph {
  modules: string[];
  bareSpecifiers: Set<string>;
}

async function runtimeGraph(entry: string): Promise<RuntimeGraph> {
  const modules = new Set<string>();
  const bareSpecifiers = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (modules.has(file)) continue;
    modules.add(file);
    for (
      const spec of runtimeSpecifiers(
        await Deno.readTextFile(new URL(file, ROOT)),
      )
    ) {
      if (!spec.startsWith(".")) {
        bareSpecifiers.add(spec);
        continue;
      }
      const resolved = resolveRelative(file, spec);
      // `.js`/`.wasm` leaves are runtime assets the plugin externalizes, not
      // TypeScript modules: taglib-wrapper.js only exists after the wasm build.
      if (!resolved.endsWith(".ts")) continue;
      if (STUBBED_MODULES[resolved] === true) continue;
      const target = resolved === LOADER_REDIRECT.from
        ? LOADER_REDIRECT.to
        : resolved;
      queue.push(target);
    }
  }
  return { modules: [...modules].sort(), bareSpecifiers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("browser barrel exports every browser-capable Node export, and nothing else", async () => {
  const node = Object.keys(nodeEntry).sort();
  const browser = Object.keys(browserEntry).sort();

  const missing = NODE_ONLY.filter((name) => browser.includes(name));
  assertEquals(
    missing,
    [],
    "Node-only exports must not be in the browser barrel — they would throw " +
      "or pull a node-only graph at runtime",
  );

  const absent = BROWSER_SAFE.filter((name) => !browser.includes(name));
  assertEquals(
    absent,
    [],
    "browser-capable exports are missing from index.browser.ts",
  );

  assertEquals(
    node.filter((name) => !browser.includes(name)).sort(),
    NODE_ONLY,
    "index.ts exports a runtime name that is neither browser-safe nor " +
      "listed as node-only in CLASSIFICATION",
  );
  assertEquals(
    browser.filter((name) => !node.includes(name)),
    [],
    "index.browser.ts exports a runtime name index.ts does not",
  );

  // The three additions must be the real implementations, not stubs: each is
  // pure, so they run here without a Wasm instance.
  assertEquals(typeof browserEntry.bwf.decodeBext, "function");
  assertEquals(typeof browserEntry.bwf.encodeBext, "function");
  assertEquals(typeof browserEntry.groupAlbums, "function");
  assertEquals(browserEntry.discFolderInfo("CD1")?.number, 1);
  assertEquals(browserEntry.discFolderInfo("Greatest Hits"), undefined);
  assertEquals(typeof browserEntry.isDenoCompiled(), "boolean");
});

Deno.test("the browser barrel's declared surface matches the shipped runtime surface", async () => {
  const browser = await declaredSurface("index.browser.ts");
  assertEquals(
    browser.values,
    Object.keys(browserEntry).sort(),
    "the parser and the live module disagree — the surface check below would " +
      "be policing text rather than behavior",
  );
});

Deno.test("browser and Node barrels declare the same type surface", async () => {
  const node = await declaredSurface("index.ts");
  const browser = await declaredSurface("index.browser.ts");

  assert(
    node.types.length >= 20,
    `expected the parser to find the Node barrel's type-only exports, saw ${node.types.length}`,
  );
  assertEquals(
    browser.types,
    node.types,
    "types describe data, which crosses networks: every type-only export of " +
      "index.ts belongs in index.browser.ts too",
  );
});

Deno.test("every browser-variant entry declares the same surface as its Node twin", async () => {
  for (const name of ["simple", "web"]) {
    const node = await declaredSurface(`${name}.ts`);
    const browser = await declaredSurface(`${name}.browser.ts`);
    assertEquals(
      browser.values,
      node.values,
      `${name}.browser.ts must export what ${name}.ts does`,
    );
    assertEquals(browser.types, node.types);
  }
});

Deno.test("browser export conditions point at sources the build produces, and only the declared exceptions lack one", async () => {
  const pkg = JSON.parse(
    await Deno.readTextFile(new URL("package.json", ROOT)),
  ) as {
    exports: Record<
      string,
      { browser?: { types?: string; default?: string }; default: unknown }
    >;
  };

  const withoutCondition: string[] = [];
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (target.browser === undefined) {
      withoutCondition.push(subpath);
      continue;
    }
    // A browser condition needs per-condition `types`: that is what makes a
    // Node-only import a compile error instead of a bundler error.
    assert(
      typeof target.browser.types === "string" &&
        typeof target.browser.default === "string",
      `${subpath} declares a browser condition without both types and default`,
    );
    for (const distPath of [target.browser.types, target.browser.default]) {
      const source =
        distPath.replace(/^\.\/dist\//, "").replace(/(?:\.d)?\.ts$|\.js$/, "") +
        ".ts";
      let built = true;
      try {
        await Deno.stat(new URL(source, ROOT));
      } catch {
        built = false;
      }
      assert(
        built,
        `${subpath}'s browser condition ships ${distPath}, built from ${source}, which the repository does not have`,
      );
    }
  }

  assertEquals(
    withoutCondition.sort(),
    NO_BROWSER_CONDITION,
    "every subpath is a browser decision: give it a browser condition with a " +
      "browser-targeted build, or add it to NO_BROWSER_CONDITION with a reason",
  );
});

Deno.test("browser entries reach no Node-only module and no undeclared dependency", async () => {
  const pkg = JSON.parse(
    await Deno.readTextFile(new URL("package.json", ROOT)),
  ) as { dependencies: Record<string, string> };
  const declared = new Set(Object.keys(pkg.dependencies));

  for (const entry of ["index.browser.ts", "web.browser.ts"]) {
    const { modules, bareSpecifiers } = await runtimeGraph(entry);

    const stray = modules.filter((m) => NODE_ONLY_MODULES.test(m));
    assertEquals(
      stray,
      [],
      `${entry} reaches Node-only modules`,
    );

    const builtins = [...bareSpecifiers].filter((s) => !declared.has(s));
    assertEquals(
      builtins,
      [],
      `${entry} imports ${
        builtins.join(", ")
      } — a runtime-provided specifier ` +
        `cannot be resolved by a browser bundler`,
    );

    assert(
      modules.includes(LOADER_REDIRECT.to),
      `${entry} must reach ${LOADER_REDIRECT.to} (the Emscripten-only loader), ` +
        `which is what keeps taglib-wasi.wasm out of a browser bundle`,
    );
  }

  const indexGraph = await runtimeGraph("index.browser.ts");
  for (
    const leaf of [
      "src/bwf/bext.ts",
      "src/folder-api/folder-disc.ts",
      "src/folder-api/album-grouping.ts",
      "src/runtime/deno-detect.ts",
    ]
  ) {
    assert(
      indexGraph.modules.includes(leaf),
      `${leaf} is classified browser-safe, so the browser bundle must carry ` +
        `it as a runtime module (a type-only re-export would not)`,
    );
  }
});
