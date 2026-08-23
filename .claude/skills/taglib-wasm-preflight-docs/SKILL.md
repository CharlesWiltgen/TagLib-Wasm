---
name: taglib-wasm-preflight-docs
description: Use when reviewing taglib-wasm documentation for accuracy and coverage — before a release, after adding/changing/removing a public export, or whenever auditing whether README/AGENTS/docs match the shipped API surface. Asks for a rigor tier (1 quick / 2 standard / 3 full).
---

# TagLib-Wasm Docs Preflight

## Overview

A **tiered documentation review** — the docs companion to `/taglib-wasm-preflight`. `/taglib-wasm-preflight`
verifies the _code_ is releasable; this verifies the _docs_ match what ships.

`scripts/docs-coverage.ts` (`deno task docs:coverage`) is the mechanical aid: it
lists every public export not referenced anywhere in `README.md` / `AGENTS.md` /
`docs/`. **It only catches "shipped an export, never mentioned it"** — it does not
judge whether a doc is _accurate_. Accuracy, examples, prose, and completeness are
this skill's judgment job.

**Core principle:** never silently auto-edit docs. Produce findings; the operator
decides fixes.

## When to Use

- Before a release (after `/taglib-wasm-preflight`'s semver + public-API-diff work).
- After adding, changing, or removing any public export.
- When asked to "review/audit the docs" or check docs are in sync with source.

Per `CLAUDE.md`, "documentation" means all three: `README.md`, `/docs`, and `AGENTS.md`.

## Pick a rigor tier (ASK first)

On invocation, **ask the operator which tier to run** (or honor an arg, e.g.
`/taglib-wasm-preflight-docs 3`). Rule of thumb: **Tier 1** for a routine pre-release check,
**Tier 3** for a periodic full audit. Each tier is cumulative.

### Tier 1 — API sync (fast)

1. Run `deno task docs:coverage`. For each undocumented export, decide:
   **intentional internal** → add to `ALLOWLIST` in the script _with justification_;
   **real gap** → document it (function/class/user-facing type) in the right page.
2. For symbols changed since the last tag, confirm the docs still match:
   `git diff $(git describe --tags --abbrev=0)..HEAD -- index.ts simple.ts folder.ts web.ts rating.ts src/types.ts`,
   then grep `docs/` for each changed symbol and read the surrounding prose.
3. Flag any export added/changed/removed since the last tag **without** a doc update.

### Tier 2 — + Examples (standard)

Everything in Tier 1, plus:

4. Extract fenced `` ```ts `` / `` ```typescript `` code blocks from the docs and
   type-check them against the real API (assemble into a temp module and
   `deno check`, or read each import/signature against source). Catch stale or
   broken examples — especially after a signature or type change.

### Tier 3 — + Prose / links / completeness (full)

Everything in Tier 2, plus:

5. **Prose** — run the user-facing guide pages through
   `elements-of-style:writing-clearly-and-concisely`.
6. **Links** — check internal links across `docs/` resolve (no dead `./…` targets).
7. **Completeness** — every major feature area has a guide and/or API page; the
   `CHANGELOG.md` covers the release; cross-backend (WASI vs Emscripten) behavior
   notes are accurate (cross-reference `tests/PARITY-COVERAGE.md`).

## Output

Group findings by severity so the operator can triage:

- **Missing API** — public export with no doc mention (coverage script).
- **Inaccurate** — documented signature/behavior no longer matches source.
- **Stale example** — doc code that no longer compiles/runs.
- **Prose / Link / Structural** — lower-severity polish.

## Known baseline (first Tier-3 audit, 2026-06-25)

The first full audit found **~52 public exports undocumented** (26 functions incl.
`clearTags` / `readMetadata` / `readFormat` / `getTagLib` / `isValidAudioFile` /
`createTagLib`; 24 types; 2 advanced constants). This is tracked as doc-coverage
debt in **taglib-5w2**. Expect `deno task docs:coverage` to report a _shrinking_
backlog until it's burned down — a red result is the prioritized doc TODO, not a
blocker for an unrelated release.

## Red flags — STOP and document

- A new public export shipped with **no** doc mention (the `bitrateMode`-class bug
  that spawned taglib-5w2).
- A documented signature or behavior that no longer matches source.
- A doc code example that no longer compiles.
- "Just allowlist it" for a user-facing **function** — the allowlist is for genuine
  internals (impl classes, lookup tables) only.
