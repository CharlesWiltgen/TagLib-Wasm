#!/usr/bin/env bash
# Cross-runtime smoke suite: runs every tests/cross-runtime/*.ts file under
# every runtime installed, and fails if any case fails.
#
#   bash tests/cross-runtime/run.sh
#
# Why this exists (and why it must stay honest): the library's promise is one
# API across Deno, Bun, Node and two wasm backends. The previous harness
# (tests/test-runtimes.sh) had rotted — it generated a file importing a path
# that had moved, its WASI half pointed at a deleted file, and it asserted
# nothing, so it could not fail. This driver asserts, reports skips LOUDLY (a
# runtime that silently does not run must never look green), and exits non-zero
# on any failure. CI runs it in the Package Compatibility job.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUITES=(simple-api.ts backends.ts)

failures=0
skipped=0
ran=0

run_suite() {
  local runtime="$1" suite="$2"
  shift 2
  local label="$runtime/$suite"
  local output status
  output="$("$@" "$ROOT/tests/cross-runtime/$suite" 2>&1)"
  status=$?
  if [ "$status" -eq 0 ]; then
    ran=$((ran + 1))
    printf '  ✓ %-28s %s\n' "$label" "$(printf '%s' "$output" | tail -1)"
  else
    failures=$((failures + 1))
    printf '  ✗ %-28s (exit %s)\n' "$label" "$status"
    printf '%s\n' "$output" | sed 's/^/      /' | tail -20
  fi
}

echo "Cross-runtime smoke suite"
echo "========================="

# Deno — first-class runtime, native TS and wasm.
if command -v deno >/dev/null 2>&1; then
  for suite in "${SUITES[@]}"; do
    run_suite "deno" "$suite" deno run --allow-read --allow-write --allow-env
  done
else
  echo "  ⚠ deno not installed — SKIPPED"; skipped=$((skipped + 1))
fi

# Bun — native TS; used by the Simple-API half of the published-package tests.
if command -v bun >/dev/null 2>&1; then
  for suite in "${SUITES[@]}"; do
    run_suite "bun" "$suite" bun run
  done
else
  echo "  ⚠ bun not installed — SKIPPED"; skipped=$((skipped + 1))
fi

# Node — needs a TS loader. Use the pinned devDependency (tsx), never a global:
# the old harness required a globally-installed tsx, so its Node leg could not
# run from a clean checkout. The WASI backend's wasm uses exception handling:
# Node versions that still gate it behind a flag need --experimental-wasm-exnref
# (24.12 does; 24.21 has it on by default), so pass it only when accepted —
# an unknown flag would abort the run.
if command -v node >/dev/null 2>&1; then
  node_flags=()
  if node --experimental-wasm-exnref -e "" >/dev/null 2>&1; then
    node_flags+=(--experimental-wasm-exnref)
  fi
  if [ -x "$ROOT/node_modules/.bin/tsx" ]; then
    # bash 3.2 (stock macOS /bin/bash) aborts on an empty "${arr[@]}" under
    # `set -u`, so build the argv explicitly instead of expanding a maybe-empty
    # array.
    if [ "${#node_flags[@]}" -gt 0 ]; then
      node_argv=(node "${node_flags[@]}" --import tsx)
    else
      node_argv=(node --import tsx)
    fi
    for suite in "${SUITES[@]}"; do
      run_suite "node(tsx)" "$suite" "${node_argv[@]}"
    done
  else
    echo "  ⚠ node present but tsx is not installed (run npm ci) — SKIPPED"
    skipped=$((skipped + 1))
  fi
else
  echo "  ⚠ node not installed — SKIPPED"; skipped=$((skipped + 1))
fi

echo "-------------------------"
echo "cross-runtime: $ran passed, $failures failed, $skipped skipped"
# A run that executed nothing must not look green: with no runtime (or no tsx)
# the suite silently covered nothing before this check.
if [ "$failures" -ne 0 ] || [ "$ran" -eq 0 ]; then
  [ "$ran" -eq 0 ] && echo "  ✗ nothing ran — install a runtime (deno/bun/node+tsx)"
  exit 1
fi
