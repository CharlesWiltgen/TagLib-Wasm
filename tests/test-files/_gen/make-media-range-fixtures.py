#!/usr/bin/env python3
"""Fixtures for the media-checksum range walks (src/taglib/media-ranges.ts).

    python3 tests/test-files/_gen/make-media-range-fixtures.py

Paths resolve from this script's own location (the `_gen` convention), so the
fixtures land in tests/test-files/ wherever the checkout lives. Every fixture
is built by hand so the byte offsets the tests assert are known by
construction; the only inputs that are not built here are TagLib's own test
data under lib/taglib/tests/data, which the tests read directly.

Later tasks in this series (MP4, WAV walks) append their builders here.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "..")

MP3_DIR = os.path.join(FILES, "mp3")
FLAC_DIR = os.path.join(FILES, "flac")

# The untagged file every FLAC variant wraps: 245430 bytes whose two-block
# metadata chain ends at 323, so the variants differ from it only by tag bytes.
BASE_FLAC = os.path.join(FLAC_DIR, "kiss-snippet.flac")


def syncsafe(n: int) -> bytes:
    """ID3v2 size field: seven bits per byte, high bit always clear."""
    return bytes([(n >> 21) & 0x7F, (n >> 14) & 0x7F, (n >> 7) & 0x7F, n & 0x7F])


# One v2.4 TIT2 frame — 4-char id, syncsafe size (1-byte text encoding + 17
# bytes of text), two flag bytes — so a prepended tag is well-formed rather than
# a stub of the right length.
TIT2 = b"TIT2" + syncsafe(18) + b"\x00\x00" + b"\x03Media Range Title"


def id3v2(body: bytes, footer: bool = False) -> bytes:
    """A 10-byte ID3v2.4 header, then `body`, then — when `footer` — the 10-byte
    v2.4 footer: magic `3DI`, the same flags, the same syncsafe size. The 0x10
    flag is what makes a reader count those ten bytes, so header and footer
    travel together: a promised footer the file lacks would put the next walk
    ten bytes inside the tag."""
    flags = b"\x10" if footer else b"\x00"
    header = b"ID3\x04\x00" + flags + syncsafe(len(body))
    if not footer:
        return header + body
    return header + body + b"3DI\x04\x00" + flags + syncsafe(len(body))


def apev2_footer() -> bytes:
    """A headerless APEv2 tag: the 32-byte footer alone. The size field counts
    the footer and excludes a header; the header-present flag (bit 31) is CLEAR.
    That bit is exactly what `trailingTagStart` reads — set it and the walk
    expects another 32 bytes of header in front and trims into the audio."""
    return (
        b"APETAGEX"
        + (2000).to_bytes(4, "little")  # version
        + (32).to_bytes(4, "little")  # size: this footer only
        + (0).to_bytes(4, "little")  # item count
        + (0).to_bytes(4, "little")  # flags: no header present
        + b"\x00" * 8  # reserved
    )


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

    # Five tag layouts around one FLAC stream. The property they exist for is
    # that all six files hash identically: tests/media-ranges.test.ts walks each
    # of them and compares sha256 over the payload range.
    with open(BASE_FLAC, "rb") as f:
        base = f.read()
    assert len(base) == 245430, len(base)

    write(os.path.join(FLAC_DIR, "flac-prepended-id3v2.flac"), id3v2(TIT2) + base)
    write(
        os.path.join(FLAC_DIR, "flac-prepended-id3v2-footer.flac"),
        id3v2(TIT2, footer=True) + base,
    )
    write(os.path.join(FLAC_DIR, "flac-appended-id3v1.flac"), base + id3v1())
    write(
        os.path.join(FLAC_DIR, "flac-appended-ape.flac"),
        base + apev2_footer(),
    )
    # Both trailing kinds, the ID3v1 block outermost: `trailingTagStart` scans
    # inward from EOF, so the APEv2 footer is only reached with the ID3v1 block
    # behind it.
    write(
        os.path.join(FLAC_DIR, "flac-both-tags.flac"),
        base + apev2_footer() + id3v1(),
    )


if __name__ == "__main__":
    main()
