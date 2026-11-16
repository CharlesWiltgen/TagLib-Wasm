/**
 * @fileoverview Typed MP4 freeform (`----:mean:name`) read/write helpers.
 *
 * TagLib's PropertyMap flattens freeform items to strings and drops their
 * AtomDataType, so binary atoms (e.g. Acoustid fingerprints) are corrupted or
 * lost. These helpers keep one entry per data value with its raw bytes and
 * AtomDataType code, shared by both backends (taglib-gja).
 */
#pragma once

#include <mp4atom.h>
#include <mp4file.h>
#include <mp4item.h>
#include <mp4tag.h>
#include <tbytevectorlist.h>
#include <tstringlist.h>

#include <algorithm>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace taglib_wasm {

/** One freeform data value: raw bytes + its AtomDataType code. */
struct MP4FreeformEntry {
    std::string mean;
    std::string name;
    int type = static_cast<int>(TagLib::MP4::TypeUndefined);
    std::string value; // raw bytes; UTF-8 bytes for TypeUTF8
};

/** A captured item for preserving freeforms across a PropertyMap write. */
struct MP4FreeformSnapshot {
    TagLib::String atom;
    TagLib::MP4::Item item;
};

inline bool is_mp4_freeform_atom(const std::string& atom) {
    return atom.compare(0, 5, "----:") == 0;
}

/** Split `----:mean:name`; false when the name is malformed. */
inline bool split_mp4_freeform_atom(const std::string& atom,
                                    std::string& mean,
                                    std::string& name) {
    if (!is_mp4_freeform_atom(atom)) return false;
    const size_t sep = atom.find(':', 5);
    if (sep == std::string::npos) return false;
    mean = atom.substr(5, sep - 5);
    name = atom.substr(sep + 1);
    return !mean.empty() && !name.empty();
}

inline std::string make_mp4_freeform_atom(const std::string& mean,
                                          const std::string& name) {
    return "----:" + mean + ":" + name;
}

/**
 * All freeform values on \a file, one entry per data value. UTF-8 items are
 * emitted as their UTF-8 bytes; every other type as raw bytes. Mixed-type
 * values within one atom are a TagLib limitation; its first type is used.
 */
inline std::vector<MP4FreeformEntry> collect_mp4_freeform_entries(
    TagLib::File* file) {
    std::vector<MP4FreeformEntry> entries;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return entries;

    for (const auto& [atom, item] : mp4->tag()->itemMap()) {
        const std::string atom_name = atom.to8Bit(true);
        std::string mean, name;
        if (!split_mp4_freeform_atom(atom_name, mean, name)) continue;

        int type = static_cast<int>(item.atomDataType());
        if (type == static_cast<int>(TagLib::MP4::TypeUndefined) &&
            item.type() == TagLib::MP4::Item::Type::StringList) {
            // renderFreeForm() infers UTF-8 for an untyped StringList.
            type = static_cast<int>(TagLib::MP4::TypeUTF8);
        }

        if (item.type() == TagLib::MP4::Item::Type::StringList) {
            for (const auto& value : item.toStringList()) {
                entries.push_back({mean, name, type, value.to8Bit(true)});
            }
        } else if (item.type() == TagLib::MP4::Item::Type::ByteVectorList) {
            for (const auto& value : item.toByteVectorList()) {
                entries.push_back(
                    {mean, name, type,
                     std::string(value.data(),
                                 static_cast<size_t>(value.size()))});
            }
        }
    }
    return entries;
}

/** Replace every freeform item with \a entries (empty clears them). */
inline void apply_mp4_freeform_entries(
    TagLib::File* file, const std::vector<MP4FreeformEntry>& entries) {
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;
    auto* tag = mp4->tag();

    std::vector<TagLib::String> existing;
    for (const auto& [atom, item] : tag->itemMap()) {
        if (is_mp4_freeform_atom(atom.to8Bit(true))) existing.push_back(atom);
    }
    for (const auto& atom : existing) tag->removeItem(atom);

    struct Group {
        std::string mean;
        std::string name;
        int type;
        std::vector<std::string> values;
    };
    std::vector<Group> groups;
    for (const auto& entry : entries) {
        auto it = std::find_if(
            groups.begin(), groups.end(), [&](const Group& group) {
                return group.mean == entry.mean && group.name == entry.name &&
                       group.type == entry.type;
            });
        if (it == groups.end()) {
            groups.push_back({entry.mean, entry.name, entry.type,
                              {entry.value}});
        } else {
            it->values.push_back(entry.value);
        }
    }

    for (const auto& group : groups) {
        TagLib::MP4::Item item;
        if (group.type == static_cast<int>(TagLib::MP4::TypeUTF8)) {
            TagLib::StringList values;
            for (const auto& value : group.values) {
                values.append(
                    TagLib::String(value, TagLib::String::UTF8));
            }
            item = TagLib::MP4::Item(values);
        } else {
            TagLib::ByteVectorList values;
            for (const auto& value : group.values) {
                values.append(TagLib::ByteVector(
                    value.data(), static_cast<unsigned int>(value.size())));
            }
            item = TagLib::MP4::Item(values);
        }
        item.setAtomDataType(
            static_cast<TagLib::MP4::AtomDataType>(group.type));
        tag->setItem(
            TagLib::String(make_mp4_freeform_atom(group.mean, group.name),
                           TagLib::String::UTF8),
            item);
    }
}

/** Snapshot every freeform item so a PropertyMap write cannot drop it. */
inline std::vector<MP4FreeformSnapshot> capture_mp4_freeform_items(
    TagLib::File* file) {
    std::vector<MP4FreeformSnapshot> items;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return items;
    for (const auto& [atom, item] : mp4->tag()->itemMap()) {
        if (is_mp4_freeform_atom(atom.to8Bit(true))) {
            items.push_back({atom, item});
        }
    }
    return items;
}

/** Re-add freeform items a PropertyMap write erased (exact names). */
inline void restore_mp4_freeform_items(
    TagLib::File* file,
    const std::vector<MP4FreeformSnapshot>& items) {
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;
    auto* tag = mp4->tag();
    for (const auto& snapshot : items) {
        if (!tag->itemMap().contains(snapshot.atom)) {
            tag->setItem(snapshot.atom, snapshot.item);
            continue;
        }
        // A PropertyMap write materialises freeform items as StringList twins.
        // For a binary/typed atom that shape is a lossy replacement, so the
        // captured typed item wins on a type mismatch (taglib-gja).
        const auto current = tag->item(snapshot.atom);
        if (current.type() != snapshot.item.type()) {
            tag->setItem(snapshot.atom, snapshot.item);
        }
    }
}

} // namespace taglib_wasm
