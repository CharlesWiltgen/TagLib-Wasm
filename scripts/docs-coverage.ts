#!/usr/bin/env -S deno run --allow-read --allow-run
/**
 * docs-coverage.ts — flags public exports not referenced anywhere in the docs.
 *
 * A mechanical first-pass signal for the `/tlw-preflight-docs` skill (taglib-5w2):
 * it enumerates every public export from the entry points and checks whether each
 * NAME appears (word-boundary) in README.md / AGENTS.md / docs/. A hit means the
 * name is mentioned somewhere — it does NOT verify the doc is accurate or that the
 * signature still matches. That accuracy judgment is the skill's job; this script
 * only catches the "shipped an export, never mentioned it" class of drift.
 *
 * Usage:   deno task docs:coverage
 * Exit:    0 if every export is documented or allowlisted; 1 otherwise.
 */

const ENTRY_POINTS = [
  "index.ts",
  "simple.ts",
  "folder.ts",
  "web.ts",
  "rating.ts",
];

const DOC_ROOTS = ["README.md", "AGENTS.md", "docs"];
const SKIP_DIRS = new Set(["node_modules", ".vitepress", "dist", "cache"]);

/**
 * Public exports intentionally absent from the user-facing docs (internal-ish
 * surface like factory functions used only by the runtime loaders). Keep this
 * short and justified — prefer documenting an export over allowlisting it.
 */
const ALLOWLIST = new Set<string>([
  "AudioFileImpl", // impl class behind the public AudioFile interface
  "PICTURE_TYPE_NAMES", // internal id<->name lookup tables
  "PICTURE_TYPE_VALUES",
  "BITRATE_CONTROL_MODE_NAMES",
  "BITRATE_CONTROL_MODE_VALUES",
  "FormatMappings", // internal format/codec mapping table
]);

const KIND =
  /^(?:export\s+)?(?:async\s+)?(function|class|interface|type|const|enum|namespace)\s+([A-Za-z_$][\w$]*)/;

/** Group a deno-doc kind keyword into a report category. */
function category(kind: string): string {
  if (kind === "function") return "Functions";
  if (kind === "class") return "Classes";
  if (kind === "interface" || kind === "type") return "Types";
  if (kind === "const") return "Constants";
  return "Other";
}

/** Map of public export name -> report category, across all entry points. */
async function publicExports(): Promise<Map<string, string>> {
  const { stdout } = await new Deno.Command("deno", {
    args: ["doc", ...ENTRY_POINTS],
    stdout: "piped",
    stderr: "null",
  }).output();
  const text = new TextDecoder().decode(stdout).replace(
    // deno-lint-ignore no-control-regex
    /\x1b\[[0-9;]*m/g,
    "",
  );
  const exports = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = KIND.exec(line);
    if (m && !exports.has(m[2])) exports.set(m[2], category(m[1]));
  }
  return exports;
}

async function collectDocText(path: string, sink: string[]): Promise<void> {
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(path);
  } catch {
    return;
  }
  if (info.isFile && path.endsWith(".md")) {
    sink.push(await Deno.readTextFile(path));
  } else if (info.isDirectory) {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory && SKIP_DIRS.has(entry.name)) continue;
      await collectDocText(`${path}/${entry.name}`, sink);
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CATEGORY_ORDER = ["Functions", "Classes", "Types", "Constants", "Other"];

async function main(): Promise<void> {
  const exports = await publicExports();
  const docs: string[] = [];
  for (const root of DOC_ROOTS) await collectDocText(root, docs);
  const haystack = docs.join("\n");

  const undocumented = new Map<string, string[]>(); // category -> names
  for (const [name, cat] of [...exports].sort()) {
    if (ALLOWLIST.has(name)) continue;
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(haystack)) continue;
    (undocumented.get(cat) ?? undocumented.set(cat, []).get(cat)!).push(name);
  }

  const missing = [...undocumented.values()].reduce((n, a) => n + a.length, 0);
  const documented = exports.size - missing - ALLOWLIST.size;
  console.log(
    `📄 Docs coverage: ${documented}/${exports.size} public exports referenced ` +
      `(${ALLOWLIST.size} allowlisted, ${missing} undocumented)`,
  );

  if (missing > 0) {
    for (const cat of CATEGORY_ORDER) {
      const names = undocumented.get(cat);
      if (!names?.length) continue;
      console.log(`\n❌ ${cat} not referenced in docs (${names.length}):`);
      for (const name of names) console.log(`   - ${name}`);
    }
    console.log(
      "\nDocument each in README.md / AGENTS.md / docs, or add to ALLOWLIST " +
        "(with justification) in scripts/docs-coverage.ts.",
    );
    Deno.exit(1);
  }
  console.log("✅ Every public export is referenced in the docs.");
}

if (import.meta.main) await main();
