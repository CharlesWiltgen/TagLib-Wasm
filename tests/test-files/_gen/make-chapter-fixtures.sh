#!/usr/bin/env bash
# Regenerates the chapter test fixtures using ffmpeg.
#
#   tests/test-files/mp3/chapters-id3.mp3   — 2 ID3v2 CHAP frames
#   tests/test-files/mp4/chapters-qt.m4a    — QuickTime chapter track only
#   tests/test-files/mp4/chapters-both.m4a  — QuickTime track + Nero chpl atom
#
# Run from the repository root: bash tests/test-files/_gen/make-chapter-fixtures.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/ch.txt" <<'META'
;FFMETADATA1
[CHAPTER]
TIMEBASE=1/1000
START=0
END=2000
title=Intro
[CHAPTER]
TIMEBASE=1/1000
START=2000
END=4000
title=Chapter 1
META

ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=44100:cl=mono" -t 4 -c:a aac "$tmp/base.m4a"
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=44100:cl=mono" -t 4 -c:a libmp3lame -b:a 64k "$tmp/base.mp3"

ffmpeg -y -loglevel error -i "$tmp/base.m4a" -i "$tmp/ch.txt" \
  -map_metadata 1 -map_chapters 1 -c copy \
  "$root/tests/test-files/mp4/chapters-both.m4a"

ffmpeg -y -loglevel error -i "$tmp/base.m4a" -i "$tmp/ch.txt" \
  -map_metadata 1 -map_chapters 1 -movflags disable_chpl -c copy \
  "$root/tests/test-files/mp4/chapters-qt.m4a"

ffmpeg -y -loglevel error -i "$tmp/base.mp3" -i "$tmp/ch.txt" \
  -map_metadata 1 -map_chapters 1 -write_id3v2 1 -c copy \
  "$root/tests/test-files/mp3/chapters-id3.mp3"

echo "Regenerated chapter fixtures."
