#!/usr/bin/env node

/**
 * Merge secondary runtime coverage into a primary lcov report.
 *
 * The primary report (Vitest) defines the measured scope for files it contains:
 * a secondary report (Deno, Bun) may raise hits on those files/lines. A
 * secondary-only file is adopted only when every DA record it carries is
 * covered; a partially covered file would bring its zero-hit lines and expand
 * SonarCloud's lines-to-cover to modules the primary run never measured
 * (observed 3,353 -> 9,009 lines).
 *
 * Branch records (BRDA) follow the same scope rule: a secondary report may
 * raise the taken count of a branch the primary recorded, and nothing else.
 * A branch the primary never recorded is not created, for the same reason a
 * zero-hit line is not — it would add branches-found no primary run measured.
 * BRF/BRH are recomputed from the merged BRDA set so the record stays
 * self-consistent. Secondary-only adopted files contribute line data only:
 * every line being covered still permits unhit branches, which would lower
 * branch coverage with data the primary never measured.
 *
 * Fails when no secondary hit matches the primary, so a path-normalization
 * break cannot silently publish pre-merge coverage.
 *
 * Usage: node scripts/merge-lcov.mjs <primary> <secondary>... [-o <output>]
 * Writes to stdout unless -o is given.
 */

import { readFileSync, realpathSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outIndex = args.indexOf("-o");
const output = outIndex === -1 ? null : args[outIndex + 1];
if (outIndex !== -1) args.splice(outIndex, 2);

const [primaryPath, ...secondaryPaths] = args;
if (!primaryPath || secondaryPaths.length === 0) {
  console.error("usage: merge-lcov.mjs <primary> <secondary>... [-o <output>]");
  process.exit(2);
}

// Deno can emit realpath-resolved SF paths; match both the working directory
// and its canonical form so a symlinked checkout still normalizes.
const roots = new Set(
  [process.cwd(), realpathSync(process.cwd())].map(
    (root) => root.replace(/\/+$/, "") + "/",
  ),
);

function relativeSf(path) {
  for (const root of roots) {
    if (path.startsWith(`file://${root}`)) {
      return path.slice(`file://${root}`.length);
    }
    if (path.startsWith(root)) return path.slice(root.length);
  }
  return path;
}

function readBlocks(path) {
  const blocks = [];
  let block;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("SF:")) {
      block = { sf: relativeSf(line.slice(3)), lines: [] };
      blocks.push(block);
    } else if (line === "end_of_record") {
      if (block) block.lines.push(line);
      block = undefined;
    } else if (block) {
      block.lines.push(line);
    }
  }
  return blocks;
}

function daEntries(block) {
  const entries = [];
  for (const line of block.lines) {
    if (!line.startsWith("DA:")) continue;
    const [ln, count] = line.slice(3).split(",");
    entries.push([Number(ln), Number(count)]);
  }
  return entries;
}

// BRDA:<line>,<block>,<branch>,<taken> — `taken` is a hit count or "-" for a
// block that never executed (zero taken, but distinguishable in the record).
function brdaEntry(line) {
  const [ln, block, branch, taken] = line.slice(5).split(",");
  return { key: `${ln},${block},${branch}`, taken };
}

// "-" stays only when neither report executed the branch; otherwise the larger
// numeric count wins and "-" counts as zero.
function maxTaken(a, b) {
  if (a === "-" && b === "-") return "-";
  const left = a === "-" ? 0 : Number(a);
  const right = b === "-" ? 0 : Number(b);
  return String(Math.max(left, right));
}

// The primary report defines the scope for the files it contains.
const primary = readBlocks(primaryPath);
const primaryFiles = new Set(primary.map((block) => block.sf));
const hits = new Map();
for (const block of primary) {
  for (const [ln, count] of daEntries(block)) {
    hits.set(`${block.sf}:${ln}`, count);
  }
}

// Branch scope per file: the branch keys the primary recorded, and their taken
// counts as they are merged forward.
const branches = new Map();
for (const block of primary) {
  const record = branches.get(block.sf) ?? new Map();
  for (const line of block.lines) {
    if (!line.startsWith("BRDA:")) continue;
    const { key, taken } = brdaEntry(line);
    // Same SF twice is legal lcov: merge the records rather than letting the
    // later one drop the earlier one's branch keys.
    const previous = record.get(key);
    record.set(key, previous === undefined ? taken : maxTaken(previous, taken));
  }
  branches.set(block.sf, record);
}

// Secondary-only files are adopted only when fully covered.
const extra = new Map();
let matched = 0;
for (const path of secondaryPaths) {
  for (const block of readBlocks(path)) {
    if (!primaryFiles.has(block.sf)) {
      const file = extra.get(block.sf) ?? {
        lines: new Map(),
        fullyCovered: true,
      };
      for (const [ln, count] of daEntries(block)) {
        file.lines.set(ln, Math.max(file.lines.get(ln) ?? 0, count));
        if (count === 0) file.fullyCovered = false;
      }
      extra.set(block.sf, file);
      continue;
    }

    for (const [ln, count] of daEntries(block)) {
      const key = `${block.sf}:${ln}`;
      if (!hits.has(key)) continue;
      matched++;
      hits.set(key, Math.max(hits.get(key), count));
    }

    const branchRecord = branches.get(block.sf);
    if (!branchRecord) continue;
    for (const line of block.lines) {
      if (!line.startsWith("BRDA:")) continue;
      const { key, taken } = brdaEntry(line);
      if (!branchRecord.has(key)) continue;
      matched++;
      branchRecord.set(key, maxTaken(branchRecord.get(key), taken));
    }
  }
}

if (matched === 0) {
  console.error(
    "merge-lcov: no secondary coverage matched the primary report; check SF paths",
  );
  process.exit(1);
}

const out = [];
for (const block of primary) {
  const daLines = [];
  let lf = 0;
  let lh = 0;
  for (const [ln] of daEntries(block)) {
    const count = hits.get(`${block.sf}:${ln}`) ?? 0;
    daLines.push(`DA:${ln},${count}`);
    lf++;
    if (count > 0) lh++;
  }

  // Branch totals are per record, like LF/LH above. A file may legally appear
  // in several primary records, and a record must describe only its own BRDA
  // lines — a file-wide total would double the denominator for any summing
  // consumer (lcov --add-tracefile), the inflation this script exists to avoid.
  const branchRecord = branches.get(block.sf);
  let brf = 0;
  let brh = 0;
  for (const line of block.lines) {
    if (!line.startsWith("BRDA:")) continue;
    const { key } = brdaEntry(line);
    const taken = branchRecord.get(key) ?? "-";
    brf++;
    if (taken !== "-" && Number(taken) > 0) brh++;
  }
  const hasBranches = brf > 0;

  out.push(`SF:${block.sf}`);
  let da = 0;
  for (const line of block.lines) {
    if (line.startsWith("LF:")) out.push(`LF:${lf}`);
    else if (line.startsWith("LH:")) out.push(`LH:${lh}`);
    else if (line.startsWith("DA:")) out.push(daLines[da++]);
    else if (hasBranches && line.startsWith("BRDA:")) {
      const { key, taken } = brdaEntry(line);
      out.push(`BRDA:${key},${branchRecord.get(key) ?? taken}`);
    } else if (hasBranches && line.startsWith("BRF:")) out.push(`BRF:${brf}`);
    else if (hasBranches && line.startsWith("BRH:")) out.push(`BRH:${brh}`);
    else out.push(line);
  }
}

for (const [sf, file] of extra) {
  if (!file.fullyCovered) continue;
  const lines = [...file.lines].sort(([a], [b]) => a - b);
  out.push(`SF:${sf}`);
  for (const [ln, count] of lines) out.push(`DA:${ln},${count}`);
  out.push(`LF:${lines.length}`);
  out.push(`LH:${lines.filter(([, count]) => count > 0).length}`);
  out.push("end_of_record");
}

const text = out.join("\n") + "\n";
if (output) writeFileSync(output, text);
else process.stdout.write(text);
