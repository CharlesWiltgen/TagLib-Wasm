#ifndef TAGLIB_MP4_ATOMS_H
#define TAGLIB_MP4_ATOMS_H

#include <mp4file.h>
#include <mp4item.h>
#include <mp4tag.h>
#include <tpropertymap.h>
#include <tstringlist.h>

#include <cstring>
#include <map>
#include <string>
#include <vector>

// MP4 freeform atoms bypass the PropertyMap entirely (taglib-bnhl, taglib-wkyi).
//
// TagLib::PropertyMap is a case-normalising key space: it uppercases EVERY key
// on insert and lookup (toolkit/tpropertymap.cpp), and ItemFactory rebuilds a
// freeform atom as its single hard-coded prefix "----:com.apple.iTunes:" plus
// that key. So routing a freeform atom through the PropertyMap destroys three
// things, in increasing order of severity:
//
//   1. its casing        — iTunNORM becomes ITUNNORM
//   2. its identity      — MP4::Tag::setProperties leaves the original item in
//                          place and adds the upper-cased one, duplicating it
//   3. its NAMESPACE     — "----:com.acme.tool:MyTag" is re-emitted as
//                          "----:com.apple.iTunes:MYTAG", so the value lands
//                          under a vendor prefix the caller never asked for
//
// An earlier approach repaired names AFTER the write. It could not fix (3) at
// all, because the mean is gone before the write happens, and its twin-matching
// had to guess which mangled name belonged to which atom — a guess that merged
// two genuinely different atoms and lost a value.
//
// So the twin is never created. Every freeform key is REMOVED from the property
// map before setProperties runs, and freeform atoms are written afterwards with
// MP4::Tag::setItem(), which stores the exact name. There is nothing to repair,
// nothing to match, and no name the mechanism cannot represent.
//
// ORDERING IS LOAD-BEARING: collect and strip BEFORE file->setProperties(),
// apply AFTER it, because setProperties erases items whose keys are absent from
// the incoming map — which, after stripping, is all of them.

inline const char* MP4_FREEFORM_MARKER = "----";
inline const char* MP4_APPLE_PREFIX = "----:com.apple.iTunes:";

/** Name -> values for one freeform atom. An empty value list means "remove". */
using Mp4FreeformMap = std::map<std::string, TagLib::StringList>;

inline bool mp4_is_freeform(const std::string& name)
{
    return name.compare(0, strlen(MP4_FREEFORM_MARKER), MP4_FREEFORM_MARKER) == 0;
}

/**
 * The PropertyMap key TagLib derives from a freeform atom: the bare NAME
 * upper-cased, for Apple-mean atoms only. Empty for any other mean, which
 * TagLib does not surface as a property at all.
 */
inline std::string mp4_derived_property_key(const std::string& name)
{
    const size_t prefix_len = strlen(MP4_APPLE_PREFIX);
    if (name.compare(0, prefix_len, MP4_APPLE_PREFIX) != 0) return std::string();
    std::string key = name.substr(prefix_len);
    for (char& c : key) {
        if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 32);
    }
    return key;
}

/** Every freeform atom currently on \a file, by exact name. */
inline Mp4FreeformMap collect_mp4_freeform_items(TagLib::File* file)
{
    Mp4FreeformMap items;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return items;

    for (const auto& [name, item] : mp4->tag()->itemMap()) {
        const std::string n = name.to8Bit(true);
        if (!mp4_is_freeform(n)) continue;
        items[n] = item.toStringList();
    }
    return items;
}

/**
 * Merge caller edits over the collected set. An entry with no values is KEPT as
 * an explicit removal marker rather than dropped, because both later steps need
 * to see it: strip must remove its property key so setProperties cannot
 * re-create the atom from the still-present key, and apply must call
 * removeItem(). Dropping the marker instead made removeMP4Item a no-op — the
 * atom came straight back through the PropertyMap.
 */
inline void merge_mp4_freeform_edits(Mp4FreeformMap& items,
                                     const Mp4FreeformMap& edits)
{
    for (const auto& [name, values] : edits) {
        items[name] = values;
    }
}

/**
 * Strip every property key that a freeform atom would round-trip through, so
 * setProperties can neither create an upper-cased twin nor rewrite the atom
 * under the wrong mean. Call BEFORE file->setProperties().
 */
inline void strip_mp4_freeform_properties(const Mp4FreeformMap& items,
                                          TagLib::PropertyMap& propMap)
{
    for (const auto& [name, values] : items) {
        const std::string key = mp4_derived_property_key(name);
        if (!key.empty()) propMap.erase(TagLib::String(key, TagLib::String::UTF8));
    }
}

/**
 * Write every freeform atom under its exact name. Call AFTER
 * file->setProperties(), which will have erased them along with everything else
 * absent from the stripped map.
 */
inline void apply_mp4_freeform_items(TagLib::File* file,
                                     const Mp4FreeformMap& items)
{
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;
    auto* tag = mp4->tag();

    for (const auto& [name, values] : items) {
        const TagLib::String key(name, TagLib::String::UTF8);
        if (values.isEmpty()) tag->removeItem(key);
        else tag->setItem(key, TagLib::MP4::Item(values));
    }
}

#endif  // TAGLIB_MP4_ATOMS_H
