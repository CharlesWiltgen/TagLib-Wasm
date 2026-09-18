#!/bin/bash
# Verify the npm publish path BEFORE a release is tagged.
#
# The npm leg of .github/workflows/publish-everywhere.yml authenticates with OIDC
# trusted publishing: there is no token to check and no token to rotate. The
# registry authorizes a publish only when the package has a trusted-publisher
# entry matching this repository AND this workflow file. When that entry is
# missing or names something else, the release fails *after* the tag and the
# GitHub release exist (the 2.2.3 incident, taglib-gmgj / taglib-ljh6).
#
# Reading trust configs needs an authenticated npm session plus a fresh browser
# 2FA approval, so this cannot run unattended in CI. Exit codes:
#   0  verified, or unverifiable (no session / 2FA prompt) — caller may proceed
#   1  definitively broken — caller must not tag
#
# Usage: scripts/check-publish-access.sh
#
# The verdicts below are pinned by tests/check-publish-access.test.ts, which runs
# this script against a stub `npm` on a shimmed PATH (no session, no registry):
# run it after any change to the checks, or a shape npm prints differently will
# be found on a release instead of there. The bare invocation, since the file
# needs a grant CI does not use:
#
#   deno test --allow-read --allow-write --allow-env --allow-run \
#     tests/check-publish-access.test.ts
set -uo pipefail

PACKAGE="taglib-wasm"
WORKFLOW_FILE="publish-everywhere.yml"
REPOSITORY="CharlesWiltgen/TagLib-Wasm"

ok() { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ⚠ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; }

remedy() {
  cat <<'EOF'

  Fix (each command needs a browser 2FA approval):

      npm login --auth-type=web
      npm trust github taglib-wasm --file publish-everywhere.yml \
        --repository CharlesWiltgen/TagLib-Wasm --allow-publish -y

  An entry created in the npm web UI defaults to stage-publish only;
  --allow-publish is what permits `npm publish`. Renaming or moving
  .github/workflows/publish-everywhere.yml invalidates the entry.
EOF
}

# The remedy above only *adds* a trust config, which cannot clear a record that
# already claims our workflow file without authorizing this repository (a
# different repository, or stage publish only): the registry keys a config by its
# claims, so a second one for the same file is at best a duplicate, and the guard
# would report the same mismatch again. Printed after `remedy` when the state the
# guard judged contains such a record — the record's `id` is in the listing shown
# above, and `npm trust revoke` takes it.
remedy_revoke() {
  cat <<EOF

  A record above already claims ${WORKFLOW_FILE} without authorizing a publish of
  ${REPOSITORY}. Revoke it *before* the add command above, or the state this check
  just refused stands:

      npm trust revoke ${PACKAGE} --id <id>
EOF
}

# Every record in npm's listing that names OUR workflow file, one after another.
# npm prints one record per trusted-publisher config — `type:` and `id:` first,
# `permissions:` last, records separated by a blank line — and a package can hold
# several records for the same workflow file. The verdict is theirs together, not
# the first record's: judging only the first made the outcome depend on the
# registry's listing order (review finding 1: a stale record for our file — another
# repository, or stage-only — reported a definitive mismatch and aborted the
# release at scripts/release-safe.sh:322 even when a later record was the one the
# registry would authorize).
#
# The block boundary is the identity line rather than the blank line: npm's
# warnings share this stream, so a blank line can fall inside a record, while a
# `type:`/`id:` line cannot. A block must never span two records — one record's
# repository vouching for another's permissions is the false pass these checks
# exist to prevent.
#
# Each record is judged on its own fields. `mode`:
#   all — every record naming the workflow file (what the verdict was computed
#         over, and therefore what a failure prints)
#   ok  — records that name $REPOSITORY and grant publish
#   off — records that definitively differ: a repository field that is not ours,
#         or a permissions field that is not `publish`
matching_records() {
  awk -v wf="$WORKFLOW_FILE" -v repo="$REPOSITORY" -v mode="$1" '
    function verdict() {
      has_repo = (tolower(block) ~ /repository/)
      repo_ok = has_repo && (index(tolower(block), tolower(repo)) > 0)
      has_perm = (tolower(block) ~ /permissions/)
      perm_ok = has_perm && (index(block, "permissions: publish") > 0)
      if (mode == "ok") return repo_ok && perm_ok
      if (mode == "off") return (has_repo && !repo_ok) || (has_perm && !perm_ok)
      return 1
    }
    function flush() {
      if (block != "" && named && verdict()) printf "%s", block
      block = ""
      named = 0
    }
    /^(type|id):/ { flush() }
    { block = block $0 "\n" }
    index($0, "file: " wf) == 1 { named = 1 }
    END { flush() }
  ' <<<"$LIST_OUT"
}

printf 'Checking the npm publish path for %s...\n' "$PACKAGE"

if ! WHO=$(npm whoami 2>/dev/null) || [ -z "$WHO" ]; then
  warn "no authenticated npm session — cannot verify the trusted-publisher entry"
  printf '    run `npm login --auth-type=web`, then re-run this check\n'
  exit 0
fi
ok "npm session: $WHO"

# Pin the human format: `npm trust list` accepts `--json` (its own help lists it
# under Options) and honours a `json=true` npm config, and in that mode a record
# reads `"file": "publish-everywhere.yml"` with `"permissions"` as an array of
# registry codes (`createPackage`) rather than the `publish` label. The parser
# below matches the human shape, so a JSON listing parsed as nothing, fell through
# to the "not a trust listing" warning and exited 0 — a pass for a package whose
# stored configs this guard never checked (review finding 2: a JSON listing naming
# our workflow file only for another repository exited 0 while the pre-patch
# script exited 1; a *correct* JSON listing exited 1 there, so it was a mode-wide
# verdict flip). `--no-json` overrides the config, so the shape is decided here.
LIST_OUT=$(npm trust list "$PACKAGE" --no-json 2>&1)
RC=$?
if [ "$RC" -ne 0 ]; then
  if grep -qi "one-time password\|EOTP" <<<"$LIST_OUT"; then
    warn "npm needs a browser 2FA approval to read trust configs — not verified"
    URL=$(grep -oE 'https://www\.npmjs\.com/auth/cli/[A-Za-z0-9-]+' <<<"$LIST_OUT" | head -1)
    [ -n "$URL" ] && printf '    approve: %s\n' "$URL"
  else
    warn "could not read trust configs (npm exited $RC) — not verified"
    tail -3 <<<"$LIST_OUT" | sed 's/^/    /'
  fi
  exit 0
fi

if grep -qi "No trust configurations found" <<<"$LIST_OUT"; then
  bad "$PACKAGE has NO trusted-publisher entry — the npm leg would fail after tagging"
  remedy
  exit 1
fi

# The read above asks for the human format. If JSON arrives anyway — an npm that
# ignores `--no-json`, or a shape from a version that stopped printing the labels
# — refuse it instead of warning: the JSON shape prints permissions as registry
# codes and the file under a quoted key, so "this listing grants nothing for our
# workflow" cannot be told from "this guard cannot read this listing", and the
# warning path exits 0. A pass there is the 2.2.3 shape the guard exists to catch
# (review finding 2), so the unrecognized-shape warning below is for output that
# is not a trust listing at all.
if grep -qE '^[[:space:]]*"(file|repository|permissions|workflow_ref)"[[:space:]]*:' <<<"$LIST_OUT"; then
  bad "npm returned the JSON trust listing — this guard asked for the human format and cannot judge JSON"
  sed 's/^/    /' <<<"$LIST_OUT"
  printf '    inspect the listing by hand (npm trust list %s), or in the npm web UI\n' "$PACKAGE"
  exit 1
fi

MATCHING=$(matching_records all)

if [ -n "$MATCHING" ]; then
  if [ -n "$(matching_records ok)" ]; then
    ok "trusted publisher: $WORKFLOW_FILE"
    ok "repository: $REPOSITORY"
    ok "permissions: publish"
    printf 'npm publish path verified.\n'
    exit 0
  fi

  # Records name our workflow file, and none of them authorizes a publish of it.
  # A field that is present and different is a definitive mismatch — the registry
  # would refuse the OIDC exchange. A field npm does not print at all is not: an
  # unrecognized format warns rather than blocks.
  if [ -n "$(matching_records off)" ]; then
    bad "no record naming $WORKFLOW_FILE grants publish to $REPOSITORY — npm publish would be refused"
    printf '    records naming %s (all of them were judged):\n' "$WORKFLOW_FILE"
    sed 's/^/      /' <<<"$MATCHING"
    remedy
    remedy_revoke
    exit 1
  fi

  warn "a record names $WORKFLOW_FILE, but none shows both a repository and a permissions field — not verified"
  sed 's/^/    /' <<<"$MATCHING"
  printf 'npm publish path verified where npm reports it — see the warning above.\n'
  exit 0
fi

# No record names our workflow file. A listing that clearly carries entries is a
# definitive mismatch; unparseable output is not.
if grep -qiE '^[[:space:]]*(type|id|file|repository|permissions):' <<<"$LIST_OUT"; then
  bad "trusted-publisher entries exist, but none names $WORKFLOW_FILE"
  sed 's/^/    /' <<<"$LIST_OUT"
  remedy
  exit 1
fi

warn "npm's output does not look like a trust listing — not verified"
sed 's/^/    /' <<<"$LIST_OUT"
exit 0
