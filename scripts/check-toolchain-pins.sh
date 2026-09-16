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
#   emsdk    — .github/workflows/{ci,publish-everywhere}.yml
#              (mymindstorm/setup-emsdk version:) and build/setup-dev-env.sh
#              (emsdk install/activate). sonarcloud.yml carries no emsdk pin:
#              that job tests the committed binaries instead of building.
#   wasi-sdk — .github/workflows/ci.yml (WASI_VERSION), build/setup-dev-env.sh
#              (WASI_VERSION), build/setup-wasi-sdk.sh (WASI_SDK_VERSION_FULL)
#   binaryen — .github/workflows/ci.yml, build/setup-dev-env.sh (binaryen@),
#              and mise.toml (npm:binaryen) when that local file exists
#   deno     — .github/workflows/{ci,publish-everywhere,sonarcloud}.yml
#              (deno-version:) and mise.toml when present

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "::error::toolchain pin drift: $1" >&2
  exit 1
}

# A family with several sources must not pass just because ONE source still
# yields a pin: the `printf '%s\n' ... | grep .` filters below drop empty
# sources, so a lookup that stops matching would otherwise vanish silently.
# Every required source is asserted individually; mise.toml stays optional
# (gitignored, absent on CI).
require_pin() {
  local label="$1" value="$2"
  if [ -z "$value" ]; then
    fail "$label — no pin found (file moved, renamed, or format changed?)"
  fi
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

# Every lookup below ends in `|| true`. Under `set -euo pipefail` a pattern
# that stops matching aborts the script mid-flight, which would hide
# check_family's designed "no pin found (file moved, renamed, or format
# changed?)" diagnostic — the exact confusing-failure class this guard exists
# to prevent. Never drop the `|| true`.
emsdk_wf="$(grep -hA2 'mymindstorm/setup-emsdk' "${WF_FILES[@]}" \
  | grep -oE 'version: [0-9]+\.[0-9]+\.[0-9]+' | awk '{print $2}' || true)"
emsdk_dev="$(grep -hoE 'emsdk (install|activate) [0-9]+\.[0-9]+\.[0-9]+' build/setup-dev-env.sh \
  | awk '{print $3}' || true)"
require_pin "emsdk (workflows)" "$emsdk_wf"
require_pin "emsdk (build/setup-dev-env.sh)" "$emsdk_dev"
check_family "emsdk" "$emsdk_wf
$emsdk_dev"

wasi_ci="$(grep -oE 'WASI_VERSION[:=][[:space:]]*"?[0-9]+\.[0-9]+' .github/workflows/ci.yml \
  | head -1 | grep -oE '[0-9]+\.[0-9]+$' || true)"
wasi_dev="$(grep -oE 'WASI_VERSION="[0-9]+\.[0-9]+"' build/setup-dev-env.sh \
  | head -1 | sed -E 's/.*"([0-9.]+)"/\1/' || true)"
wasi_local="$(grep -oE 'WASI_SDK_VERSION_FULL="[0-9]+\.[0-9]+"' build/setup-wasi-sdk.sh \
  | head -1 | sed -E 's/.*"([0-9.]+)"/\1/' || true)"
require_pin "wasi-sdk (.github/workflows/ci.yml)" "$wasi_ci"
require_pin "wasi-sdk (build/setup-dev-env.sh)" "$wasi_dev"
require_pin "wasi-sdk (build/setup-wasi-sdk.sh)" "$wasi_local"
check_family "wasi-sdk" "$wasi_ci
$wasi_dev
$wasi_local"

# mise.toml is gitignored (local toolchain manager), so its pins are checked
# only when the file is present — CI checkouts have none. The workflow and
# setup-script pins above/below are the ones CI enforces independently.
if [ -f mise.toml ]; then
  bin_mise="$(grep -oE '"npm:binaryen" = "[0-9]+\.[0-9]+\.[0-9]+"' mise.toml \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
  deno_mise="$(grep -oE '^deno = "[0-9]+\.[0-9]+\.[0-9]+"' mise.toml \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
else
  bin_mise=""
  deno_mise=""
fi

bin_ci="$(grep -oE 'binaryen@[0-9]+\.[0-9]+\.[0-9]+' .github/workflows/ci.yml | sed 's/.*@//' || true)"
bin_dev="$(grep -oE 'binaryen@[0-9]+\.[0-9]+\.[0-9]+' build/setup-dev-env.sh | sed 's/.*@//' || true)"
require_pin "binaryen (.github/workflows/ci.yml)" "$bin_ci"
require_pin "binaryen (build/setup-dev-env.sh)" "$bin_dev"
check_family "binaryen" "$(printf '%s\n' "$bin_ci" "$bin_dev" "$bin_mise" | grep .)"

deno_wf="$(grep -hoE 'deno-version: "[0-9]+\.[0-9]+\.[0-9]+"' "${WF_FILES[@]}" \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
require_pin "deno (workflows)" "$deno_wf"
check_family "deno" "$(printf '%s\n' "$deno_wf" "$deno_mise" | grep .)"

echo "All toolchain pins agree."
