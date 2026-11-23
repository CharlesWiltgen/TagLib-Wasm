/**
 * @fileoverview Exact-name MP4 item read/write helpers (taglib-5y0s).
 *
 * The PropertyMap can only express atoms TagLib maps to a property key; any
 * other 4CC is filed as an Apple freeform twin (`----:com.apple.iTunes:NAME`,
 * uppercased) instead of the atom the caller named. The WASI snapshot carries
 * a lower-case-keyed directive (`_mp4ItemValues`) for those raw writes, and a
 * read map (`_mp4Items`) so `getMP4Item()` can return them after a reopen.
 * Emscripten's live item API handles the same names directly.
 */
#pragma once

#include <mp4atom.h>
#include <mp4file.h>
#include <mp4item.h>
#include <mp4itemfactory.h>
#include <mp4tag.h>
#include <tstringlist.h>

#include <cstdlib>
#include <string>
#include <utility>
#include <vector>

namespace taglib_wasm {

/** One exact-name MP4 item: the atom 4CC and its string form. */
struct MP4ItemValue {
    std::string name;
    std::string value;
};

/** The string form `getMP4Item()` reports, mirroring the Embind getter. */
inline std::string mp4_item_value_string(const TagLib::MP4::Item& item) {
    switch (item.type()) {
        case TagLib::MP4::Item::Type::Int:
            return std::to_string(item.toInt());
        case TagLib::MP4::Item::Type::StringList:
            return item.toStringList().isEmpty()
                       ? std::string()
                       : item.toStringList().front().to8Bit(true);
        case TagLib::MP4::Item::Type::Bool:
            return item.toBool() ? "true" : "false";
        case TagLib::MP4::Item::Type::Byte:
            return std::to_string(item.toByte());
        default:
            // Freeform atoms use the typed channel; pairs, covers and UInt
            // have no string form (the Embind getter returns "" for them).
            return std::string();
    }
}

/** Raw (non-freeform) items for the read snapshot, keyed by exact atom name. */
inline std::vector<MP4ItemValue> collect_mp4_item_values(TagLib::File* file) {
    std::vector<MP4ItemValue> items;
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return items;

    for (const auto& [atom, item] : mp4->tag()->itemMap()) {
        const std::string name = atom.to8Bit(true);
        if (name.compare(0, 5, "----:") == 0) continue;  // typed channel owns these
        std::string value = mp4_item_value_string(item);
        if (!value.empty()) items.push_back({name, std::move(value)});
    }
    return items;
}

/**
 * TagLib's item factory keys a handler by the atom's RAW bytes; the Embind
 * setter uses the same probe to decide Int vs text. A raw item write must
 * choose the representation the atom actually takes, not guess from the value.
 */
class MP4ItemTypeProbe : public TagLib::MP4::ItemFactory {
public:
    bool storedAsInt(const TagLib::String& name) const {
        switch (handlerTypeForName(name.data(TagLib::String::Latin1))) {
            case ItemHandlerType::Bool:
            case ItemHandlerType::Int:
            case ItemHandlerType::UInt:
            case ItemHandlerType::LongLong:
            case ItemHandlerType::Byte:
            case ItemHandlerType::Gnre:
                return true;
            default:
                return false;
        }
    }
};

/** Apply exact-name raw item writes (and empty-value removals) at save. */
inline void apply_mp4_item_values(
    TagLib::File* file, const std::vector<MP4ItemValue>& values) {
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4 || !mp4->tag()) return;

    static const MP4ItemTypeProbe probe;
    for (const auto& entry : values) {
        TagLib::String atom(entry.name, TagLib::String::UTF8);
        if (entry.value.empty()) {
            mp4->tag()->removeItem(atom);
            continue;
        }
        char* end = nullptr;
        const long number = std::strtol(entry.value.c_str(), &end, 10);
        if (end != nullptr && *end == '\0' && probe.storedAsInt(atom)) {
            mp4->tag()->setItem(
                atom, TagLib::MP4::Item(static_cast<int>(number)));
        } else {
            mp4->tag()->setItem(
                atom, TagLib::MP4::Item(
                          TagLib::String(entry.value, TagLib::String::UTF8)));
        }
    }
}

}  // namespace taglib_wasm
