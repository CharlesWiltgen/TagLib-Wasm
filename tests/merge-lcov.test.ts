/**
 * @fileoverview Pins `scripts/merge-lcov.mjs` — the script that decides which
 * coverage SonarCloud sees — to the two promises it makes, because before this
 * file it had no test at all and one of them was silently broken.
 *
 * The promises:
 *
 * - The primary report (Vitest) defines the measured scope. A secondary report
 *   (Deno, Bun) may raise hits on records the primary already carries; it may
 *   not add an unhit line or branch. Expanding the denominator beyond what the
 *   primary measured is how the 2026-10-21 scan went from 3,353 to 9,009
 *   lines-to-cover and new-code coverage fell to 65.1%.
 * - A path-normalization break exits 1 instead of writing a merged file. Deno
 *   emits realpath-resolved `file://` SF paths, so a merge that matches nothing
 *   looks exactly like a merge that matched everything if it is allowed to
 *   succeed.
 *
 * The gap that motivated the file: BRDA records were passed through from the
 * primary untouched, so Deno/Bun branch hits never reached
 * `new_branch_coverage` (81.4%, Node-only). The branch cases are the ones that
 * would have caught it; the line, adoption, adoption-refusal, and normalization
 * cases are the baseline behaviour the branch merge had to leave alone.
 *
 * `MERGE_LCOV_SCRIPT` points the harness at another revision's copy, so a
 * finding can be re-derived against the code that carried it:
 *
 *     git show HEAD:scripts/merge-lcov.mjs > /tmp/old-merge-lcov.mjs
 *     MERGE_LCOV_SCRIPT=/tmp/old-merge-lcov.mjs pnpm exec vp test \
 *       tests/merge-lcov.test.ts
 */

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const COMMITTED_SCRIPT = fileURLToPath(
  new URL("../scripts/merge-lcov.mjs", import.meta.url),
);

/** The script under test. The override is the harness's one knob; the script
 * itself reads none of this. */
const SCRIPT = (() => {
  const override = process.env.MERGE_LCOV_SCRIPT;
  if (override !== undefined && override.length > 0) return override;
  return COMMITTED_SCRIPT;
})();

/** One lcov record, in the shape the script reads: SF first, then its lines,
 * then `end_of_record`. */
function record(sf: string, lines: string[]): string {
  return [`SF:${sf}`, ...lines, "end_of_record"].join("\n");
}

/** Merged output as records keyed by SF, so an assertion can name a record
 * instead of matching a substring across the whole file. */
function parseRecords(text: string): Map<string, string[]> {
  const records = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      current = [];
      records.set(line.slice(3), current);
    } else if (line === "end_of_record") {
      current = undefined;
    } else if (current) {
      current.push(line);
    }
  }
  return records;
}

type Fixture = {
  /** Primary report text. */
  primary: string;
  /** Secondary report texts, one file each, in argument order. */
  secondary: string[];
  /** Write to stdout instead of passing `-o merged.info`. */
  stdoutOnly?: boolean;
};

type Result = { code: number; stderr: string; merged: string };

/** Runs the script once in its own temp directory. The child's cwd is the temp
 * directory because that is what the script normalizes SF paths against — the
 * same relationship CI has, where it runs at the checkout root. */
async function runMerge(build: (dir: string) => Fixture): Promise<Result> {
  const dir = await mkdtemp(join(tmpdir(), "taglib-merge-lcov-"));
  try {
    const fixture = build(dir);
    await writeFile(join(dir, "primary.lcov"), fixture.primary);
    const secondaryPaths: string[] = [];
    for (const [index, text] of fixture.secondary.entries()) {
      const name = `secondary-${index}.lcov`;
      await writeFile(join(dir, name), text);
      secondaryPaths.push(name);
    }

    const args = [SCRIPT, "primary.lcov", ...secondaryPaths];
    if (!fixture.stdoutOnly) args.push("-o", "merged.info");

    const settled = Promise.withResolvers<{
      code: number;
      stdout: string;
      stderr: string;
    }>();
    const child = spawn(process.execPath, args, {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("close", (exitCode) => {
      settled.resolve({
        code: exitCode ?? -1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
    const { code, stdout, stderr } = await settled.promise;

    const merged = fixture.stdoutOnly
      ? stdout
      : code === 0
        ? await readFile(join(dir, "merged.info"), "utf8")
        : "";
    return { code, stderr, merged };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const SKIP =
  process.platform === "win32"
    ? "POSIX-only harness: SF normalization is rooted at the working directory"
    : undefined;

describe(
  SKIP === undefined
    ? "merge-lcov.mjs: merge semantics over fixture lcov reports"
    : `merge-lcov.mjs: merge semantics [skipped: ${SKIP}]`,
  { skip: SKIP !== undefined },
  () => {
    it("raises matched line hits, ignores lines outside primary scope, and writes to stdout", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: record("src/a.ts", [
          "FN:1,foo",
          "FNDA:0,foo",
          "DA:1,0",
          "DA:2,0",
          "LF:2",
          "LH:0",
        ]),
        secondary: [
          record("src/a.ts", ["DA:1,3", "DA:9,5"]),
          record("src/other.ts", ["DA:1,1"]),
        ],
        stdoutOnly: true,
      }));

      expect(code).toStrictEqual(0);
      const merged_ = parseRecords(merged);
      const a = merged_.get("src/a.ts");
      expect(a).toBeDefined();
      // Hit raised, zero-hit line kept, unmeasured line not created.
      expect(a).toContain("DA:1,3");
      expect(a).toContain("DA:2,0");
      expect(a).not.toContain("DA:9,5");
      // Totals follow the merged lines; unrelated record fields pass through.
      expect(a).toContain("LF:2");
      expect(a).toContain("LH:1");
      expect(a).toContain("FN:1,foo");
      expect(a).toContain("FNDA:0,foo");
      // A secondary-only file that is fully covered is adopted; `other.ts` is
      // the one file here that is not in the primary, and it has one covered
      // line, so it is adopted too.
      expect(merged_.has("src/other.ts")).toStrictEqual(true);
    });

    it("adopts a fully covered secondary-only file and drops a partially covered one", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: record("src/a.ts", ["DA:1,0", "LF:1", "LH:0"]),
        secondary: [
          record("src/a.ts", ["DA:1,1"]),
          record("src/b.ts", ["DA:1,2", "DA:2,1", "LF:2", "LH:2"]),
          record("src/c.ts", ["DA:1,0", "DA:2,3", "LF:2", "LH:1"]),
        ],
      }));

      expect(code).toStrictEqual(0);
      const merged_ = parseRecords(merged);
      const b = merged_.get("src/b.ts");
      expect(b).toBeDefined();
      expect(b).toContain("DA:1,2");
      expect(b).toContain("LF:2");
      expect(b).toContain("LH:2");
      // One zero-hit line is enough to keep the whole file out: adopting it
      // would expand lines-to-cover to a module the primary never measured.
      expect(merged_.has("src/c.ts")).toStrictEqual(false);
    });

    it("exits 1 when no secondary record matches the primary (path-normalization break)", async () => {
      const { code, stderr, merged } = await runMerge(() => ({
        primary: record("src/a.ts", ["DA:1,0"]),
        secondary: [record("src/nonexistent.ts", ["DA:1,7"])],
      }));

      expect(code).toStrictEqual(1);
      expect(stderr).toContain(
        "no secondary coverage matched the primary report",
      );
      // Nothing was written: a broken run must not publish pre-merge coverage.
      expect(merged).toStrictEqual("");
    });

    it("normalizes absolute and file:// SF paths from either report", async () => {
      const { code, merged } = await runMerge((dir) => {
        // resolve: (Deno canonicalizes) — the script matches both the raw and
        // the realpath form of its cwd, so a symlinked checkout still merges.
        const real = realpathSync(dir);
        return {
          // The primary emits absolute and file:// paths; the secondary emits
          // paths relative to the same root.
          primary: [
            record(`${real}/src/a.ts`, ["DA:1,0", "LF:1", "LH:0"]),
            record(`file://${real}/src/d.ts`, ["DA:4,0", "LF:1", "LH:0"]),
          ].join("\n"),
          secondary: [
            record("src/a.ts", ["DA:1,6"]),
            record("src/d.ts", ["DA:4,2"]),
          ],
        };
      });

      expect(code).toStrictEqual(0);
      const merged_ = parseRecords(merged);
      // Absolute paths are rewritten relative, which is what makes the primary
      // and secondary keys comparable in SonarCloud's report.
      expect([...merged_.keys()].sort()).toStrictEqual([
        "src/a.ts",
        "src/d.ts",
      ]);
      expect(merged_.get("src/a.ts")).toContain("DA:1,6");
      expect(merged_.get("src/d.ts")).toContain("DA:4,2");
    });

    it("raises matched BRDA taken counts and recomputes BRF/BRH", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: record("src/a.ts", [
          "DA:10,1",
          "BRDA:10,0,0,0",
          "BRDA:10,0,1,-",
          "BRDA:10,1,0,-",
          // Stale on purpose: only a recompute from the merged BRDA set can
          // produce BRF:3, so a passthrough of this value fails the assertion.
          "BRF:9",
          "BRH:0",
          "LF:1",
          "LH:1",
        ]),
        secondary: [
          record("src/a.ts", [
            "DA:10,4",
            "BRDA:10,0,0,7",
            "BRDA:10,0,1,4",
            "BRDA:10,1,0,-",
            // A branch the primary never recorded: creating it would add
            // branches-found to the denominator with no primary measurement.
            "BRDA:10,2,0,9",
          ]),
        ],
      }));

      expect(code).toStrictEqual(0);
      const a = parseRecords(merged).get("src/a.ts");
      expect(a).toBeDefined();
      expect(a).toContain("BRDA:10,0,0,7");
      expect(a).toContain("BRDA:10,0,1,4");
      // Both reports left this branch unexecuted, so "-" survives.
      expect(a).toContain("BRDA:10,1,0,-");
      expect(a).not.toContain("BRDA:10,2,0,9");
      // Rebuilt from the merged set: 3 found, 2 now taken.
      expect(a).toContain("BRF:3");
      expect(a).toContain("BRH:2");
    });

    it("keeps branch keys when one file arrives in several primary records", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: [
          // Same SF twice is legal lcov. Neither record may lose the other's
          // branch keys: the output for both blocks reads one merged map.
          record("src/a.ts", [
            "DA:1,1",
            "BRDA:1,0,0,2",
            "BRF:1",
            "BRH:1",
            "LF:1",
            "LH:1",
          ]),
          record("src/a.ts", [
            "DA:2,1",
            "BRDA:2,0,0,3",
            "BRF:1",
            "BRH:1",
            "LF:1",
            "LH:1",
          ]),
        ].join("\n"),
        secondary: [record("src/a.ts", ["DA:1,1", "BRDA:1,0,0,9"])],
      }));

      expect(code).toStrictEqual(0);
      // The secondary hit lands on the first record's branch...
      expect(merged).toContain("BRDA:1,0,0,9");
      // ...and the second record's branch survives the merge.
      expect(merged).toContain("BRDA:2,0,0,3");
      // Each record totals only its own branch, so a summing consumer sees 2
      // found branches, not 4 from a file-wide count repeated per record.
      expect(merged.match(/^BRF:1$/gm)?.length).toStrictEqual(2);
      expect(merged).not.toContain("BRF:2");
      // A missing key must never reach the output as a placeholder.
      expect(merged).not.toContain("undefined");
    });

    it("never lowers a hit the primary already recorded", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: record("src/a.ts", [
          "DA:1,5",
          "BRDA:1,0,0,4",
          "BRF:1",
          "BRH:1",
          "LF:1",
          "LH:1",
        ]),
        // A stale runtime reports the same line and branch as unhit. Merging
        // with max is what keeps the primary's evidence; an overwrite silently
        // withdraws coverage that was measured.
        secondary: [record("src/a.ts", ["DA:1,0", "BRDA:1,0,0,0"])],
      }));

      expect(code).toStrictEqual(0);
      const a = parseRecords(merged).get("src/a.ts");
      expect(a).toBeDefined();
      expect(a).toContain("DA:1,5");
      expect(a).toContain("BRDA:1,0,0,4");
      expect(a).toContain("BRH:1");
    });

    it("keeps adopted secondary-only files line-only (no BRDA, no BRF/BRH)", async () => {
      const { code, merged } = await runMerge(() => ({
        primary: record("src/a.ts", ["DA:1,0", "LF:1", "LH:0"]),
        secondary: [
          record("src/a.ts", ["DA:1,1"]),
          record("src/b.ts", [
            "DA:2,1",
            "BRDA:2,0,0,5",
            "BRDA:2,0,1,0",
            "BRF:2",
            "BRH:1",
            "LF:1",
            "LH:1",
          ]),
        ],
      }));

      expect(code).toStrictEqual(0);
      const b = parseRecords(merged).get("src/b.ts");
      expect(b).toBeDefined();
      // Its lines are fully covered, so the file is adopted, but "every line
      // covered" still permits unhit branches — importing them would lower
      // branch coverage with data the primary never measured.
      expect(b).toContain("DA:2,1");
      expect(b).not.toContain("BRDA:2,0,0,5");
      expect(b).not.toContain("BRF:2");
    });
  },
);
