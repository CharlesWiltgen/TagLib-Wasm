#!/usr/bin/env python3
"""Build an MP4 whose ilst carries a numeric `gnre` atom relative to the string ©gen.

Fixture generator for taglib-lna2 (MP4 genre precedence / fidelity loss),
re-verified against the pinned TagLib 2.3.2 on 2026-09-16 with a valid ©gen text
atom (flags=1, locale=0 — a swapped pair makes the item invalid and it
disappears at parse, which silently invalidates the experiment):

  omit   -> ©gen only ("Rock & Roll")      readTags().genre -> ["Rock & Roll"]
  only   -> gnre only (no ©gen)            readTags().genre -> ["Rock"]
  before -> gnre, then ©gen                readTags().genre -> ["Rock"]
  after  -> ©gen, then gnre                readTags().genre -> ["Rock & Roll"]

`before`/`after` are the first-wins signature: whichever atom parses first is
kept, so a gnre-first file loses the string genre. `omit` is the control that
proves ©gen parses on its own; `only` is the fallback arm — the ID3v1 table
name is the only genre there is, and the fix must not change it.

Upstream cause: MP4::ItemFactory folds gnre into the ©gen item
(mp4itemfactory.cpp parseGnre -> ID3v1::genre(idx - 1)) and
MP4::Tag::addItem is first-wins (mp4tag.cpp), so the second atom is discarded
at parse time. The fix is ours, not upstream's: src/capi/taglib_mp4_genre.h
resolves the precedence at file open on both backends, and
tests/mp4-genre-precedence.test.ts consumes these four fixtures — regenerate
them with this script, never by hand:

    python3 tests/test-files/_gen/make-gnre-first-mp4.py tests/test-files/mp4/genre-gnre-before.m4a
    python3 tests/test-files/_gen/make-gnre-first-mp4.py tests/test-files/mp4/genre-gnre-after.m4a  after
    python3 tests/test-files/_gen/make-gnre-first-mp4.py tests/test-files/mp4/genre-gnre-omit.m4a   omit
    python3 tests/test-files/_gen/make-gnre-first-mp4.py tests/test-files/mp4/genre-gnre-only.m4a   only
    (order defaults to before)

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


def main(out_path, order="before"):
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
    # 1. optional gnre: data box, type 0 (implicit), 2-byte big-endian index.
    #    parseGnre reads the payload without a flags check (mp4itemfactory.cpp).
    if order != "omit":
        gnre = (b"gnre", box(b"data", struct.pack(">II", 0, 0) + GNRE_VALUE))
        if order in ("before", "only"):
            new_items.append(gnre)
    # 2. the string genre, with a value the 8-bit table cannot represent —
    #    dropped entirely in `only` mode, which leaves gnre as the sole genre.
    #    Text atoms MUST carry flags=1 (UTF-8) in the FIRST word with locale 0
    #    in the second: TagLib's parseText only accepts data whose flags equal
    #    its expectedFlags (1), so a swapped pair makes the item invalid and
    #    the genre silently disappears — which is not the experiment.
    for name, payload in items:
        if name == b"\xa9gen":
            if order == "only":
                continue
            new_items.append(
                (name, box(b"data", struct.pack(">II", 1, 0) + GEN_STRING))
            )
        else:
            new_items.append((name, payload))
    if order == "after":
        new_items.append(
            (b"gnre", box(b"data", struct.pack(">II", 0, 0) + GNRE_VALUE))
        )

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
    if order == "only":
        print(f"wrote {out_path}: gnre(->Rock) only, no ©gen, {len(out)} bytes")
    else:
        where = {"before": "before", "after": "after", "omit": "omitted from"}
        print(
            f"wrote {out_path}: gnre(->Rock) {where[order]} "
            f"©gen('Rock & Roll'), {len(out)} bytes"
        )


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3) or (
        len(sys.argv) == 3
        and sys.argv[2] not in ("before", "after", "omit", "only")
    ):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else "before")
