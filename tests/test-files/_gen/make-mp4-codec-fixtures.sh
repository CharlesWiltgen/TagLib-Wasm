#!/usr/bin/env bash
# Regenerates the MP4 codec-variant fixtures (AC-3, E-AC-3, DTS, FLAC, Opus in
# an MP4/M4A container). Opt-in only:
#   bash tests/test-files/_gen/make-mp4-codec-fixtures.sh --regen
#
# These guard the MP4 codec mapping on both backends: TagLib 2.3.2 detects
# ac-3/ec-3/dtsc/fLaC/Opus sample entries, so the shim must report the real
# codec instead of "AAC" (the pre-2.3.2 behavior for every non-ALAC track).
# Requires ffmpeg (with ac3/eac3/dca/flac/opus encoders).
set -euo pipefail
[[ "${1:-}" == "--regen" ]] || { echo "pass --regen to actually regenerate"; exit 0; }

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/tests/test-files/mp4"

# 0.2s of silence keeps each fixture a few KB. AC-3/E-AC-3 do not support
# 8 kHz, so every fixture uses 48 kHz. `-f mp4` (not the default `ipod` muxer
# for .m4a) is required: ipod rejects AC-3/E-AC-3 sample entries.
#
# DTS is deliberately absent: ffmpeg's mov muxer has no dtsc/dtse/dtsh/dtsl
# mapping and falls back to a generic mp4a+esds entry (which TagLib reads as
# AAC), so a true DTS-in-MP4 fixture cannot be produced here.
base=(-f lavfi -i "anullsrc=r=48000:cl=mono" -t 0.2)

ffmpeg -y -loglevel error "${base[@]}" -c:a ac3 -b:a 96k -f mp4 "$out/ac3.m4a"
ffmpeg -y -loglevel error "${base[@]}" -c:a eac3 -b:a 96k -f mp4 "$out/eac3.m4a"
ffmpeg -y -loglevel error "${base[@]}" -c:a flac -f mp4 "$out/flac.m4a"
ffmpeg -y -loglevel error "${base[@]}" -c:a libopus -b:a 32k -f mp4 "$out/opus.m4a"

echo "Regenerated MP4 codec fixtures:"
for f in ac3 eac3 flac opus; do
  printf '  %-10s %s\n' "$f.m4a" "$(stat -f%z "$out/$f.m4a" 2>/dev/null || stat -c%s "$out/$f.m4a") bytes"
done
