#!/bin/bash
# Verify the wasm-determinism toolchain pins agree across every file that
# declares them. The wasm freshness gates (ci.yml) byte-compare fresh builds
# against the committed binaries, so a toolchain bump that misses one pin
# reds CI with a confusing "binary is stale" error — this has happened twice
# (6.0.3->6.0.6 and 6.0.6->6.0.7 both left publish-everywhere.yml and/or
# setup-dev-env.sh behind). This guard makes drift fail fast at the pins
# themselves. Runs in CI (lint job) and locally (deno task check:all).
#
# Covered pins:
#   emsdk    — .github/workflows/{ci,sonarcloud,publish-everywhere}.yml
#              (mymindstorm/setup-emsdk version:) and build/setup-dev-env.sh
#              (emsdk install/activate)
#   wasi-sdk — .github/workflows/ci.yml (WASI_VERSION), build/setup-dev-env.sh
#              (WASI_VERSION), build/setup-wasi-sdk.sh (WASI_SDK_VERSION_FULL)
#   binaryen — .github/workflows/ci.yml and build/setup-dev-env.sh (binaryen@)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "::error::toolchain pin drift: $1" >&2
  exit 1
}

# All declarations of one pin family must reduce to a single distinct value.
check_family() {
  local name="$1" combined="$2"
  local count distinct
  count="$(printf '%s\n' "$combined" | grep -c . || true)"
  if [ "$count" -eq 0 ]; then
    fail "$name — no pin found (file moved, renamed, or format changed?)"
  fi
  distinct="$(printf '%s\n' "$combined" | sort -u | tr '\n' ' ')"
  if [ "$(printf '%s\n' "$combined" | sort -u | wc -l | tr -d ' ')" -ne 1 ]; then
    fail "$name — pins disagree: $distinct"
  fi
  echo "✓ $name: $distinct"
}

WF_FILES=(.github/workflows/ci.yml .github/workflows/sonarcloud.yml .github/workflows/publish-everywhere.yml)

emsdk_wf="$(grep -hA2 'mymindstorm/setup-emsdk' "${WF_FILES[@]}" \
  | grep -oE 'version: [0-9]+\.[0-9]+\.[0-9]+' | awk '{print $2}')"
emsdk_dev="$(grep -hoE 'emsdk (install|activate) [0-9]+\.[0-9]+\.[0-9]+' build/setup-dev-env.sh \
  | awk '{print $3}')"
check_family "emsdk" "$emsdk_wf
$emsdk_dev"

wasi_ci="$(grep -oE 'WASI_VERSION[:=][[:space:]]*"?[0-9]+\.[0-9]+' .github/workflows/ci.yml \
  | head -1 | grep -oE '[0-9]+\.[0-9]+$')"
wasi_dev="$(grep -oE 'WASI_VERSION="[0-9]+\.[0-9]+"' build/setup-dev-env.sh \
  | head -1 | sed -E 's/.*"([0-9.]+)"/\1/')"
wasi_local="$(grep -oE 'WASI_SDK_VERSION_FULL="[0-9]+\.[0-9]+"' build/setup-wasi-sdk.sh \
  | head -1 | sed -E 's/.*"([0-9.]+)"/\1/')"
check_family "wasi-sdk" "$wasi_ci
$wasi_dev
$wasi_local"

bin_ci="$(grep -oE 'binaryen@[0-9]+\.[0-9]+\.[0-9]+' .github/workflows/ci.yml | sed 's/.*@//')"
bin_dev="$(grep -oE 'binaryen@[0-9]+\.[0-9]+\.[0-9]+' build/setup-dev-env.sh | sed 's/.*@//')"
check_family "binaryen" "$bin_ci
$bin_dev"

echo "All toolchain pins agree."
