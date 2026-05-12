#!/bin/bash
set -euo pipefail

# Update the lib/taglib submodule to a new TagLib release tag.
#
# Usage: ./scripts/update-taglib.sh v2.3
#        ./scripts/update-taglib.sh v2.2.1
#
# lib/taglib is a git SUBMODULE. This script checks out the requested tag inside
# it, re-syncs nested submodules (utfcpp), cleans a known stale utfcpp directory,
# and stages the bump. It does NOT use `git subtree` (the old approach left a
# stale partial copy of TagLib at the repo root — removed in taglib-qrp).

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
err()  { echo -e "${RED}❌ $1${NC}" >&2; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  err "No version specified."
  echo "Usage: $0 <tag>   (e.g. $0 v2.3)"
  echo "Recent TagLib tags:"
  git ls-remote --tags https://github.com/taglib/taglib.git \
    | grep -E 'refs/tags/v[0-9]+\.[0-9]+(\.[0-9]+)?$' \
    | sed 's#.*refs/tags/##' | sort -V | tail -5
  exit 1
fi
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  err "Invalid tag format: $VERSION (expected vMAJOR.MINOR[.PATCH])"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE="$REPO_ROOT/lib/taglib"

if [[ ! -e "$SUBMODULE/.git" ]]; then
  err "lib/taglib is not initialized. Run: git submodule update --init --recursive"
  exit 1
fi
if ! git -C "$REPO_ROOT" diff --quiet -- lib/taglib || \
   ! git -C "$REPO_ROOT" diff --cached --quiet -- lib/taglib; then
  err "lib/taglib already has staged/unstaged changes. Resolve them first."
  exit 1
fi

echo "Updating lib/taglib → $VERSION"
git -C "$SUBMODULE" fetch --tags origin
if ! git -C "$SUBMODULE" rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
  err "Tag $VERSION not found in the TagLib repository."
  exit 1
fi
git -C "$SUBMODULE" checkout --quiet "tags/$VERSION"

# Re-sync nested submodules (utfcpp) and clear a known stale leftover.
git -C "$REPO_ROOT" submodule update --init --recursive
STALE_UTFCPP="$SUBMODULE/3rdparty/utfcpp/extern/ftest"
if [[ -d "$STALE_UTFCPP" ]]; then
  warn "Removing stale utfcpp leftover: $STALE_UTFCPP"
  rm -rf "$STALE_UTFCPP"
fi

git -C "$REPO_ROOT" add lib/taglib
ok "lib/taglib bumped to $VERSION and staged."
echo
echo "Next steps:"
echo "  1. bash build/build-wasi.sh && bash build/build-wasm.sh"
echo "  2. cp build/taglib-{web.wasm,wrapper.js} dist/"
echo "  3. deno task test"
echo "  4. Review & commit (Conventional Commits: 'chore(deps): update TagLib to $VERSION')"
