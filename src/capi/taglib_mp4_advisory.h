/*
 * MP4 content advisory bridge (taglib-an30).
 *
 * The native representation on MP4 is the rtng item (0 = no advisory,
 * 1 = explicit, 2 = clean), but TagLib's property map never reports it
 * (mp4itemfactory.cpp namePropertyMap) — so properties() could not see it
 * and setProperty could not write it. Both backends bridge it explicitly:
 * reads surface the rtng value under the same ITUNESADVISORY wire key used
 * everywhere else (native wins over a freeform-derived value); writes apply
 * the value to the rtng item, remove any freeform atom on clear, and
 * suppress the freeform write.
 *
 * The returned map is what setProperties should receive: the advisory key
 * is erased in every case. On MP4 the item operations above already did the
 * work; on every other format an EMPTY list would make ID3v2 create an
 * empty frame (id3v2tag.cpp setProperties), so it is erased to the
 * absence-based removal those formats implement.
 */
#ifndef TAGLIB_MP4_ADVISORY_H
#define TAGLIB_MP4_ADVISORY_H

#include <tfile.h>
#include <tpropertymap.h>
#include <mp4file.h>
#include <mp4tag.h>
#include <mp4item.h>

namespace taglib_wasm {

inline void merge_mp4_rtng_advisory(TagLib::File* file,
                                    TagLib::PropertyMap& props) {
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!mp4) return;
    auto* tag = static_cast<TagLib::MP4::Tag*>(mp4->tag());
    if (!tag || !tag->contains("rtng")) return;
    const int v = tag->item("rtng").toByte();
    props["ITUNESADVISORY"] = TagLib::StringList(TagLib::String::number(v));
}

inline TagLib::PropertyMap normalize_advisory_write(
    TagLib::File* file, const TagLib::PropertyMap& propMap) {
    auto it = propMap.find("ITUNESADVISORY");
    if (it == propMap.end()) return propMap;
    TagLib::PropertyMap effective = propMap;
    if (auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file)) {
        auto* tag = static_cast<TagLib::MP4::Tag*>(mp4->tag());
        if (tag) {
            if (it->second.isEmpty()) {
                tag->removeItem("rtng");
                // Freeform atoms are keyed by their full name in the item
                // map; the bare name would be a silent no-op (taglib-an30
                // review). Removes any third-party ITUNESADVISORY atom.
                tag->removeItem("----:com.apple.iTunes:ITUNESADVISORY");
            } else {
                bool ok = false;
                const int v = it->second.front().toInt(&ok);
                if (ok && v >= 0 && v <= 255) {
                    tag->setItem("rtng",
                                 TagLib::MP4::Item(static_cast<unsigned char>(v)));
                }
            }
        }
        // rtng is the representation on MP4; never write a freeform atom.
        effective.erase("ITUNESADVISORY");
    } else if (it->second.isEmpty()) {
        // Absence is the removal signal on every non-MP4 format; an empty
        // list would make ID3v2 materialize an empty frame (taglib-an30).
        effective.erase("ITUNESADVISORY");
    }
    return effective;
}

}  // namespace taglib_wasm

#endif  // TAGLIB_MP4_ADVISORY_H
