#ifndef TAGLIB_MP4_ATOMS_H
#define TAGLIB_MP4_ATOMS_H

#include <mp4file.h>
#include <mp4item.h>
#include <mp4tag.h>
#include <tpropertymap.h>
#include <tstringlist.h>

#include <cstring>
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
// One case cannot be recovered this way and must be supplied by the caller: an
// atom being CREATED, where nothing on disk carries the spelling. The caller
// knows it (setMP4Item takes the full atom name; a typed property has its atom
// name in the PROPERTIES table), so it is passed in as an extra name.
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
 * Fold an atom name to a separator- and case-insensitive form.
 *
 * Used only as a FALLBACK, because TagLib builds the twin from the PROPERTY KEY
 * it was handed and our keys do not always differ from the atom name by case
 * alone: "Acoustid Fingerprint" is keyed ACOUSTID_FINGERPRINT — space versus
 * underscore — so no re-casing of the original name produces that twin.
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

/*! The same atom name with its bare NAME upper-cased: the twin TagLib produces
 *  whenever the property key differs from the atom name by case alone. */
inline std::string mp4_uppercased_twin(const std::string& name)
{
    const size_t prefix_len = strlen(MP4_FREEFORM_PREFIX);
    if (name.compare(0, prefix_len, MP4_FREEFORM_PREFIX) != 0) return name;
    std::string twin = name;
    for (size_t i = prefix_len; i < twin.size(); i++) {
        if (twin[i] >= 'a' && twin[i] <= 'z') twin[i] -= 32;
    }
    return twin;
}

/*!
 * The atom TagLib rebuilds for a freeform name that went through the
 * PropertyMap: the bare NAME upper-cased, in TagLib's single hard-coded
 * freeform namespace. ItemFactory::nameForPropertyKey knows only
 * `----:com.apple.iTunes:`, so a `----:com.acme.tool:MyTag` comes back as
 * `----:com.apple.iTunes:MYTAG` — the mean is gone and cannot be recovered from
 * the item itself, only from the name the caller supplied (taglib-wkyi).
 */
inline std::string mp4_propertymap_roundtrip_name(const std::string& name)
{
    const size_t colon = name.rfind(':');
    if (name.compare(0, 5, "----:") != 0 || colon == std::string::npos) {
        return name;
    }
    std::string rebuilt = MP4_FREEFORM_PREFIX;
    for (size_t i = colon + 1; i < name.size(); i++) {
        const char c = name[i];
        rebuilt.push_back((c >= 'a' && c <= 'z') ? static_cast<char>(c - 32) : c);
    }
    return rebuilt;
}

/*!
 * Move each mangled twin atom back onto its canonical name. Call AFTER
 * file->setProperties(). \a names should be the capture from before the write
 * plus any name the caller is creating.
 *
 * Deliberately conservative, because a fold match alone MERGES atoms that are
 * genuinely different. "My_Atom" and "MyAtom" both fold to MYATOM, and an
 * earlier version renamed whichever the item map yielded first, deleting one
 * atom and leaving the survivor holding the other's value — losing the value
 * that had just been written. So:
 *
 *   1. Prefer the EXACT upper-cased twin. That is deterministic and cannot be
 *      confused with a different atom, and it covers both creation
 *      (replaygain_track_gain <- REPLAYGAIN_TRACK_GAIN) and collapsing a
 *      duplicate pair an older release left behind (iTunNORM + ITUNNORM).
 *   2. Otherwise, only when the canonical name is ABSENT, accept a fold match —
 *      and only when there is exactly ONE candidate. Two candidates means the
 *      PropertyMap genuinely cannot tell the atoms apart, so guessing would
 *      destroy one; leave the mangled name in place instead. Wrong casing is
 *      recoverable, a deleted value is not.
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
        // Every freeform atom needs repair, not just Apple-namespaced ones: a
        // foreign mean is collapsed into Apple's namespace on the way through
        // the PropertyMap, so the caller's atom vanishes entirely (taglib-wkyi).
        if (name.compare(0, 5, "----:") != 0) continue;
        const TagLib::String target(name, TagLib::String::UTF8);

        TagLib::String source;
        bool found = false;

        // The round-trip form covers both cases: for an Apple-namespaced atom it
        // is the upper-cased twin, and for a foreign mean it is additionally
        // re-based into Apple's namespace.
        const TagLib::String exactTwin(mp4_propertymap_roundtrip_name(name),
                                       TagLib::String::UTF8);
        if (exactTwin != target && tag->itemMap().contains(exactTwin)) {
            source = exactTwin;
            found = true;
        } else if (!tag->itemMap().contains(target) &&
                   name.compare(0, prefix_len, MP4_FREEFORM_PREFIX) == 0) {
            // Only when the target is genuinely missing, and only within
            // Apple's namespace: a foreign mean has exactly one candidate (the
            // round-trip form above), and matching it by folded name alone
            // could steal an unrelated atom.
            const std::string folded = mp4_fold_atom_name(name);
            int matches = 0;
            for (const auto& [itemName, item] : tag->itemMap()) {
                const std::string n = itemName.to8Bit(true);
                if (n.compare(0, prefix_len, MP4_FREEFORM_PREFIX) != 0) continue;
                if (mp4_fold_atom_name(n) != folded) continue;
                matches++;
                source = itemName;
            }
            found = (matches == 1);
        }
        if (!found) continue;

        const TagLib::MP4::Item item = tag->itemMap()[source];
        tag->removeItem(source);
        tag->setItem(target, item);
    }
}

#endif  // TAGLIB_MP4_ATOMS_H
