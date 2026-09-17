#!/usr/bin/env python3
"""Fixtures for the media-checksum range walks (src/taglib/media-ranges.ts).

    python3 tests/test-files/_gen/make-media-range-fixtures.py

Paths resolve from this script's own location (the `_gen` convention), so the
fixtures land in tests/test-files/ wherever the checkout lives. Every fixture
is built by hand so the byte offsets the tests assert are known by
construction; the only inputs that are not built here are TagLib's own test
data under lib/taglib/tests/data, which the tests read directly.

Later tasks in this series (FLAC, MP4, WAV walks) append their builders here.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "..")

MP3_DIR = os.path.join(FILES, "mp3")


def syncsafe(n: int) -> bytes:
    """ID3v2 size field: seven bits per byte, high bit always clear."""
    return bytes([(n >> 21) & 0x7F, (n >> 14) & 0x7F, (n >> 7) & 0x7F, n & 0x7F])


def id3v2(body: bytes) -> bytes:
    """A 10-byte ID3v2.4 header, then `body`."""
    return b"ID3\x04\x00\x00" + syncsafe(len(body)) + body


def id3v1() -> bytes:
    """The fixed 128-byte block: TAG + title/artist/album (30 each) + year (4)
    + comment (30) + genre (1). A 127-byte block is NOT detected, which is why
    the assert below exists."""
    title = b"Media Range Title".ljust(30, b"\x00")
    artist = b"Media Range Artist".ljust(30, b"\x00")
    album = b"Media Range Album".ljust(30, b"\x00")
    year = b"2026".ljust(4, b" ")
    comment = b"fixture".ljust(30, b"\x00")
    tag = b"TAG" + title + artist + album + year + comment + b"\x00"
    assert len(tag) == 128, len(tag)
    return tag


def write(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print(f"{len(data):>9d}  {os.path.relpath(path, FILES)}")


def main() -> None:
    # Tags with no audio at all: a 20-byte ID3v2 tag (10-byte header + 10 bytes
    # of body) followed by the 128-byte ID3v1 block, 148 bytes total. The walk
    # must fall back here rather than hash a tail it cannot call audio.
    write(os.path.join(MP3_DIR, "tags-only.mp3"), id3v2(b"\x00" * 10) + id3v1())


if __name__ == "__main__":
    main()
