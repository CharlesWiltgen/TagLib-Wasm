#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Runs Deno tests and creates a test report in SonarQube's generic test execution format
 */

import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { dirname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

interface TestResult {
  name: string;
  file: string;
  duration: number;
  status: "passed" | "failed" | "skipped";
  error?: string;
}

async function runTestsWithReporting() {
  const results: TestResult[] = [];

  // Run deno test with JSON output
  const cmd = new Deno.Command("deno", {
    args: ["test", "--allow-all", "--reporter=dot", "tests/"],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, code } = await cmd.output();

  if (code !== 0 && code !== 1) { // 1 means some tests failed, which is ok
    console.error("Error running tests:", new TextDecoder().decode(stderr));
    Deno.exit(1);
  }

  // Parse test output
  const output = new TextDecoder().decode(stdout);
  const lines = output.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      if (event.type === "testEnd") {
        results.push({
          name: event.name,
          file: event.origin || "unknown",
          duration: event.duration || 0,
          status: event.result === "ok"
            ? "passed"
            : event.result === "ignored"
            ? "skipped"
            : "failed",
          error: event.error,
        });
      }
    } catch {
      // Ignore non-JSON lines
    }
  }

  // Generate SonarQube generic test execution report
  const report = {
    testExecutions: results.map((result) => ({
      name: result.name,
      duration: Math.round(result.duration),
      status: result.status.toUpperCase(),
      message: result.error,
      testFile: result.file.replace(Deno.cwd() + "/", ""),
    })),
  };

  // Write report
  const reportPath = join(Deno.cwd(), "test-results-sonar.json");
  await Deno.writeTextFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nTest report written to: ${reportPath}`);
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.status === "passed").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log(
    `Skipped: ${results.filter((r) => r.status === "skipped").length}`,
  );
}

if (import.meta.main) {
  await runTestsWithReporting();
}
