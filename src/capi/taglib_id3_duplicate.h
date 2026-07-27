#ifndef TAGLIB_ID3_DUPLICATE_H
#define TAGLIB_ID3_DUPLICATE_H

/*!
 * Non-destructive replacement for MPEG::File::save()'s ID3v1<->ID3v2 Duplicate
 * pass (taglib-9m0w).
 *
 * THE DEFECT. ID3v2::Tag::track() narrows the TRCK frame text with
 * String::toInt(), and year() does the same to TDRC's first four characters
 * (id3v2tag.cpp:220-233). A frame holding a vinyl "A1" or a date of "unknown"
 * therefore reads back 0 — indistinguishable from an ABSENT frame.
 * Tag::duplicate(source, target, overwrite=false) acts on exactly that 0
 * (tag.cpp:186-189):
 *
 *     if(target->track() == 0)
 *       target->setTrack(source->track());
 *
 * and ID3v2::Tag::setTrack(0) / setYear(0) are each defined as removeFrames()
 * (id3v2tag.cpp:300-315). So the "fill in what's missing" pass DELETES a value
 * it cannot read. Worse, MPEG::File::read() ends with ID3v1Tag(true)
 * (mpegfile.cpp:511-512), so ID3v1Tag() is never null and the v1 -> v2 half of
 * that pass runs on EVERY MPEG save — including for a file that carries no
 * ID3v1 tag at all, where the empty source makes the call setTrack(0)
 * unconditionally. An ordinary open + save silently dropped the frame.
 *
 * WHY NOT JUST DoNotDuplicate. The escape hatch added for taglib-b67 skips the
 * pass outright, which is right there (a raw UnknownFrame is unreadable to the
 * typed getters, so ANY sync would clobber it) but wrong here: the sync has a
 * legitimate job in both directions, and dropping it would stop populating the
 * ID3v1 tag and stop filling a genuinely absent TRCK from ID3v1. So this
 * reproduces the pass faithfully and skips only the two guards that destroy.
 *
 * Callers run duplicate_id3_tags_losslessly() and then save with
 * DoNotDuplicate, which together are equivalent to a default save minus the
 * data loss. Only the AllTags + StripOthers call shape is reproduced, because
 * that is the only shape this project saves MPEG files with.
 */

#include <id3v1tag.h>
#include <id3v2tag.h>
#include <mpegfile.h>
#include <tag.h>
#include <tstring.h>

namespace taglib_wasm {

/*!
 * True when `frameId` is present with non-empty text but its typed ID3v2 getter
 * reports 0 — the precise condition under which Tag::duplicate's numeric guard
 * mistakes a real value for a missing one. `narrowed` is that getter's answer,
 * passed in so this stays the single definition of "hidden" for both TRCK
 * (track()) and TDRC (year(), which narrows only the first four characters).
 */
inline bool id3v2_value_is_hidden(TagLib::ID3v2::Tag* tag, const char* frameId,
                                  unsigned int narrowed) {
    if (!tag || narrowed != 0) return false;
    const TagLib::ID3v2::FrameList& frames = tag->frameList(frameId);
    if (frames.isEmpty() || !frames.front()) return false;
    return !frames.front()->toString().isEmpty();
}

inline bool id3v2_track_is_hidden(TagLib::ID3v2::Tag* tag) {
    return id3v2_value_is_hidden(tag, "TRCK", tag ? tag->track() : 0);
}

inline bool id3v2_year_is_hidden(TagLib::ID3v2::Tag* tag) {
    return id3v2_value_is_hidden(tag, "TDRC", tag ? tag->year() : 0);
}

/*!
 * True when saving `file` with TagLib's default Duplicate mode would destroy a
 * value. Non-MPEG files are never affected: no other format runs the pass, which
 * is why the same ID3v2 tag survives verbatim inside an AIFF or WAV container.
 */
inline bool id3_duplicate_would_destroy(TagLib::File* file) {
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return false;
    TagLib::ID3v2::Tag* v2 = mpeg->ID3v2Tag();
    return id3v2_track_is_hidden(v2) || id3v2_year_is_hidden(v2);
}

/*!
 * Run the Duplicate pass by hand, skipping only the guards that would delete a
 * hidden value. Mirrors mpegfile.cpp:216-226 and tag.cpp:175-190; the caller
 * must then save with DoNotDuplicate so TagLib does not redo it destructively.
 */
inline void duplicate_id3_tags_losslessly(TagLib::MPEG::File* mpeg) {
    if (!mpeg) return;
    TagLib::ID3v2::Tag* v2 = mpeg->ID3v2Tag(true);
    if (!v2) return;

    // ID3v1 -> ID3v2, the destructive half. Every string field keeps
    // Tag::duplicate's exact "only if the target is empty" semantics.
    if (TagLib::ID3v1::Tag* v1 = mpeg->ID3v1Tag()) {
        if (v2->title().isEmpty()) v2->setTitle(v1->title());
        if (v2->artist().isEmpty()) v2->setArtist(v1->artist());
        if (v2->album().isEmpty()) v2->setAlbum(v1->album());
        if (v2->comment().isEmpty()) v2->setComment(v1->comment());
        if (v2->genre().isEmpty()) v2->setGenre(v1->genre());
        // The two guards that carry the defect. "Reads 0" is kept as the
        // trigger so a genuinely absent frame is still filled in from ID3v1 —
        // only a frame that EXISTS and merely narrows to 0 is now left alone.
        if (v2->year() == 0 && !id3v2_year_is_hidden(v2)) {
            v2->setYear(v1->year());
        }
        if (v2->track() == 0 && !id3v2_track_is_hidden(v2)) {
            v2->setTrack(v1->track());
        }
    }

    // ID3v2 -> ID3v1 needs no such care: ID3v1::Tag stores a year string and a
    // track byte, so its setters can never delete a frame. Creating the tag
    // here matches MPEG::File::save(), which writes an ID3v1 tag on every save.
    TagLib::Tag::duplicate(v2, mpeg->ID3v1Tag(true), false);
}

}  // namespace taglib_wasm

#endif  // TAGLIB_ID3_DUPLICATE_H
