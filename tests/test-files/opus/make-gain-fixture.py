#!/usr/bin/env python3
"""Generate kiss-snippet-gain.opus: a copy of kiss-snippet.opus with the
OpusHead "output gain" field set to a non-zero value, so tests can verify
that AudioProperties.outputGainDb is parsed and converted (raw Q7.8 / 256).

Output gain set to -5.0 dB  ->  raw Q7.8 value = round(-5.0 * 256) = -1280.

The Ogg page CRC of the page carrying OpusHead is recomputed after patching.
Run from the repo root:  python3 tests/test-files/opus/make-gain-fixture.py
"""
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "kiss-snippet.opus")
DST = os.path.join(HERE, "kiss-snippet-gain.opus")
GAIN_DB = -5.0
RAW_GAIN = round(GAIN_DB * 256)  # signed 16-bit, little-endian

# Ogg CRC32: poly 0x04c11db7, init 0, no input/output reflection, no final xor.
_TABLE = []
for n in range(256):
    c = n << 24
    for _ in range(8):
        c = ((c << 1) ^ 0x04C11DB7) & 0xFFFFFFFF if (c & 0x80000000) else (c << 1) & 0xFFFFFFFF
    _TABLE.append(c)


def ogg_crc(data: bytes) -> int:
    crc = 0
    for b in data:
        crc = ((crc << 8) & 0xFFFFFFFF) ^ _TABLE[((crc >> 24) ^ b) & 0xFF]
    return crc & 0xFFFFFFFF


def main() -> None:
    buf = bytearray(open(SRC, "rb").read())

    head = buf.find(b"OpusHead")
    if head < 0:
        raise SystemExit("OpusHead not found")
    # OpusHead layout: magic(8) version(1) channels(1) pre_skip(2)
    #                  input_sample_rate(4) output_gain(2, int16 LE) ...
    gain_off = head + 16
    struct.pack_into("<h", buf, gain_off, RAW_GAIN)

    # Find the Ogg page that contains `head` and recompute its CRC.
    # Pages start with "OggS"; header is 27 bytes + n_segments segment table.
    page_start = buf.rfind(b"OggS", 0, head + 1)
    if page_start < 0:
        raise SystemExit("enclosing OggS page not found")
    n_segments = buf[page_start + 26]
    seg_table_end = page_start + 27 + n_segments
    page_len = seg_table_end + sum(buf[page_start + 27:seg_table_end])

    # Zero the CRC field (bytes 22..25), compute over the whole page, write back.
    struct.pack_into("<I", buf, page_start + 22, 0)
    crc = ogg_crc(bytes(buf[page_start:page_len]))
    struct.pack_into("<I", buf, page_start + 22, crc)

    open(DST, "wb").write(buf)
    print(f"wrote {DST}: output_gain={RAW_GAIN} ({GAIN_DB} dB), page CRC={crc:#010x}")


if __name__ == "__main__":
    main()
