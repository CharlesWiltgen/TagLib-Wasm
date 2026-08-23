---
name: taglib-wasm-preflight
description: Use when preparing to release taglib-wasm to JSR and npm, before invoking `deno task release`, cutting a version tag, or accepting a user-supplied version number for a release
---

# TagLib-Wasm Preflight

## Overview

`scripts/release-safe.sh` (`deno task release`) automates mechanical checks: fmt, lint, typecheck, tests, Wasm freshness, `deno publish --dry-run`, `publint`, `arethetypeswrong`, `npm pack --dry-run`, version sync. **It cannot make judgment calls.** This skill covers what you must decide _before_ invoking the script.

**Core principle:** The script blocks bad releases. The skill prevents bad releases from being attempted.

## When to Use

- Before running `deno task release` or `deno task release <version>`
- Before cutting any git tag matching `v*`
- **Especially when the user supplies a version number** — verify it before honoring it

## 1. Semver Decision

**Violating the letter of semver is violating the spirit of semver.** Classify the release by inspecting the diff, not by trusting the user-supplied number. If a user-proposed version conflicts with your classification, STOP and surface the conflict before doing anything else.

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
git log "$LAST_TAG"..HEAD --oneline
git diff "$LAST_TAG"..HEAD -- index.ts simple.ts folder.ts web.ts rating.ts src/types.ts
```

| Change                                                                 | Bump                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Bug fix, internal refactor, doc-only                                   | patch                                                 |
| **New public export** (function, type, entry point, field)             | **minor**                                             |
| **Removed or renamed public export, changed signature, narrowed type** | **major**                                             |
| Submodule bump in `lib/taglib`                                         | depends on what upstream changed — read its CHANGELOG |

### Rationalizations to reject

| Excuse                             | Reality                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| "User said 1.2.1, so it's a patch" | Users mis-classify all the time. Your job is to flag it.             |
| "The new function is small"        | Public API additions are minor regardless of size.                   |
| "It's marked `@internal`"          | Only safe if actually unreachable from a public entry point. Verify. |
| "Nobody's using it yet"            | Once published, you've made a semver promise.                        |

## 2. Public API Diff

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
for entry in index.ts simple.ts folder.ts web.ts rating.ts; do
  diff <(git show "$LAST_TAG:$entry" 2>/dev/null | deno doc - 2>/dev/null) \
       <(deno doc "$entry" 2>/dev/null) || true
done
```

Confirm every added/removed/changed export is intentional and matches your semver classification from §1.

## 3. Knip Triage

```bash
deno task knip
```

Each finding is a **review item, not an auto-delete**:

- Unused export in a public entry file (`index.ts`, `simple.ts`, etc.) → almost certainly intentional (library surface). Add to `knip.json` ignore.
- Unused dep listed in `deno.json` imports → verify it isn't used by `tests/` or via dynamic import before removing.
- Unused file → check `git log -- <file>` for context; deleted features sometimes leave callable-but-unused files.

## 4. Coverage Threshold (CLAUDE.md target: 80%)

```bash
rm -rf cov_profile && \
  deno test --coverage=cov_profile --allow-read --allow-write --allow-env \
    --v8-flags=--expose-gc tests/ && \
  deno coverage cov_profile
```

<!-- --v8-flags=--expose-gc is REQUIRED: tests/auto-dispose.test.ts throws
     without it and the run exits non-zero (taglib-t4sn / taglib-aqle). -->

If overall < 80%: either add tests, or document the regression and reason in release notes. Do not silently ship below threshold.

## 5. Wasm Size Delta (especially after `lib/taglib` bumps)

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
for w in build/taglib-web.wasm build/taglib-wasi.wasm; do
  OLD=$(git show "$LAST_TAG:$w" 2>/dev/null | wc -c)
  NEW=$(wc -c < "$w")
  echo "$w: $OLD -> $NEW ($(( (NEW - OLD) * 100 / OLD ))%)"
done
```

Any growth >5% needs an identified cause (new feature, upstream change). Unexplained growth = stop and investigate.

## 6. Beads State

```bash
bd ready                       # any P0/P1 ready that should block?
bd list --status=in_progress   # anything critical mid-flight?
```

Tag only when the beads state reflects what you're shipping.

> **No `bd dolt push`.** This project uses local embedded Dolt with **no sync
> remote** (see `.beads/config.yaml`). There is no beads push step — and do NOT
> add one pointing at the public GitHub repo: it would leak Dolt refs
> (`refs/dolt/data` and a visible `__dolt_remote_info__` branch) into it. Beads
> data lives only in the local embedded DB plus the `.beads/` JSONL backup.

## 7. Release Notes

Draft notes covering: new features, fixes, breaking changes, deprecations. For new public API, include a usage example. Match the detail of `MEMORY.md` release entries.

**Docs accuracy:** this skill covers code, not prose. For the docs, run the
companion `/tlw-preflight-docs` (tiered: 1 quick API-sync / 2 +examples / 3 full).
At minimum run Tier 1 when the release changed the public API, so a new or changed
export doesn't ship undocumented (`deno task docs:coverage` is the mechanical check).

## After Preflight Passes

```bash
deno task release <version>    # or deno task release for auto-patch
```

## Red Flags — STOP

- User supplied a version; you didn't verify it against the diff
- `deno task knip` shows new findings you haven't triaged
- Coverage dropped vs. last release with no explanation
- Wasm size grew >5% with no identified cause
- Submodule bump but `git status` shows clean `build/*.wasm` (not rebuilt)
- "Let's use `release:quick` to skip these checks" — only valid if this preflight ran in the last hour and nothing changed

All of these mean: pause, finish the checklist, then release.
