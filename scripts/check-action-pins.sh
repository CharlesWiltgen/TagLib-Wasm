#!/usr/bin/env bash
# Verify GitHub Actions pins.
#
# Repository rule: a remote third-party `uses:` entry must be pinned to a full
# 40-hex commit SHA carrying a trailing `# vX` ref comment. First-party
# `actions/*` entries on a mutable tag are reported as INFO (the pinning policy
# covers third-party actions only) and are not a failure.
#
# Two modes:
#   scripts/check-action-pins.sh            full: resolves each ref over the
#                                           network and reports DRIFT.
#   scripts/check-action-pins.sh --static   offline: format/coverage only.
#
# Exits non-zero on drift, an unresolvable ref, an unpinned third-party action,
# a pin without a ref comment, or a scan that found no `uses:` entries at all —
# an empty scan must never read as success.
#
# Usage: scripts/check-action-pins.sh [--static] [repo-root]
# Local: pnpm run check:pins
# CI: .github/workflows/check-action-pins.yml (push/PR: --static; monthly: full)
set -euo pipefail

static=0
root=""
for arg in "$@"; do
  case "$arg" in
    --static) static=1 ;;
    -*) echo "check-action-pins: unknown option $arg" >&2; exit 2 ;;
    *) root=$arg ;;
  esac
done
root=${root:-$(cd "$(dirname "$0")/.." && pwd)}
workflows="$root/.github/workflows"
status=0

if [ ! -d "$workflows" ]; then
  echo "check-action-pins: no workflow directory at $workflows" >&2
  exit 1
fi

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

# Every `uses:` entry, including unpinned ones, sub-path actions
# (owner/repo/path@ref) and reusable workflows
# (owner/repo/.github/workflows/x.yml@ref). The pattern anchors on the YAML
# key so prose in comments or `run:` blocks is not mistaken for a reference.
mapfile -t entries < <(
  grep -rnE --include='*.yml' --include='*.yaml' \
    '^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]' "$workflows" || true
)

if [ "${#entries[@]}" -eq 0 ]; then
  echo "check-action-pins: no 'uses:' entries found under $workflows — refusing to report success" >&2
  exit 1
fi

# One network round-trip per (repo, ref), not per occurrence.
declare -A resolved=()

for match in "${entries[@]}"; do
  file=${match%%:*}
  rest=${match#*:}
  line=${rest%%:*}
  text=${rest#*:}

  value=${text#*uses:}
  value=${value%%#*} # drop a trailing comment before splitting the pin
  value=$(printf '%s' "$value" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')

  # Local actions and Docker references are not tag-pinned actions.
  case "$value" in
    ./* | docker://*) continue ;;
  esac

  if [[ "$value" == *@* ]]; then
    action=${value%@*}
    pinned=${value##*@}
  else
    action=$value
    pinned=""
  fi

  if [[ ! "$action" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(/.*)?$ ]]; then
    printf 'UNMANAGED %s:%s %s (not an owner/repo action reference)\n' \
      "$file" "$line" "$value"
    status=1
    continue
  fi

  # The git repository is the first two path segments: a sub-path action or a
  # reusable workflow pinned by SHA resolves against its repo, not the path.
  repo=$(printf '%s' "$action" | cut -d/ -f1-2)

  comment=""
  if [[ "$text" =~ \#[[:space:]]*([^[:space:]]+) ]]; then
    comment=${BASH_REMATCH[1]}
  fi

  if [[ ! "$pinned" =~ ^[0-9a-f]{40}$ ]]; then
    shown=$action${pinned:+@$pinned}
    if [[ "$repo" == actions/* ]]; then
      printf 'INFO %s:%s %s (first-party on a mutable ref; policy covers third-party actions)\n' \
        "$file" "$line" "$shown"
    else
      printf 'UNMANAGED %s:%s %s (not a full 40-hex commit SHA)\n' \
        "$file" "$line" "$shown"
      status=1
    fi
    continue
  fi

  if [ -z "$comment" ]; then
    printf 'UNMANAGED %s:%s %s@%s (no "# vX" ref comment)\n' \
      "$file" "$line" "$action" "$pinned"
    status=1
    continue
  fi

  if [ "$static" -eq 1 ]; then
    printf 'OK %s:%s %s@%s (%s, format only)\n' \
      "$file" "$line" "$action" "$pinned" "$comment"
    continue
  fi

  key="$repo@$comment"
  if [ -n "${resolved[$key]+x}" ]; then
    current=${resolved[$key]}
  else
    current=$(resolve "https://github.com/$repo.git" "$comment")
    resolved[$key]=$current
  fi

  if [ -z "$current" ]; then
    printf 'UNRESOLVED %s:%s %s@%s (cannot resolve %s)\n' \
      "$file" "$line" "$action" "$pinned" "$comment"
    status=1
  elif [ "$current" != "$pinned" ]; then
    printf 'DRIFT %s:%s %s %s -> %s\n' \
      "$file" "$line" "$action" "$pinned" "$current"
    status=1
  else
    printf 'OK %s:%s %s@%s (%s)\n' \
      "$file" "$line" "$action" "$pinned" "$comment"
  fi
done

if [ "$status" -eq 0 ]; then
  echo "Action pin check passed (${#entries[@]} uses: entries)."
else
  echo "Action pin check failed."
fi
exit "$status"
