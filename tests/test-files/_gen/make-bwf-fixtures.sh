#!/usr/bin/env bash
# Regenerates the BWF test fixtures. Opt-in only:
#   bash tests/test-files/_gen/make-bwf-fixtures.sh --regen
#
# It uses taglib-wasm's OWN write path (WASI backend) for the v2 bext chunk +
# iXML, so run it only on a known-good build and verify the committed fixtures
# afterwards. Requires ffmpeg (for the base WAV) and a built dist/wasi binary.
set -euo pipefail
[[ "${1:-}" == "--regen" ]] || { echo "pass --regen to actually regenerate"; exit 0; }

root="$(cd "$(dirname "$0")/../../.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# Keep fixtures tiny — short silence at a low sample rate.
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=8000:cl=mono" -t 0.2 -c:a pcm_s16le "$tmp/base.wav"
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=8000:cl=mono" -t 0.2 -c:a flac "$tmp/base.flac"

deno run --allow-read --allow-write --allow-env \
  "$root/tests/test-files/_gen/make-bwf-fixtures.ts" \
  "$tmp/base.wav" "$tmp/base.flac" \
  "$root/tests/test-files/wav/bext-ixml.wav" "$root/tests/test-files/flac/bext-ixml.flac"

echo "Regenerated BWF fixtures."
