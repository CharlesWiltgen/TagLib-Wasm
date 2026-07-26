#ifndef TAGLIB_MP4_ATOMS_H
#define TAGLIB_MP4_ATOMS_H

#include <mp4file.h>
#include <mp4item.h>
#include <mp4tag.h>
#include <tpropertymap.h>
#include <tstringlist.h>

#include <vector>

// Canonical Apple freeform atom names (taglib-bnhl).
//
// TagLib::PropertyMap uppercases EVERY key on insert and lookup
// (toolkit/tpropertymap.cpp), so a freeform atom read as
// "----:com.apple.iTunes:iTunNORM" arrives as the key "ITUNNORM" and the
// original casing is gone before we see it. Writing back,
// ItemFactory::nameForPropertyKey rebuilds "----:com.apple.iTunes:" + key and
// produces "ITUNNORM". ExifTool recognises Apple's casing and not the
// upper-cased variant, so the upper-cased atom reads as an unknown atom to at
// least one widely used tool.
//
// MP4::Tag::setItem() bypasses the PropertyMap and stores the exact atom name,
// so the fix is to route these keys around the PropertyMap on write. Because
// setItem() replaces an identically-named atom, this also stops the
// duplicate-atom problem for every atom listed here (MP4::Tag::setProperties
// skips its erase when the incoming map still contains the key, then writes the
// upper-cased twin alongside the surviving original).
//
// ORDERING IS LOAD-BEARING: extract before file->setProperties() so the
// upper-cased twin is never created, then apply after it, because
// setProperties() erases items for keys absent from the incoming map.
//
// Adding an atom here fixes both its casing and its duplication.
//
// THIS TABLE IS NOT A COMPLETE ANSWER, and is not meant to become one.
// Enumerating known atoms cannot fix the general case: on WASI, any freeform
// atom whose name is not already all-uppercase is still rewritten upper-cased,
// because mp4ItemPropertyKey() (src/runtime/wasi-adapter/file-handle.ts)
// uppercases the name to reach the PropertyMap at all. Measured — via
// setMP4Item, WASI currently mangles "iTunes_CDDB_1", "lowercase", and even
// "MusicBrainz Track Id" (which upstream itself maps correctly, and which the
// typed musicbrainzTrackId property still writes correctly). Emscripten is
// correct for every name because it uses TagLib's dedicated Item API.
//
// The real fix is preserving each atom's original name end to end rather than
// enumerating; tracked as part (a) of taglib-bnhl. Entries here exist because
// iTunNORM and iTunSMPB are the two that demonstrably harm real files today —
// unrecognised volume normalization, and an ambiguous duplicate of the atom
// carrying encoder delay/padding for gapless playback.

struct Mp4CanonicalAtom {
    const char* property_key;  // uppercase PropertyMap key TagLib reports
    const char* atom_name;     // exact atom name Apple's own tools write
};

static const Mp4CanonicalAtom MP4_CANONICAL_ATOMS[] = {
    {"ITUNNORM", "----:com.apple.iTunes:iTunNORM"},
    {"ITUNSMPB", "----:com.apple.iTunes:iTunSMPB"},
};

struct Mp4ExtractedAtom {
    const char* atom_name;
    TagLib::StringList values;
};

/*!
 * Remove every canonical-atom key from \a propMap and return the values, so a
 * following file->setProperties() cannot write the upper-cased twin. Returns
 * empty for non-MP4 files, leaving \a propMap untouched.
 */
inline std::vector<Mp4ExtractedAtom> extract_mp4_canonical_atoms(
    TagLib::File* file, TagLib::PropertyMap& propMap)
{
    std::vector<Mp4ExtractedAtom> extracted;
    if (!dynamic_cast<TagLib::MP4::File*>(file)) return extracted;

    for (const auto& entry : MP4_CANONICAL_ATOMS) {
        auto it = propMap.find(entry.property_key);
        if (it == propMap.end()) continue;
        extracted.push_back({entry.atom_name, it->second});
        propMap.erase(entry.property_key);
    }
    return extracted;
}

/*!
 * Write the extracted atoms under their exact Apple names. An empty value list
 * removes the atom, matching PropertyMap clear semantics. Must run AFTER
 * file->setProperties().
 */
inline void apply_mp4_canonical_atoms(
    TagLib::File* file, const std::vector<Mp4ExtractedAtom>& extracted)
{
    if (extracted.empty()) return;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;

    for (const auto& atom : extracted) {
        if (atom.values.isEmpty()) {
            mp4->tag()->removeItem(atom.atom_name);
        } else {
            mp4->tag()->setItem(atom.atom_name, TagLib::MP4::Item(atom.values));
        }
    }
}

#endif  // TAGLIB_MP4_ATOMS_H
