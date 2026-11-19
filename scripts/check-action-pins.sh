#!/usr/bin/env bash
# Verify that every SHA-pinned GitHub Action still matches the commit named by
# its trailing `# vX` ref comment. Exits non-zero on drift, an unresolvable
# ref, or a pin without a ref comment.
#
# Usage: scripts/check-action-pins.sh [repo-root]
# Local: pnpm run check:pins
# CI: .github/workflows/check-action-pins.yml (monthly; opens an issue on drift)
set -euo pipefail

root=${1:-$(cd "$(dirname "$0")/.." && pwd)}
workflows="$root/.github/workflows"
status=0

resolve() {
  local remote=$1 ref=$2 sha
  # Annotated tag: the peeled commit is the action's tree.
  sha=$(git ls-remote "$remote" "refs/tags/$ref^{}" 2>/dev/null | awk '{print $1}')
  # Lightweight tag.
  if [ -z "$sha" ]; then
    sha=$(git ls-remote "$remote" "refs/tags/$ref" 2>/dev/null | awk '{print $1}')
  fi
  # Moving major branch (denoland/setup-deno@v2 is a branch).
  if [ -z "$sha" ]; then
    sha=$(git ls-remote "$remote" "refs/heads/$ref" 2>/dev/null | awk '{print $1}')
  fi
  printf '%s' "$sha"
}

while IFS= read -r match; do
  file=${match%%:*}
  rest=${match#*:}
  line=${rest%%:*}
  text=${rest#*:}
  uses=${text#*uses:}
  uses=$(printf '%s' "$uses" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
  action=${uses%@*}
  pinned=${uses#*@}
  pinned=${pinned%% *}

  if [[ "$text" != *"#"* ]]; then
    printf 'UNMANAGED %s:%s %s@%s (no "# vX" ref comment)\n' \
      "$file" "$line" "$action" "$pinned"
    status=1
    continue
  fi
  ref=$(printf '%s' "${text#*# }" | awk '{print $1}')

  current=$(resolve "https://github.com/$action.git" "$ref")
  if [ -z "$current" ]; then
    printf 'UNRESOLVED %s:%s %s@%s (cannot resolve %s)\n' \
      "$file" "$line" "$action" "$pinned" "$ref"
    status=1
  elif [ "$current" != "$pinned" ]; then
    printf 'DRIFT %s:%s %s %s -> %s\n' "$file" "$line" "$action" "$pinned" "$current"
    status=1
  else
    printf 'OK %s:%s %s@%s (%s)\n' "$file" "$line" "$action" "$pinned" "$ref"
  fi
done < <(grep -rnE 'uses:[[:space:]]+[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-f]{40}' "$workflows" || true)

if [ "$status" -eq 0 ]; then
  echo "All action pins are current."
else
  echo "Action pin drift detected."
fi
exit "$status"
