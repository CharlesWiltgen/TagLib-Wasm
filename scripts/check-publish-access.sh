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

printf 'Checking the npm publish path for %s...\n' "$PACKAGE"

if ! WHO=$(npm whoami 2>/dev/null) || [ -z "$WHO" ]; then
  warn "no authenticated npm session — cannot verify the trusted-publisher entry"
  printf '    run `npm login --auth-type=web`, then re-run this check\n'
  exit 0
fi
ok "npm session: $WHO"

LIST_OUT=$(npm trust list "$PACKAGE" 2>&1)
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

if grep -qF "$WORKFLOW_FILE" <<<"$LIST_OUT"; then
  # npm prints one record per trusted publisher. Scope the field checks to the
  # record that names OUR workflow file: checking the whole listing let an entry
  # for a different repository or a stage-only entry vouch for ours (review
  # finding: listing-wide checks false-pass).
  local_record() {
    awk -v wf="$WORKFLOW_FILE" '
      /^(type|id):/ { if (block != "" && found) { print block; exit } block = ""; found = 0 }
      { block = block $0 "\n" }
      index($0, "file: " wf) == 1 { found = 1 }
      END { if (block != "" && found) print block }
    ' <<<"$LIST_OUT"
  }
  ENTRY=$(local_record)
  INCOMPLETE=""

  if [ -z "$ENTRY" ]; then
    # No record names our workflow file. A listing that clearly carries entries
    # is a definitive mismatch; unparseable output is not.
    if grep -qiE '^[[:space:]]*(type|id|file|repository|permissions):' <<<"$LIST_OUT"; then
      bad "trusted-publisher entries exist, but none names $WORKFLOW_FILE"
      sed 's/^/    /' <<<"$LIST_OUT"
      remedy
      exit 1
    fi
    warn "npm's output does not look like a trust listing — not verified"
    sed 's/^/    /' <<<"$LIST_OUT"
    exit 0
  fi

  ok "trusted publisher: $WORKFLOW_FILE"

  # The registry matches repository AND workflow file, so a field that names a
  # different repository is a definitive mismatch — but only when the listing
  # actually carries the field (an unrecognized npm format must warn, not block).
  if grep -qi 'repository' <<<"$ENTRY"; then
    if ! grep -qiF "$REPOSITORY" <<<"$ENTRY"; then
      bad "the $WORKFLOW_FILE entry does not name $REPOSITORY"
      sed 's/^/    /' <<<"$ENTRY"
      remedy
      exit 1
    fi
    ok "repository: $REPOSITORY"
  else
    warn "the $WORKFLOW_FILE entry shows no repository field — repository not verified"
    INCOMPLETE=1
  fi

  # An entry created in the npm web UI defaults to stage-publish only, which
  # refuses `npm publish` — the trap this script's own remedy text names.
  if grep -qi 'permissions' <<<"$ENTRY"; then
    if ! grep -qF 'permissions: publish' <<<"$ENTRY"; then
      bad "the $WORKFLOW_FILE entry does not grant publish (stage publish only) — npm publish would be refused"
      sed 's/^/    /' <<<"$ENTRY"
      remedy
      exit 1
    fi
    ok "permissions: publish"
  else
    warn "the $WORKFLOW_FILE entry shows no permissions field — publish permission not verified"
    INCOMPLETE=1
  fi

  if [ -n "$INCOMPLETE" ]; then
    printf 'npm publish path verified where npm reports it — see the warnings above.\n'
  else
    printf 'npm publish path verified.\n'
  fi
  exit 0
fi

if grep -qiE '^[[:space:]]*(type|id|file|repository|permissions):' <<<"$LIST_OUT"; then
  bad "trusted-publisher entries exist, but none names $WORKFLOW_FILE"
  sed 's/^/    /' <<<"$LIST_OUT"
  remedy
  exit 1
fi

warn "npm's output does not look like a trust listing — not verified"
sed 's/^/    /' <<<"$LIST_OUT"
exit 0
