#!/usr/bin/env python3
"""Fixtures for the media-checksum range walks (src/taglib/media-ranges.ts).

    python3 tests/test-files/_gen/make-media-range-fixtures.py
    python3 tests/test-files/_gen/make-media-range-fixtures.py --large

The first form writes every fixture; `--large` writes only the megabyte-scale
`mp3/large-1_2MiB.mp3`, the fixture the partial-load source-equivalence test in
tests/media-checksum.test.ts needs.

Paths resolve from this script's own location (the `_gen` convention), so the
fixtures land in tests/test-files/ wherever the checkout lives. Every fixture
is built by hand so the byte offsets the tests assert are known by
construction; the only input that is not built here is `flac/kiss-snippet.flac`
(the base stream the FLAC variants wrap). TagLib's own test data under
lib/taglib/tests/data is read by tests/media-ranges.test.ts directly, never by
this script — as is `wav/bext-ixml.wav`, the one WAV fixture with an odd-sized
chunk, which is where the walk's pad-byte rule is pinned.
"""

import hashlib
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "..")

MP3_DIR = os.path.join(FILES, "mp3")
FLAC_DIR = os.path.join(FILES, "flac")
MP4_DIR = os.path.join(FILES, "mp4")
WAV_DIR = os.path.join(FILES, "wav")

# The untagged file every FLAC variant wraps: 245430 bytes whose two-block
# metadata chain ends at 323, so the variants differ from it only by tag bytes.
BASE_FLAC = os.path.join(FLAC_DIR, "kiss-snippet.flac")

# The tagged MP3 `large-1_2MiB.mp3` repeats a frame of. Its 102 frames start at
# 359 (the ID3v2.3 tag: 10-byte header + a 349-byte syncsafe size) and end at
# 85226, which is where the file ends — so its last frame is the file's tail.
BASE_MP3 = os.path.join(MP3_DIR, "kiss-snippet.mp3")


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


# The partial-load window `TagLib.open` splices around: a 1 MiB header window
# plus a 128 KiB footer window (taglib-class.ts:133-135). A file at or below
# their sum is read whole and never spliced, so `large-1_2MiB.mp3` has to exceed
# it — which is the one property that fixture exists for.
HEADER_WINDOW = 1024 * 1024
FOOTER_WINDOW = 128 * 1024
PARTIAL_WINDOW = HEADER_WINDOW + FOOTER_WINDOW

# mpegFrameLength's tables (src/taglib/metadata-extent.ts, mirroring
# mpegheader.cpp:236-264): kbps by version, layer and bitrate index; Hz by
# version and sample-rate index. Rows are Layer I, II, III within a version.
MPEG_BITRATES = (
    (
        (0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0),
        (0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0),
        (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0),
    ),
    (
        (0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0),
        (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0),
        (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0),
    ),
)
MPEG_SAMPLE_RATES = (
    (44100, 48000, 32000),  # MPEG-1
    (22050, 24000, 16000),  # MPEG-2
    (11025, 12000, 8000),  # MPEG-2.5
)


def id3v2_length(data: bytes) -> int:
    """Bytes the ID3v2 tag at the head of `data` occupies: its ten-byte header
    plus the syncsafe size (and the ten-byte footer when the flags promise one,
    which is where `id3v2End` counts it too)."""
    assert data[:3] == b"ID3", data[:3]
    size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
    return 10 + size + (10 if data[5] & 0x10 else 0)


def mpeg_frame_length(data: bytes, at: int) -> int:
    """Length of the MPEG audio frame whose header sits at `at`, or 0 when no
    plausible header is there. A transcription of `mpegFrameLength`
    (src/taglib/metadata-extent.ts), so the fixture finds its frame the way the
    walk finds frames — a hardcoded 1044 would stop matching the file the day
    the base changed, silently, and the fixture would stop partial-loading."""
    if at + 4 > len(data):
        return 0
    if data[at] != 0xFF or (data[at + 1] & 0xE0) != 0xE0:
        return 0
    version = (data[at + 1] >> 3) & 0x03
    layer = (data[at + 1] >> 1) & 0x03
    if version == 0x01 or layer == 0x00:
        return 0
    bitrate_index = (data[at + 2] >> 4) & 0x0F
    sample_rate_index = (data[at + 2] >> 2) & 0x03
    if bitrate_index in (0x00, 0x0F) or sample_rate_index == 0x03:
        return 0

    mpeg1 = version == 0b11
    layer_index = layer ^ 0b11  # 11=Layer I -> 0, 10=II -> 1, 01=III -> 2
    bitrate = MPEG_BITRATES[0 if mpeg1 else 1][layer_index][bitrate_index]
    sample_rate = MPEG_SAMPLE_RATES[
        0 if mpeg1 else (1 if version == 0b10 else 2)
    ][sample_rate_index]
    if layer_index == 2:
        samples = 1152 if mpeg1 else 576
    elif layer_index == 1:
        samples = 1152
    else:
        samples = 384
    # C++ integer division truncates (mpegheader.cpp:236-264), and so does `//`.
    length = samples * bitrate * 125 // sample_rate
    if data[at + 2] & 0x02:
        length += 4 if layer_index == 0 else 1
    return length


def last_frame(data: bytes) -> bytes:
    """The last MPEG frame of `data`, walked from the first byte after an ID3v2
    tag the way the range walk walks frames: the last frame is the one whose end
    is EOF. Requires the audio to run to EOF — a trailing tag would make the
    walk stop before it and this fixture's "ends exactly at the file's size"
    premise would be false."""
    at = id3v2_length(data) if data[:3] == b"ID3" else 0
    frame = b""
    while True:
        length = mpeg_frame_length(data, at)
        if length == 0:
            break
        frame = data[at : at + length]
        at += length
    assert frame, "no MPEG frame found"
    assert at == len(data), (at, len(data))
    return frame


def synth_large_mp3() -> bytes:
    """`kiss-snippet.mp3` with its last frame repeated until the file clears the
    partial-load window, then an ID3v1 block. Measured: 349 + 10 = 359 bytes of
    ID3v2.3 tag, 102 original frames, a 1044-byte last frame, so 1049 copies
    (85226 + 1049*1044 + 128 = 1180510) clear the 1179648-byte window by 862.

    Two properties are the whole point. The file is bigger than the window, so
    `loadAudioData` splices a header+footer image out of a `File` input instead
    of reading it whole; and the repeated bytes are real MPEG audio, so the
    spliced-away middle is payload. A fixture that padded instead would leave the
    payload walk with nothing to disagree about, and the source-equivalence test
    (`tests/media-checksum.test.ts`) would pass while proving nothing.

    The ID3v1 block is not decoration either: it is what makes the footer window
    carry a trailer, so the splice has to clear BOTH gates rather than only the
    header one."""
    with open(BASE_MP3, "rb") as f:
        base = f.read()
    frame = last_frame(base)
    assert len(frame) == 1044, len(frame)

    copies = (PARTIAL_WINDOW - len(base) - len(id3v1())) // len(frame) + 1
    out = base + frame * copies + id3v1()
    assert len(out) - PARTIAL_WINDOW == 862, len(out) - PARTIAL_WINDOW
    return out


def mp4_atom(atom_type: bytes, body: bytes) -> bytes:
    """A top-level ISO-BMFF atom: a 32-bit big-endian size that counts the
    header, the 4-character type, then the body. An empty body is therefore an
    8-byte atom, which is the legal empty `mdat` the walk must skip."""
    assert len(atom_type) == 4, atom_type
    return (8 + len(body)).to_bytes(4, "big") + atom_type + body


def mp4_atom64(atom_type: bytes, body: bytes) -> bytes:
    """The 64-bit size encoding: size field 1 (which is what the walk reads as
    "the real length follows"), then the 64-bit big-endian length after the
    type. The header is 16 bytes, not 8, so the contents start further in."""
    assert len(atom_type) == 4, atom_type
    return (
        (1).to_bytes(4, "big")
        + atom_type
        + (16 + len(body)).to_bytes(8, "big")
        + body
    )


def synth_mp4() -> bytes:
    """Seven top-level atoms, 176 bytes: ftyp (24), free (16), mdat (32
    contents), a 64-bit-size mdat (24 contents), an empty mdat (8), moov (24),
    mdat (16 contents). Three of them are `mdat`s, so the walk must answer three
    ranges whose contents start at 48, 96 and 160 — the offsets
    tests/media-ranges.test.ts asserts. The empty one sits between the 64-bit
    `mdat` and `moov` on purpose: it is legal, and a walk that treated it as
    either corruption or a range would fail there rather than at the sizes."""
    ftyp = mp4_atom(b"ftyp", b"isom" + b"\x00\x00\x02\x00" + b"isomiso2")
    free = mp4_atom(b"free", b"\x00" * 8)
    mdat = mp4_atom(b"mdat", b"A" * 32)
    mdat64 = mp4_atom64(b"mdat", b"B" * 24)
    empty = mp4_atom(b"mdat", b"")
    moov = mp4_atom(b"moov", b"\x00" * 16)
    tail = mp4_atom(b"mdat", b"C" * 16)
    out = ftyp + free + mdat + mdat64 + empty + moov + tail
    # 24 + 16 + 40 + 40 + 8 + 24 + 24. Anything else means a header's bytes are
    # not accounted for, which is exactly what the asserted offsets depend on.
    assert len(out) == 176, len(out)
    return out


def wav_payload() -> bytes:
    """The one payload both matched WAV fixtures carry, 4096 bytes. Shake-128
    rather than a repeating pattern: the pair's property is that two files hash
    the same payload, and a periodic filler would hide an offset error that is a
    multiple of the period."""
    return hashlib.shake_128(b"taglib-wasm wav payload").digest(4096)


def wav_chunk(chunk_id: bytes, payload: bytes) -> bytes:
    """A RIFF chunk: 4-character id, 4-byte little-endian payload size, then the
    payload. No pad byte is written, which is why every size here is even — the
    walk's padding rule (`o = dataStart + size + (size % 2)`) is exercised
    instead by `bext-ixml.wav`, whose 629-byte `bext` chunk is real."""
    assert len(chunk_id) == 4, chunk_id
    assert len(payload) % 2 == 0, len(payload)
    return chunk_id + len(payload).to_bytes(4, "little") + payload


def wav(chunks: list) -> bytes:
    """`RIFF` + a size that counts everything after it (`WAVE` included), then
    `WAVE` and the chunks. The size field is written correctly even though the
    walk trusts the buffer length instead: a fixture with a wrong one would be
    malformed, and a reader that checks it (TagLib does) would reject the file."""
    body = b"WAVE" + b"".join(chunks)
    return b"RIFF" + len(body).to_bytes(4, "little") + body


def wav_fmt_pcm16() -> bytes:
    """The canonical 16-byte PCM `fmt ` payload: format 1, one channel,
    44100 Hz, 16-bit — so the fixture is a WAV a real reader accepts rather than
    a RIFF-shaped byte string."""
    return struct.pack("<HHIIHH", 1, 1, 44100, 88200, 2, 16)


def synth_wav_pair() -> tuple:
    """The matched pair, differing only in where `data` sits. Both carry the
    same 4096-byte payload, and the tagged one's two tag chunks sit between
    `fmt ` and `data`: RIFF (12) + fmt (8+16) + LIST (8+18) + id3 (8+10) is what
    puts its payload at 88, against the plain file's 44 — the offsets the tests
    assert, and the reason the pair's hashes must still agree."""
    fmt = wav_chunk(b"fmt ", wav_fmt_pcm16())
    data = wav_chunk(b"data", wav_payload())
    plain = wav([fmt, data])
    # A LIST/INFO chunk holding one INAM sub-chunk: 4 + 4 + 4 + 6 = 18 bytes.
    # An `id3 ` chunk holding an empty (10-byte, bodyless) ID3v2.4 tag — the same
    # header-plus-no-body tag `id3v2` builds for the FLAC fixtures, so both tag
    # chunks are well-formed rather than filler of the right size.
    list_chunk = wav_chunk(
        b"LIST", b"INFO" + b"INAM" + (6).to_bytes(4, "little") + b"synth\x00"
    )
    id3_chunk = wav_chunk(b"id3 ", id3v2(b""))
    tagged = wav([fmt, list_chunk, id3_chunk, data])
    # 12 + 24 + 8 + 4096, and 12 + 24 + 26 + 18 + 8 + 4096.
    assert len(plain) == 4140, len(plain)
    assert len(tagged) == 4184, len(tagged)
    return plain, tagged


def write(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print(f"{len(data):>9d}  {os.path.relpath(path, FILES)}")


def main(argv: list) -> None:
    """Write the fixtures. `--large` writes ONLY `mp3/large-1_2MiB.mp3` — the
    one fixture here that is a megabyte of repeated audio rather than a
    hand-laid byte string — while no argument writes every one of them, which is
    what a checkout missing a fixture needs."""
    unknown = [arg for arg in argv if arg != "--large"]
    if unknown:
        raise SystemExit(
            f"unknown argument(s): {' '.join(unknown)} — the only mode is --large"
        )

    if "--large" not in argv:
        write_small_fixtures()

    # 1180510 bytes: the only fixture big enough to make the loader splice a
    # File input (see synth_large_mp3), and so the only one whose absence makes
    # tests/media-checksum.test.ts's equivalence leg vacuous.
    write(os.path.join(MP3_DIR, "large-1_2MiB.mp3"), synth_large_mp3())


def write_small_fixtures() -> None:
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

    # The MP4 walk's oracle: multiple `mdat`s, one of them 64-bit-sized, one of
    # them empty. Nothing here is audio — the walk's contract is the byte ranges
    # it hands the checksum, and the synthetic layout is what makes those
    # offsets (48, 96, 160) known by construction.
    write(os.path.join(MP4_DIR, "synth-multi-mdat.mp4"), synth_mp4())

    # The WAV matched pair: one 4096-byte payload, and the tag chunks sit
    # between `fmt ` and `data` in the tagged file, so its payload starts at 88
    # against the plain file's 44. The test's assertion is that both hash the
    # same bytes — and `walkWav` is what has to find that payload in both.
    plain_wav, tagged_wav = synth_wav_pair()
    write(os.path.join(WAV_DIR, "synth-plain.wav"), plain_wav)
    write(
        os.path.join(WAV_DIR, "synth-tags-before-data.wav"),
        tagged_wav,
    )


if __name__ == "__main__":
    main(sys.argv[1:])
