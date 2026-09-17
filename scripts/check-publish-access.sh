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
  ok "trusted publisher: $WORKFLOW_FILE"
  if grep -qiF "$REPOSITORY" <<<"$LIST_OUT"; then
    ok "repository: $REPOSITORY"
  else
    warn "npm's listing does not show the repository — confirm it names $REPOSITORY"
    sed 's/^/    /' <<<"$LIST_OUT"
  fi
  printf 'npm publish path verified.\n'
  exit 0
fi

if grep -qF ".yml" <<<"$LIST_OUT"; then
  bad "trusted-publisher entries exist, but none names $WORKFLOW_FILE"
  sed 's/^/    /' <<<"$LIST_OUT"
  remedy
  exit 1
fi

warn "npm's output does not look like a trust listing — not verified"
sed 's/^/    /' <<<"$LIST_OUT"
exit 0
