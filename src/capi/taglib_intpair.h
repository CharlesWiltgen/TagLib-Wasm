/**
 * @fileoverview Write-side int-pair merge shared by both backends.
 *
 * ID3v2 TRCK/TPOS and MP4 trkn/disk store a number and its total in ONE field.
 * TagLib's PropertyMap has no separate TRACKTOTAL/DISCTOTAL mapping for those
 * formats, so a caller supplying `track: 3, totalTracks: 12` would otherwise get
 * TRACKNUMBER "3" plus a non-standard TXXX:TRACKTOTAL frame or freeform
 * TRACKTOTAL atom that ordinary players and Apple Music do not read — the total
 * silently disappears from every consumer's view.
 *
 * This is the WRITE side only, and it is not the inverse of a read-side split —
 * there is deliberately no split, because the raw string is canonical and
 * splitting it made the two backends disagree (taglib-asg). Narrowing a pair
 * into number + total is the typed surface's job (src/utils/tag-mapping.ts).
 *
 * Both the WASI shim and the Embind binding must call this before their
 * `File::setProperties`: the merge lived only in the WASI shim, so Emscripten
 * produced a different on-disk file from the same typed input.
 */
#pragma once

#include <tfile.h>
#include <tpropertymap.h>
#include <tstringlist.h>
#include <mpegfile.h>
#include <mp4file.h>

namespace taglib_wasm {

/** Formats whose track/disc number and total share one on-disk field. */
static inline bool uses_intpair_format(TagLib::File* file) {
    return dynamic_cast<TagLib::MP4::File*>(file) ||
           dynamic_cast<TagLib::MPEG::File*>(file);
}

/*!
 * Fold a separate TRACKTOTAL/DISCTOTAL into the number field.
 *
 * Skipped when the number already carries a "/": the caller supplied the pair
 * themselves and it is authoritative, so we must not append a second total.
 */
static inline void merge_intpair_properties(TagLib::PropertyMap& propMap) {
    auto mergePair = [&propMap](const char* numberKey, const char* totalKey) {
        auto totalIt = propMap.find(totalKey);
        if (totalIt == propMap.end() || totalIt->second.isEmpty()) return;

        TagLib::String number = "0";
        auto numIt = propMap.find(numberKey);
        if (numIt != propMap.end() && !numIt->second.isEmpty()) {
            number = numIt->second.front();
            // Already a pair — the raw value wins and the separate total is
            // redundant rather than additional.
            if (number.find("/") != -1) {
                propMap.erase(totalKey);
                return;
            }
        }
        propMap[numberKey] =
            TagLib::StringList(number + "/" + totalIt->second.front());
        propMap.erase(totalKey);
    };
    mergePair("TRACKNUMBER", "TRACKTOTAL");
    mergePair("DISCNUMBER", "DISCTOTAL");
}

} // namespace taglib_wasm
