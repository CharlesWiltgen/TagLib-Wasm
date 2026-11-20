/**
 * @fileoverview The action-pin control's own contract: an empty or
 * unparseable scan must fail (the silent-success bug this suite guards), and
 * every `uses:` form is classified — unpinned, short SHA, missing comment,
 * sub-path action, reusable workflow, local and Docker references.
 *
 * Static mode only (`--static`): no network, so the suite is deterministic in
 * CI. Ref resolution is the monthly job's half of the control.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vite-plus/test";

const execFileAsync = promisify(execFile);
const SCRIPT = resolve("scripts/check-action-pins.sh");
const SHA = "0123456789abcdef0123456789abcdef01234567";

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the script against a throwaway repo root holding `files` as workflows. */
async function runWithWorkflows(
  files: Record<string, string> | null,
): Promise<RunResult> {
  const root = await mkdtemp(join(tmpdir(), "check-action-pins-"));
  try {
    if (files !== null) {
      const dir = join(root, ".github", "workflows");
      await mkdir(dir, { recursive: true });
      for (const [name, body] of Object.entries(files)) {
        await writeFile(join(dir, name), body);
      }
    }
    try {
      const { stdout, stderr } = await execFileAsync("bash", [
        SCRIPT,
        "--static",
        root,
      ]);
      return { code: 0, stdout, stderr };
    } catch (error) {
      const failure = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
      };
      return {
        code: failure.code ?? -1,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? "",
      };
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const workflow = (...uses: string[]) =>
  [
    "jobs:",
    "  test:",
    "    steps:",
    ...uses.map((line) => `      - uses: ${line}`),
    "",
  ].join("\n");

describe("check-action-pins", () => {
  it("fails when the scan finds no uses: entries at all", async () => {
    const result = await runWithWorkflows({ "empty.yml": "jobs: {}\n" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("refusing to report success");
  });

  it("fails when the workflow directory is missing", async () => {
    const result = await runWithWorkflows(null);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no workflow directory");
  });

  it("fails an unpinned third-party action", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow("some/action@main"),
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("UNMANAGED");
    expect(result.stdout).toContain("some/action@main");
  });

  it("fails a short SHA", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow("some/action@73e4699 # v1"),
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("UNMANAGED");
  });

  it("fails a pinned action with no ref comment", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow(`some/action@${SHA}`),
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('no "# vX" ref comment');
  });

  it("accepts sub-path actions and reusable workflows pinned by SHA", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow(
        `github/codeql-action/init@${SHA} # v3`,
        `some/repo/.github/workflows/x.yml@${SHA} # v1`,
      ),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Action pin check passed");
  });

  it("reports a first-party action on a mutable tag as INFO without failing", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow(`some/action@${SHA} # v1`, "actions/checkout@v7"),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("INFO");
    expect(result.stdout).toContain("actions/checkout@v7");
  });

  it("ignores local and Docker references but still counts them as entries", async () => {
    const result = await runWithWorkflows({
      "ci.yml": workflow("./.github/actions/local", "docker://alpine:3.20"),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Action pin check passed");
  });
});
