---
name: publish
description: Use when shipping a taglib-wasm release to JSR/npm/GitHub Packages after preflight has passed — invoking `deno task release`, verifying a published version actually landed, or recovering a partial, skipped, or failed publish.
---

# TagLib-Wasm Publish

## Overview

**`release-safe.sh` dispatches the publish workflow; the workflow creates the
tag and the GitHub release _last_, and only once every registry has the
version.** (`.github/workflows/publish-everywhere.yml`, `finalize` job)

A pushed `v*` tag by itself publishes **nothing**. `on: release: [published]`
is now a manual escape hatch — the workflow's own `gh release create` runs with
`GITHUB_TOKEN`, whose events do not re-trigger workflows. A failed publish leg
therefore leaves **no tag and no release** to unwind, and the script fails
loudly (exit 1) if `gh` is missing or the dispatch is rejected, instead of
printing a manual URL and exiting 0 the way it used to.

Run `/taglib-wasm-preflight` first. This skill starts where that one ends.

## When to Use

- Preflight passed and you're ready to ship a version
- A publish run failed, was skipped, or published to only some registries
- You need to confirm a version actually landed on JSR/npm

**Do not use** to decide the version number — that is `/taglib-wasm-preflight` §1.

## The Command

```bash
yes | deno task release <version>     # e.g. 1.6.1
```

`yes |` answers the script's two interactive `read -p` prompts. **Confirm you
are on `main` before piping `yes`** — one of those prompts is
"Not on main branch. Continue anyway?" (`scripts/release-safe.sh:41`), and
`yes` bypasses it. Check first:

```bash
git rev-parse --abbrev-ref HEAD    # must be main
git status --short                 # must be empty
git fetch origin main && git rev-parse HEAD origin/main   # must match
```

## What the Script Does

| Phase                 | Detail                                                                                           | Time    |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| Pre-checks            | main branch, clean tree, `HEAD == origin/main`, version sync                                     | seconds |
| **Prompt**            | "Continue with this version change? (y/N)"                                                       | —       |
| Tests #1              | `deno fmt --check`, `deno lint`, `deno check ./src ./tests`, `deno task test`, `deno task build` | —       |
| Wasm freshness        | `git diff --quiet` on both `build/*.wasm` after that real rebuild                                | seconds |
| Package preflight     | `deno publish --dry-run`, npm build, `publint`, `arethetypeswrong`, `npm pack --dry-run`         | —       |
| Version bump          | `sync-version.ts set` across 4 files                                                             | seconds |
| **Tests #2**          | the whole test+build block runs **again**, rebuilding both backends                              | —       |
| Commit + push         | `chore: bump version to X` → `git push origin main`                                              | seconds |
| **CI gate**           | `wait-for-ci.sh` polls `ci.yml` for that SHA, 900s max                                           | ~5 min  |
| **npm publish path**  | `check-publish-access.sh` — trusted-publisher entry; needs a fresh browser 2FA to read it        | seconds |
| Dispatch              | `gh workflow run publish-everywhere.yml -f version=X`                                            | seconds |
| **Watch**             | `gh run watch`, then `gh release view` — a green run is not proof; the release object is         | ~5 min  |
| Tag + release (in CI) | `finalize` creates the tag at the built SHA + the release with CHANGELOG notes, only on success  | seconds |

**Budget ~10 minutes and do not interrupt.** Measured end-to-end on the 1.6.1
release: **7 min 17 s** total, of which **~4 min 50 s was the CI wait** — so
everything local (both test+build rounds, the package preflight, the version
bump) came to about 2.5 minutes on an M-series Mac.

Do not be misled by `deno task build` running twice and rebuilding both
backends each time (`build-wasm.sh:43` even wipes its CMake dir for a clean
Emscripten build). It is genuinely that fast here; the release script pipes
build output to `/dev/null` (`release-safe.sh:113`), so the phase looks stalled
when it is not. Budget more only for a cold `lib/taglib` or a slower machine.

Run it in the background anyway if you want the session responsive — the CI
wait dominates and nothing useful streams during it.

The CI gate tolerates flaky Windows/macOS legs but requires: Lint & Format,
Build (Embind), Test (ubuntu-latest), Build (WASI), Test (WASI), Package
Compatibility (`scripts/wait-for-ci.sh:22-35`).

## The Publish Pipeline

Strictly gated, so a broken JSR publish never reaches npm:

```
prepare-and-build → publish-jsr → publish-npm → publish-github
                          ↓
                     verify-jsr
```

- **JSR first**, deliberately — fail-fast if OIDC is broken.
- **npm only if JSR published**; **GitHub Packages only if both** did.
- **`verify-jsr`** pulls the _actually published_ package and instantiates both
  backends. It is the only check that catches `deno publish`'s wasm import
  unfurl, which rewrites the binary **after** the build guard runs — the
  1.4.1/1.4.2 regressions. Never dismiss a `verify-jsr` failure as flake.
  **It runs parallel to `publish-npm`, not ahead of it** (`publish-npm` needs
  only `publish-jsr`), so a corrupt wasm can reach npm while `verify-jsr` is
  still failing. If it goes red, check npm immediately.
  `finalize` also needs `verify-jsr` (since 2026-09-17), so a red `verify-jsr`
  additionally blocks the tag and the GitHub release — the version may be on
  npm with no release to show for it. The run's failure summary names which
  legs failed and which registries already have the version.
- All three publish steps treat "already published" as success, so a re-run is
  idempotent.

## Post-Publish Verification (REQUIRED)

Watching the workflow start is not verifying it finished.

```bash
gh run watch $(gh run list --workflow=publish-everywhere.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh release view "v<version>"        # created by finalize, last, only on success
curl -s -o /dev/null -w '%{http_code}\n' "https://registry.npmjs.org/taglib-wasm/<version>"   # 200 = published

# Mirrors the verify-jsr job: a temp file, not `deno eval` (--reload is a run flag).
printf 'import { TagLib } from "jsr:@charlesw/taglib-wasm@%s";\nawait TagLib.initialize({ forceWasmType: "wasi" });\nawait TagLib.initialize({ forceWasmType: "emscripten" });\nconsole.log("both backends instantiate");\n' "<version>" > /tmp/verify.ts
deno run --reload --no-lock --minimum-dependency-age=0 --allow-read --allow-env --allow-net /tmp/verify.ts
```

Report the release complete only after the version answers **200 at the
immutable endpoint**. `npm view taglib-wasm@<version>` reads a CDN-cached
packument and can answer "not found" for minutes after a genuinely successful
publish — measured on 2.2.3, which is why the workflow's own verification step
queries the version URL (`publish-everywhere.yml`, "Verify NPM publication").
A green run alone is also not proof: `should-publish=false` skips every publish
job and `finalize` while the run still concludes success.

## Failure Recovery

| Symptom                                               | Cause                                                                              | Fix                                                                                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag exists, nothing published                         | Tag from an earlier flow, or a manual tag                                          | `gh workflow run publish-everywhere.yml -f version=X`; publish the release if one exists as a draft                                                                                                     |
| Workflow ran, published nothing                       | `should-publish=false` — version already on npm                                    | Expected idempotence. Nothing to do.                                                                                                                                                                    |
| CI gate failed                                        | Required leg failed on the bump commit                                             | Bump commit is **already on main**; no tag was created. Fix forward, push, re-run the release.                                                                                                          |
| `*.wasm is stale!`                                    | Committed binary ≠ fresh build                                                     | `git add build/*.wasm && git commit --amend --no-edit`, re-run                                                                                                                                          |
| JSR published, npm failed                             | npm auth: trusted-publisher entry missing, for another repo, or stage-publish only | `scripts/check-publish-access.sh`, then `npm trust github taglib-wasm --file publish-everywhere.yml --repository CharlesWiltgen/TagLib-Wasm --allow-publish -y` (browser 2FA), then re-run — JSR no-ops |
| `Tag vX exists at <sha>, not at the published commit` | A tag for this version already points elsewhere                                    | **No release was created.** Resolve the tag (delete or move it), then re-run `finalize`                                                                                                                 |
| Bad version published                                 | —                                                                                  | **JSR cannot unpublish.** npm: `npm deprecate` (unpublish forces a 24h wait). Ship a patch.                                                                                                             |

## Red Flags — STOP

- Piping `yes` without having checked the branch
- Interrupting during the Wasm rebuild or the CI wait
- Treating a `verify-jsr` failure as flake — it means the shipped binary is corrupt
- Calling it done because the workflow went green — confirm `gh release view v<version>` exists and the version answers 200 at the immutable endpoint
- Reaching for `release:quick` to skip a gate — it can't: `scripts/release.sh` was deleted (2026-09-17) and the task is `release-safe.sh --skip-watch`, which runs every gate above and only skips waiting for the publish result

## Notes

- `.claude/skills/` is committed (the rest of `.claude/` stays gitignored), so
  this skill ships with the repo and is available in every checkout.
- Beads has **no sync remote**; there is no `bd dolt push` step in a release.
- Per-repo memory: drive the release yourself rather than handing the user a
  command to run.
