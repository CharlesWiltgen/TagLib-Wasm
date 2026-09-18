/*
 * MP4 genre precedence: the string ©gen wins over the numeric gnre (taglib-lna2).
 *
 * TagLib folds the legacy numeric `gnre` atom into the `©gen` item at parse
 * (mp4itemfactory.cpp:346, :124-125 -> parseGnre at :555-568, value
 * ID3v1::genre(idx - 1)) and MP4::Tag::addItem is FIRST-WINS
 * (mp4tag.cpp:630-638), so whichever atom the ilst yields first decides. A file
 * whose `gnre` precedes a differing string `©gen` therefore reads the 8-bit
 * table name — and because MP4::Tag::save() rebuilds the whole ilst from the
 * parsed item map (mp4tag.cpp:109-124), every save re-renders `©gen` from that
 * folded value and drops the `gnre` atom. A bare save() with no writes
 * included, which is the fidelity loss this fixes.
 *
 * The fold discards the numeric atom's identity, so TagLib's parsed item alone
 * cannot tell "the string said Rock & Roll" from "the table said Rock". The raw
 * ilst bytes still can, and they are readable here — which is exactly the shape
 * of the two boundary fixes that precede this one (taglib_mp4_advisory.h for
 * rtng, taglib_mp4_atoms.h for freeform names). No upstream patch: lib/taglib
 * is a pristine submodule, so the rule lives in our boundary.
 *
 * The rule, applied once at file open:
 *
 *   - a valid text `©gen` plus a `gnre` atom => the string value wins;
 *   - `gnre` alone => TagLib's table name stands (nothing is lost: a save
 *     rewrites the numeric atom as a string carrying the same name);
 *   - no `gnre` => untouched, so a plain iTunes-written file is byte-identical
 *     after a save;
 *   - an explicit setGenre()/setProperties() still wins for the caller, because
 *     this runs at open and the caller writes afterwards.
 *
 * "Valid text ©gen" is TagLib's own rule, not a copy of it: the probe below
 * hands each candidate child to ItemFactory::parseItem, the very call
 * MP4::Tag::read() makes. That matters — parseText accepts a data box only when
 * its type word is 1 (mp4itemfactory.h:196-197, check at :478), and a raw scan
 * that skipped the check would resurrect values TagLib deliberately dropped
 * (taglib-lna2 spent a re-verification round on exactly this). Re-deriving the
 * rule by hand was measured ~4 µs per open cheaper (a header-only descent) and
 * rejected for that reason: a copy of the rule can drift silently where this
 * cannot.
 *
 * Load-time is sufficient on BOTH backends, verified rather than assumed:
 *   - WASI: the MessagePack snapshot this hand-out encodes is also the write
 *     model (src/runtime/wasi-adapter/handle-state.ts save() -> taglib_shim.cpp
 *     apply_propmap -> setProperties), so a corrected item rides the save for
 *     free — tl_write_tags, both from buffer and from path.
 *   - Emscripten: the in-memory tag IS the model every write renders from
 *     (build/taglib_embind.cpp FileHandle::save), so writing the item across at
 *     load fixes tag().genre, properties(), getMP4Item("©gen") and the save in
 *     one move — measured in the ticket's probe.
 * Emitting a per-save directive instead would need a recorded "as-parsed"
 * value and could not tell a caller deliberately re-setting the derived value
 * from nobody writing at all; normalizing here has no such ambiguity.
 *
 * Cost, measured on the Emscripten artifact (medians of 8 alternating runs over
 * the 118 KB fixture, `tag().genre` per open): 55.5 µs before this fix, 67.3 µs
 * after — one extra atom-header walk, proportional to atom count, not file size
 * (Atom::read skips containers by length, so mdat and trak cost one header
 * each). Only MP4 files pay it, and only because the parsed item map has
 * already destroyed the evidence.
 */
#ifndef TAGLIB_MP4_GENRE_H
#define TAGLIB_MP4_GENRE_H

#include <mp4atom.h>
#include <mp4file.h>
#include <mp4item.h>
#include <mp4itemfactory.h>
#include <mp4tag.h>
#include <tbytevector.h>
#include <tfile.h>
#include <tstring.h>
#include <tstringlist.h>

#include <cstddef>

namespace taglib_wasm {

/*!
 * Resolve the MP4 genre precedence on the open \a file. A no-op for every
 * non-MP4 file, and for MP4 files without a coexisting `gnre` + valid text
 * `©gen` pair.
 */
inline void resolve_mp4_genre_precedence(TagLib::File* file) {
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4) return;
    auto* tag = static_cast<TagLib::MP4::Tag*>(mp4->tag());
    if (!tag) return;

    // TagLib keeps its atom tree private, so re-walk it here. Mirroring
    // MP4::Tag::read()'s own path ("moov", "udta", "meta", "ilst") rather than
    // searching the bytes keeps this off any false positive inside a
    // container's payload.
    const TagLib::MP4::Atoms atoms(mp4);
    const TagLib::MP4::Atom* ilst = atoms.find("moov", "udta", "meta", "ilst");
    if (!ilst) return;

    const TagLib::MP4::ItemFactory* factory =
        TagLib::MP4::ItemFactory::instance();
    bool hasGnre = false;
    TagLib::MP4::Item stringGenre;
    for (const auto& atom : ilst->children()) {
        const TagLib::ByteVector& name = atom->name();
        if (name == "gnre") {
            hasGnre = true;
            continue;
        }
        // The FIRST valid string atom is the one TagLib would have kept, so a
        // later duplicate must not override it (an invalid one never reached
        // the item map either).
        if (name != "\251gen" || stringGenre.isValid()) continue;
        // A child with no room for a data box cannot carry one; TagLib's own
        // read would ask for a wrapped block there and parse garbage.
        if (atom->length() <= 8) continue;
        // MP4::Tag::read() hands the factory exactly these bytes
        // (mp4tag.cpp:71-77): seek to offset + 8, read length - 8. The 8 is
        // hardcoded there too, so a 64-bit child reads exactly as upstream.
        mp4->seek(atom->offset() + 8, TagLib::File::Beginning);
        stringGenre = factory->parseItem(
            atom, mp4->readBlock(static_cast<size_t>(atom->length() - 8)))
                          .second;
    }
    if (!hasGnre || !stringGenre.isValid()) return;

    // TagLib's first-wins fold already landed on the string when it parsed
    // first (and an ilst without `gnre` never gets here), so only a genuine
    // disagreement rewrites the item.
    if (tag->contains("\251gen") &&
        tag->item("\251gen").toStringList() == stringGenre.toStringList()) {
        return;
    }
    tag->setItem("\251gen", stringGenre);
}

}  // namespace taglib_wasm

#endif  // TAGLIB_MP4_GENRE_H
