#!/usr/bin/env bash
# Regenerates the codec-identity fixtures that guard the label fixes:
#   * aac/empty1s.aac              — ADTS / raw AAC (taglib-v4n)
#   * oga/kiss-snippet-flac.oga    — FLAC in an Ogg container (taglib-irp8)
#   * speex/kiss-snippet.spx       — Speex in an Ogg container (taglib-irp8)
#
# Opt-in only:
#   bash tests/test-files/_gen/make-codec-identity-fixtures.sh --regen
#
# These guard that the reported identity comes from the STREAM, not the TagLib
# file class: ADTS shares MPEG::File with MP3, and FLAC/Speex share the Ogg
# reader with Vorbis/Opus. Requires ffmpeg, flac, speexenc.
#
# Regeneration is not byte-reproducible: libogg assigns a random bitstream
# serial number per encode, so the two Ogg fixtures differ in bytes (same size,
# same content) on every run.
#
# The .aac file is upstream's own fixture (lib/taglib/tests/data/empty1s.aac,
# MPEG-4 ADTS AAC-LC 11.025 kHz mono, 147 bytes) — copied verbatim, not
# regenerated, so the copy step below is the recipe.
set -euo pipefail
[[ "${1:-}" == "--regen" ]] || { echo "pass --regen to actually regenerate"; exit 0; }

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/tests/test-files"

# ADTS: verbatim copy of TagLib's fixture.
cp "$root/lib/taglib/tests/data/empty1s.aac" "$out/aac/empty1s.aac"

# The Ogg fixtures come from the shared kiss-snippet source, downsampled to 2s
# of 16 kHz mono PCM so each stays small (Ogg FLAC is lossless: ~50 KB).
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
ffmpeg -y -v error -t 2 -i "$out/wav/kiss-snippet.wav" -ac 1 -ar 16000 "$tmp/source.wav"

flac --ogg -f -s -o "$out/oga/kiss-snippet-flac.oga" "$tmp/source.wav"
speexenc "$tmp/source.wav" "$out/speex/kiss-snippet.spx" >/dev/null

echo "Regenerated codec-identity fixtures:"
ls -l "$out/aac/empty1s.aac" "$out/oga/kiss-snippet-flac.oga" \
  "$out/speex/kiss-snippet.spx"
