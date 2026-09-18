---
name: publish
description: Use when shipping a taglib-wasm release to JSR/npm/GitHub Packages after preflight has passed — invoking `deno task release`, verifying a published version actually landed, or recovering a partial, skipped, or failed publish.
---

# TagLib-Wasm Publish

## Overview

**`release-safe.sh` dispatches the publish workflow; the workflow creates the
tag and the GitHub release _last_, once JSR and npm are verified and all three
publish legs succeeded.** (`.github/workflows/publish-everywhere.yml`, `finalize`
job; GitHub Packages' own post-publish check is deliberately fail-soft — that
registry can serve a stale packument, so it warns instead of failing a release
that genuinely landed.)

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

| Phase                 | Detail                                                                                                                                                        | Time    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Pre-checks            | main branch, clean tree, `HEAD == origin/main`, version sync                                                                                                  | seconds |
| **Prompt**            | "Continue with this version change? (y/N)"                                                                                                                    | —       |
| Tests #1              | `deno fmt --check`, `deno lint`, `deno check ./src ./tests`, `deno task test`, `deno task build`                                                              | —       |
| Wasm freshness        | `git diff --quiet` on both `build/*.wasm` after that real rebuild                                                                                             | seconds |
| Package preflight     | `deno publish --dry-run`, npm build, `publint`, `arethetypeswrong`, `npm pack --dry-run`                                                                      | —       |
| Version bump          | `sync-version.ts set` across 4 files                                                                                                                          | seconds |
| **Tests #2**          | the whole test+build block runs **again**, rebuilding both backends                                                                                           | —       |
| Commit + push         | `chore: bump version to X` → `git push origin main`                                                                                                           | seconds |
| **CI gate**           | `wait-for-ci.sh` polls `ci.yml` for that SHA, 900s max                                                                                                        | ~5 min  |
| **npm publish path**  | `check-publish-access.sh` — trusted-publisher entry; needs a fresh browser 2FA to read it                                                                     | seconds |
| Dispatch              | `gh workflow run publish-everywhere.yml -f version=X`                                                                                                         | seconds |
| **Watch**             | `gh run watch`, then `gh release view` — a green run is not proof; the release object is. Pauses for a reviewer once the `release` environment exists (below) | ~5 min  |
| Tag + release (in CI) | `finalize` creates the tag at the built SHA + the release with CHANGELOG notes, only on success                                                               | seconds |

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

## Release Approval Gate (GitHub Environment) — prepared, not yet enabled

The npm leg is destined to carry `environment: release`. Once the package's
trusted-publisher entry records that environment, the registry only mints an npm
token for a workflow run whose job was **approved**, so publish rights stop
following plain repository write access (the stronger half of SEC-02 /
taglib-80l8).

**Why it is not landed yet.** Referencing an environment changes the OIDC `sub`
claim — `repo:OWNER/REPO:environment:NAME`, with the ref component dropped
(GitHub's OIDC reference). npm's docs never say whether a token that carries an
environment claim is accepted by an entry that does not record one, and the
registry demonstrably parses `sub` (npm/cli#9969: a token whose every other
claim matched was rejected over the `sub` format alone). A wrong guess is not
neutral: JSR publishes **first**, so an npm exchange that starts failing leaves
a JSR version that cannot be unpublished. Do all three steps before the next
release, in this order.

**1. Create the environment.** This must come first — GitHub auto-creates an
environment as soon as a workflow references one, and an auto-created one has
**no protection rules**, so landing the workflow first yields an ungated
`release` that looks configured.

- Settings → Environments → New environment → name it `release`.
- **Required reviewers**: add the reviewers (up to 6; one approval clears the
  gate).
- Leave **Prevent self-review** off unless a second reviewer exists: with it on,
  whoever dispatched the run cannot approve it, which deadlocks a solo release.
- Consider deselecting **Allow administrators to bypass configured protection
  rules** (on by default) — otherwise an admin can skip the gate entirely, which
  is the whole point of the change.
- Verify with `gh api repos/CharlesWiltgen/TagLib-Wasm/environments`
  (`required_reviewers` must appear in `protection_rules`).
  `scripts/release-safe.sh` reads exactly that and announces the pause.

**2. Record it on the npm side.** Trust entries cannot be edited in place
(`npm help trust`: "Existing trusted publisher connections cannot be changed"),
so this is list → revoke → recreate. Flags verified against
`npm trust github --help` on npm 11.19 (`--env` is the alias of
`--environment`):

```bash
npm trust list taglib-wasm                    # note the record's id
npm trust revoke --id <id> taglib-wasm
npm trust github taglib-wasm --file publish-everywhere.yml \
  --repository CharlesWiltgen/TagLib-Wasm --env release --allow-publish -y
```

Both `npm trust` calls need a browser 2FA approval. Afterwards
`npm trust list taglib-wasm` shows an `environment: release` line and
`scripts/check-publish-access.sh` still passes (it judges repository, workflow
file and publish permission; it does not judge the environment).

**3. Land the workflow change.** `environment: release` on the `publish-npm`
job **only** — one job-level key next to its `runs-on: ubuntu-latest`. Gating
the other legs buys no boundary and costs clicks: only the npm exchange has a
server-side environment requirement to bind to, and an actor who can edit the
workflow file can drop the key from any job they also control — so the
protection comes from the record in step 2, not from the YAML. `finalize` mints
no OIDC token and only runs after every leg succeeded, so it stays ungated.
While landing it, add `--env release` to the remedy command that
`scripts/check-publish-access.sh` prints, or a later recovery would recreate an
entry without the environment.

**Per release, once landed:** the run pauses at `Publish to NPM` until a
reviewer approves that deployment. `gh run watch` waits for it — it has no
timeout of its own (`gh run watch --help` offers only `--interval`) — and
`scripts/release-safe.sh` announces the pause, including on `release:quick`,
which returns before it.

- UI: the run page shows **Review deployments** →
  approve (it names the workflow, ref and commit — check they are the intended
  release, not a branch dispatch).
- Terminal (a required reviewer's credentials; endpoints per the REST docs for
  "Get/Review pending deployments for a workflow run"):

```bash
RUN=<run id>
gh api repos/CharlesWiltgen/TagLib-Wasm/actions/runs/$RUN/pending_deployments   # lists environment_ids
gh api -X POST repos/CharlesWiltgen/TagLib-Wasm/actions/runs/$RUN/pending_deployments \
  --input - <<< '{"environment_ids":[<id>],"state":"approved","comment":"approved"}'
```

`state` also accepts `rejected`. Each gated job creates its own deployment, so a
run that gates more than one job shows more than one approval.

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

There is no equivalent immutable endpoint for the GitHub Packages leg, so do not
expect one: its post-publish step is fail-soft and **cannot** be made definitive
under the credentials the workflow has (re-investigated 2026-09-18, taglib-80l8).
The REST packages API that would list the versions needs the `read:packages`
scope — measured 403 on
`/users/CharlesWiltgen/packages/npm/<name>/versions`, and GitHub's REST docs
require a _classic personal access token_ for packages management, i.e. the
long-lived credential class this pipeline exists to remove. There is no
documented `/repos/{owner}/{repo}/packages` endpoint (404 measured), anonymous
registry reads are rejected even for a public package (401 for the packument,
403 for a tarball path), and the registry exposes no per-version route (405), so
the packument is the only observable. If that registry is ever the thing you
must be sure about, check it by hand with a `read:packages` token rather than
reading the run's warning as failure.

## Failure Recovery

| Symptom                                               | Cause                                                                                                                           | Fix                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag exists, nothing published                         | Tag from an earlier flow, or a manual tag                                                                                       | If the tag points at the commit you are publishing, `gh workflow run publish-everywhere.yml -f version=X`; **if it points elsewhere, resolve the tag first** — `finalize` refuses a mismatch and creates no release |
| Workflow ran, published nothing                       | `should-publish=false` — version already on npm                                                                                 | Expected idempotence. Nothing to do.                                                                                                                                                                                |
| CI gate failed                                        | Required leg failed on the bump commit                                                                                          | Bump commit is **already on main**; no tag was created. Fix forward, push, re-run the release.                                                                                                                      |
| `*.wasm is stale!`                                    | Committed binary ≠ fresh build                                                                                                  | `git add build/*.wasm && git commit --amend --no-edit`, re-run                                                                                                                                                      |
| JSR published, npm failed                             | npm auth: trusted-publisher entry missing, for another repo, stage-publish only, or disagreeing about the `release` environment | `scripts/check-publish-access.sh`, then `npm trust github taglib-wasm --file publish-everywhere.yml --repository CharlesWiltgen/TagLib-Wasm --allow-publish -y` (browser 2FA), then re-run — JSR no-ops             |
| Publish run sits "waiting"                            | The `release` environment has required reviewers and awaits an approval — not a hang                                            | Approve the deployment (see the Approval Gate section); nothing else will move it                                                                                                                                   |
| `Tag vX exists at <sha>, not at the published commit` | A tag for this version already points elsewhere                                                                                 | **No release was created.** Resolve the tag (delete or move it), then re-run `finalize`                                                                                                                             |
| Bad version published                                 | —                                                                                                                               | **JSR cannot unpublish.** npm: `npm deprecate` (unpublish forces a 24h wait). Ship a patch.                                                                                                                         |

## Red Flags — STOP

- Piping `yes` without having checked the branch
- Interrupting during the Wasm rebuild or the CI wait
- Treating a `verify-jsr` failure as flake — it means the shipped binary is corrupt
- Calling it done because the workflow went green — confirm `gh release view v<version>` exists and the version answers 200 at the immutable endpoint
- Reaching for `release:quick` to skip a gate — it can't: `scripts/release.sh` was deleted (2026-09-17) and the task is `release-safe.sh --skip-watch`, which runs every gate above and only skips waiting for the publish result. With an approval gate it also returns before the approval, so the release waits on you, not on CI
- Reading a paused publish run as a hang — once the `release` environment exists, a run waiting for its deployment approval is working as designed
- Landing the workflow `environment:` before the npm entry records the same environment (or the other way round) — the two must agree _before_ a release runs; see the Approval Gate section for the order

## Notes

- `.claude/skills/` is committed (the rest of `.claude/` stays gitignored), so
  this skill ships with the repo and is available in every checkout.
- Beads has **no sync remote**; there is no `bd dolt push` step in a release.
- Per-repo memory: drive the release yourself rather than handing the user a
  command to run.
