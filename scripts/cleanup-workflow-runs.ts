#!/usr/bin/env -S deno run --allow-run --allow-env

/**
 * Deletes GitHub Action workflow runs older than a specified number of days
 * Requires GitHub CLI (gh) to be installed and authenticated
 */

import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";

const args = parse(Deno.args, {
  default: {
    days: 1,
    repo: "CharlesWiltgen/TagLib-Wasm",
    yes: false,
  },
  alias: {
    d: "days",
    r: "repo",
    y: "yes",
  },
  boolean: ["yes"],
});

async function getWorkflowRuns(repo: string) {
  const cmd = new Deno.Command("gh", {
    args: [
      "api",
      `repos/${repo}/actions/runs`,
      "--paginate",
      "-q",
      ".workflow_runs[] | {id: .id, created_at: .created_at, name: .name, status: .status}",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, success } = await cmd.output();

  if (!success) {
    console.error(
      "Failed to fetch workflow runs:",
      new TextDecoder().decode(stderr),
    );
    Deno.exit(1);
  }

  const output = new TextDecoder().decode(stdout);
  const runs = output
    .trim()
    .split("\n")
    .filter((line) => line)
    .map((line) => JSON.parse(line));

  return runs;
}

async function deleteWorkflowRun(repo: string, runId: number) {
  const cmd = new Deno.Command("gh", {
    args: [
      "api",
      `repos/${repo}/actions/runs/${runId}`,
      "-X",
      "DELETE",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stderr } = await cmd.output();

  if (!success) {
    console.error(
      `Failed to delete run ${runId}:`,
      new TextDecoder().decode(stderr),
    );
    return false;
  }

  return true;
}

async function main() {
  const { days, repo, yes } = args;
  console.log(`Fetching workflow runs for ${repo}...`);

  const runs = await getWorkflowRuns(repo);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const runsToDelete = runs.filter((run: any) => {
    const runDate = new Date(run.created_at);
    return runDate < cutoffDate;
  });

  console.log(`Found ${runs.length} total workflow runs`);
  console.log(`Found ${runsToDelete.length} runs older than ${days} day(s)`);

  if (runsToDelete.length === 0) {
    console.log("No runs to delete");
    return;
  }

  console.log("\nRuns to delete:");
  for (const run of runsToDelete) {
    const date = new Date(run.created_at).toLocaleString();
    console.log(`  - ${run.name} (${run.status}) - ${date}`);
  }

  // Ask for confirmation unless --yes flag is provided
  if (!yes) {
    const confirmation = prompt("\nDo you want to delete these runs? (y/N)");
    if (confirmation?.toLowerCase() !== "y") {
      console.log("Cancelled");
      return;
    }
  } else {
    console.log("\nProceeding with deletion (--yes flag provided)");
  }

  console.log("\nDeleting runs...");
  let deleted = 0;
  let failed = 0;

  for (const run of runsToDelete) {
    process.stdout.write(`Deleting run ${run.id}...`);
    const success = await deleteWorkflowRun(repo, run.id);
    if (success) {
      console.log(" ✓");
      deleted++;
    } else {
      console.log(" ✗");
      failed++;
    }
  }

  console.log(`\nDeleted ${deleted} runs, failed to delete ${failed} runs`);
}

if (import.meta.main) {
  main();
}
