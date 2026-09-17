#!/usr/bin/env python3
"""Build an MP4 whose ilst carries a numeric `gnre` atom BEFORE the string ©gen.

Reproducer for taglib-lna2 (MP4 genre precedence / fidelity loss), re-verified
against the pinned TagLib 2.3.2 on 2026-09-16:

  gnre (index 18 -> "Rock") before ©gen ("Rock & Roll")
    readTags().genre            -> ["Rock"]      (the string atom is shadowed)
    no-op read-modify-write     -> ©gen on disk becomes "Rock"  (both backends)
    readTags -> applyTags       -> same collapse

Upstream cause: MP4::ItemFactory folds gnre into the ©gen item
(mp4itemfactory.cpp parseGnre -> ID3v1::genre(idx - 1)) and
MP4::Tag::addItem is first-wins (mp4tag.cpp), so whichever atom parses first
wins and the other is discarded at parse time.

NOT a test-fixture generator: no test consumes its output, because pinning the
current behavior in a test would freeze the defect. It exists so whoever picks
up taglib-lna2 (needs an upstream TagLib patch) has a runnable starting point.

    python3 tests/test-files/_gen/make-gnre-first-mp4.py /tmp/gnre-first.m4a

Layout note: the source fixture keeps moov LAST (ftyp, free, mdat, moov), so
growing moov does not shift mdat and no stco fixups are needed. Rebuilding a
file whose moov precedes mdat would invalidate its chunk offsets.
"""

import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "mp4", "kiss-snippet.m4a")

# ID3v1 table index 17 == "Rock"; the atom stores index + 1 (TagLib reads
# ID3v1::genre(idx - 1)). The ©gen string deliberately differs so a collapse is
# observable: "Rock & Roll" -> "Rock".
GNRE_VALUE = struct.pack(">H", 18)
GEN_STRING = "Rock & Roll".encode()


def boxes(data, start, end):
    out = []
    i = start
    while i < end - 8:
        size = struct.unpack(">I", data[i:i + 4])[0]
        if size < 8 or i + size > end:
            break
        out.append((data[i + 4:i + 8], i, size))
        i += size
    return out


def box(name, payload):
    return struct.pack(">I", len(payload) + 8) + name + payload


def main(out_path):
    data = open(SRC, "rb").read()

    top = boxes(data, 0, len(data))
    _, moov_at, moov_size = next(b for b in top if b[0] == b"moov")
    moov_payload = data[moov_at + 8:moov_at + moov_size]

    _, udta_at, udta_size = next(
        b for b in boxes(moov_payload, 0, len(moov_payload)) if b[0] == b"udta"
    )
    udta_payload = moov_payload[udta_at + 8:udta_at + udta_size]

    _, meta_at, meta_size = next(
        b for b in boxes(udta_payload, 0, len(udta_payload)) if b[0] == b"meta"
    )
    meta_body = udta_payload[meta_at + 8:meta_at + meta_size]
    assert meta_body[0:4] == b"\x00\x00\x00\x00", "meta version/flags"
    meta_children = meta_body[4:]

    _, ilst_at, ilst_size = next(
        b for b in boxes(meta_children, 0, len(meta_children)) if b[0] == b"ilst"
    )
    ilst_payload = meta_children[ilst_at + 8:ilst_at + ilst_size]

    items = [
        (name, ilst_payload[i + 8:i + size])
        for name, i, size in boxes(ilst_payload, 0, len(ilst_payload))
    ]

    new_items = []
    # 1. gnre first: data box, type 0 (implicit), 2-byte big-endian index.
    new_items.append((b"gnre", box(b"data", struct.pack(">II", 0, 0) + GNRE_VALUE)))
    # 2. the string genre, with a value the 8-bit table cannot represent.
    for name, payload in items:
        if name == b"\xa9gen":
            new_items.append(
                (name, box(b"data", struct.pack(">II", 0, 1) + GEN_STRING))
            )
        else:
            new_items.append((name, payload))

    new_meta = b"\x00\x00\x00\x00" + box(
        b"ilst", b"".join(box(n, p) for n, p in new_items)
    )
    new_meta += meta_children[ilst_at + ilst_size:]
    new_udta = udta_payload[:meta_at] + box(b"meta", new_meta)
    new_udta += udta_payload[meta_at + meta_size:]
    new_moov = moov_payload[:udta_at] + box(b"udta", new_udta)
    new_moov += moov_payload[udta_at + udta_size:]

    out = data[:moov_at] + box(b"moov", new_moov)
    open(out_path, "wb").write(out)
    print(
        f"wrote {out_path}: gnre(->Rock) before ©gen('Rock & Roll'), "
        f"{len(out)} bytes"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
