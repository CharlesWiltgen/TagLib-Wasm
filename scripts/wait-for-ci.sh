#!/bin/bash
set -euo pipefail

# Poll the Tests workflow (ci.yml) for a given commit and classify per-leg
# results. Required legs must succeed; flaky legs may fail without failing
# the gate.
#
# Usage:
#   wait-for-ci.sh <commit-sha> [max-wait-seconds] [poll-interval-seconds]
#
# Requires: gh CLI authenticated, jq.
#
# Exit codes:
#   0 - All required legs passed (flaky failures tolerated)
#   1 - Required leg failed, timed out, or CI run not found

COMMIT_SHA="${1:?usage: wait-for-ci.sh <commit-sha> [max-wait-seconds] [poll-interval-seconds]}"
MAX_WAIT="${2:-900}"
INTERVAL="${3:-15}"

# Required legs: any failure fails the gate.
REQUIRED_JOBS=(
    "Lint & Format"
    "Build (Embind)"
    "Test (ubuntu-latest)"
    "Build (WASI)"
    "Test (WASI)"
    "Package Compatibility"
)

# Flaky legs: failures tolerated (logged but don't fail the gate).
FLAKY_JOBS=(
    "Test (windows-latest)"
    "Test (macos-latest)"
)

echo "Waiting for ci.yml run on commit ${COMMIT_SHA} (max ${MAX_WAIT}s, poll ${INTERVAL}s)..."

WAITED=0
RUN_ID=""

while [ "$WAITED" -lt "$MAX_WAIT" ]; do
    RESULT=$(gh run list --workflow=ci.yml --commit="$COMMIT_SHA" \
        --json databaseId,status,conclusion --limit 1 -q '.[0]' 2>/dev/null || echo "")

    if [ -z "$RESULT" ] || [ "$RESULT" = "null" ]; then
        echo "No CI run found yet, waiting ${INTERVAL}s... (${WAITED}s elapsed)"
        sleep "$INTERVAL"
        WAITED=$((WAITED + INTERVAL))
        continue
    fi

    STATUS=$(echo "$RESULT" | jq -r '.status')

    if [ "$STATUS" = "completed" ]; then
        RUN_ID=$(echo "$RESULT" | jq -r '.databaseId')
        echo "CI run ${RUN_ID} completed."
        break
    fi

    echo "CI run status: ${STATUS}, waiting ${INTERVAL}s... (${WAITED}s elapsed)"
    sleep "$INTERVAL"
    WAITED=$((WAITED + INTERVAL))
done

if [ -z "$RUN_ID" ]; then
    echo "❌ Timed out after ${MAX_WAIT}s waiting for CI to complete on ${COMMIT_SHA}"
    exit 1
fi

echo "Inspecting per-job results for run ${RUN_ID}..."
# The jobs endpoint 503s intermittently; an API read error must never be
# conflated with a CI failure. Retry, then fall back to the run-level
# conclusion: success implies every leg passed (strictly stronger than the
# per-leg gate); anything else fails closed since flaky legs can't be
# classified without the job list.
JOBS_JSON=""
for attempt in 1 2 3 4 5; do
    if JOBS_JSON=$(gh run view "$RUN_ID" --json jobs 2>/dev/null); then
        break
    fi
    JOBS_JSON=""
    echo "  ⚠ jobs API unavailable (attempt ${attempt}/5), retrying in ${INTERVAL}s..."
    sleep "$INTERVAL"
done

if [ -z "$JOBS_JSON" ]; then
    CONCLUSION=$(gh run view "$RUN_ID" --json conclusion -q .conclusion 2>/dev/null || echo "unknown")
    if [ "$CONCLUSION" = "success" ]; then
        echo "⚠ Per-job inspection unavailable; run-level conclusion is success."
        echo "✅ All CI jobs passed for ${COMMIT_SHA} (run-level fallback)"
        exit 0
    fi
    echo "❌ Jobs API unavailable and run-level conclusion is '${CONCLUSION}' — failing closed."
    exit 1
fi

FAILED_REQUIRED=()
FAILED_FLAKY=()

for job in "${REQUIRED_JOBS[@]}"; do
    CONCLUSION=$(echo "$JOBS_JSON" | jq -r --arg name "$job" \
        '.jobs[] | select(.name == $name) | .conclusion')
    if [ -z "$CONCLUSION" ]; then
        FAILED_REQUIRED+=("${job} (not found)")
    elif [ "$CONCLUSION" != "success" ]; then
        FAILED_REQUIRED+=("${job} (${CONCLUSION})")
    else
        echo "  ✓ ${job}"
    fi
done

for job in "${FLAKY_JOBS[@]}"; do
    CONCLUSION=$(echo "$JOBS_JSON" | jq -r --arg name "$job" \
        '.jobs[] | select(.name == $name) | .conclusion')
    if [ -z "$CONCLUSION" ]; then
        echo "  ? ${job} (not found, treating as tolerated)"
    elif [ "$CONCLUSION" != "success" ]; then
        FAILED_FLAKY+=("${job} (${CONCLUSION})")
        echo "  ⚠ ${job}: ${CONCLUSION} (tolerated)"
    else
        echo "  ✓ ${job}"
    fi
done

if [ "${#FAILED_REQUIRED[@]}" -gt 0 ]; then
    echo ""
    echo "❌ Required CI jobs failed:"
    printf '  - %s\n' "${FAILED_REQUIRED[@]}"
    echo ""
    echo "Run URL: $(gh run view "$RUN_ID" --json url -q .url)"
    exit 1
fi

echo ""
echo "✅ All required CI jobs passed for ${COMMIT_SHA}"
if [ "${#FAILED_FLAKY[@]}" -gt 0 ]; then
    echo "Tolerated flaky failures:"
    printf '  - %s\n' "${FAILED_FLAKY[@]}"
fi
exit 0
