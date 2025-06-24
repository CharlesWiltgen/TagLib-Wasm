#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Adds SonarQube ignore comments to test files to suppress false positives
 * about missing tests in files that use Deno.test()
 */

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const SONAR_IGNORE_COMMENT =
  "/* eslint-disable sonarjs/no-empty-test-file */\n// NOSONAR: This file contains Deno tests which SonarQube doesn't recognize\n\n";

async function addSonarIgnoreToTests() {
  const testsDir = join(Deno.cwd(), "tests");

  for await (
    const entry of walk(testsDir, {
      exts: [".test.ts"],
      includeDirs: false,
    })
  ) {
    console.log(`Processing ${entry.path}...`);

    const content = await Deno.readTextFile(entry.path);

    // Check if it already has the ignore comment
    if (
      content.includes("NOSONAR") ||
      content.includes("sonarjs/no-empty-test-file")
    ) {
      console.log(`  → Already has ignore comment, skipping`);
      continue;
    }

    // Check if it contains Deno.test
    if (!content.includes("Deno.test")) {
      console.log(`  → No Deno.test found, skipping`);
      continue;
    }

    // Add the comment at the beginning of the file
    const newContent = SONAR_IGNORE_COMMENT + content;
    await Deno.writeTextFile(entry.path, newContent);
    console.log(`  → Added SonarQube ignore comment`);
  }
}

if (import.meta.main) {
  await addSonarIgnoreToTests();
  console.log("\nDone! SonarQube ignore comments added to test files.");
}
