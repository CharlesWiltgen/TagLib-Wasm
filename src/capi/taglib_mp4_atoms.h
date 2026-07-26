#ifndef TAGLIB_MP4_ATOMS_H
#define TAGLIB_MP4_ATOMS_H

#include <mp4file.h>
#include <mp4item.h>
#include <mp4tag.h>
#include <tpropertymap.h>
#include <tstringlist.h>

#include <string>
#include <vector>

// MP4 freeform atom-name fidelity (taglib-bnhl).
//
// TagLib::PropertyMap uppercases EVERY key on insert and lookup
// (toolkit/tpropertymap.cpp), so a freeform atom read as
// "----:com.apple.iTunes:iTunNORM" arrives as the key "ITUNNORM". Writing back,
// ItemFactory::nameForPropertyKey rebuilds "----:com.apple.iTunes:" + key and
// emits the upper-cased twin, while MP4::Tag::setProperties leaves the original
// item in place (its erase pass is skipped whenever the incoming map still
// contains the key). Net effect: wrong casing on creation, and a duplicate atom
// on every save of a file that already had one.
//
// The fix does NOT enumerate known atoms. It preserves the name that already
// exists: snapshot the exact freeform names straight off the file before the
// PropertyMap write, then move each upper-cased twin back onto its original
// name afterwards. That works for every atom — including vendor atoms nobody
// has heard of — because the file itself is the source of truth.
//
// Two names cannot be recovered this way and must be supplied by the caller:
//   * an atom being CREATED, where nothing on disk carries the spelling. The
//     caller knows it (setMP4Item takes the full atom name; a typed property
//     like appleSoundCheck has its atom name in the PROPERTIES table), so the
//     caller passes it in as an extra name.
//
// ORDERING IS LOAD-BEARING: capture BEFORE file->setProperties(), restore AFTER
// it, because setProperties both creates the twin and erases items whose keys
// are absent from the incoming map.

inline const char* MP4_FREEFORM_PREFIX = "----:com.apple.iTunes:";

/*!
 * Exact names of every com.apple.iTunes freeform atom currently on \a file.
 * Empty for non-MP4 files.
 */
inline std::vector<std::string> capture_mp4_freeform_names(TagLib::File* file)
{
    std::vector<std::string> names;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return names;

    const size_t prefix_len = strlen(MP4_FREEFORM_PREFIX);
    for (const auto& [name, item] : mp4->tag()->itemMap()) {
        std::string n = name.to8Bit(true);
        if (n.compare(0, prefix_len, MP4_FREEFORM_PREFIX) == 0) {
            names.push_back(n);
        }
    }
    return names;
}

/*!
 * Fold an atom name to a separator- and case-insensitive form, so a mangled
 * twin can be recognised as the same atom as its canonical spelling.
 *
 * An exact "same name, upper-cased" comparison is not enough: TagLib builds the
 * twin from the PROPERTY KEY it was handed, and our keys do not always differ
 * from the atom name by case alone. "Acoustid Fingerprint" is keyed
 * ACOUSTID_FINGERPRINT — space versus underscore — so the twin is
 * "...:ACOUSTID_FINGERPRINT", which no re-casing of the original name produces.
 * Folding away `_`, space and case matches all observed forms
 * (iTunNORM/ITUNNORM, replaygain_track_gain/REPLAYGAIN_TRACK_GAIN,
 * "Acoustid Fingerprint"/ACOUSTID_FINGERPRINT) without having to teach C++ our
 * key-naming conventions.
 */
inline std::string mp4_fold_atom_name(const std::string& name)
{
    std::string folded;
    folded.reserve(name.size());
    for (char c : name) {
        if (c == '_' || c == ' ') continue;
        folded.push_back((c >= 'a' && c <= 'z') ? static_cast<char>(c - 32) : c);
    }
    return folded;
}

/*!
 * Move each mangled twin atom back onto its canonical name. Call AFTER
 * file->setProperties(). \a names should be the capture from before the write
 * plus any name the caller is creating.
 *
 * When a file already carries BOTH spellings (an earlier save wrote a twin
 * alongside the original), the twin's value wins — it is the one setProperties
 * just wrote, so it reflects any edit — and the twin atom is removed. That
 * collapses a previously duplicated atom back to one correctly-named atom
 * without losing the current value.
 */
inline void restore_mp4_freeform_names(TagLib::File* file,
                                       const std::vector<std::string>& names)
{
    if (names.empty()) return;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;
    auto* tag = mp4->tag();

    const size_t prefix_len = strlen(MP4_FREEFORM_PREFIX);
    for (const auto& name : names) {
        if (name.compare(0, prefix_len, MP4_FREEFORM_PREFIX) != 0) continue;
        const TagLib::String target(name, TagLib::String::UTF8);
        const std::string folded = mp4_fold_atom_name(name);

        // Collect every differently-spelled atom that folds to this one. Copy
        // the names out first: removing items while iterating itemMap() would
        // invalidate the iteration.
        std::vector<TagLib::String> twins;
        bool has_value = false;
        TagLib::MP4::Item value;
        for (const auto& [itemName, item] : tag->itemMap()) {
            if (itemName == target) continue;
            const std::string n = itemName.to8Bit(true);
            if (n.compare(0, prefix_len, MP4_FREEFORM_PREFIX) != 0) continue;
            if (mp4_fold_atom_name(n) != folded) continue;
            twins.push_back(itemName);
            value = item;
            has_value = true;
        }
        if (!has_value) continue;

        for (const auto& twin : twins) tag->removeItem(twin);
        tag->setItem(target, value);
    }
}

#endif  // TAGLIB_MP4_ATOMS_H
