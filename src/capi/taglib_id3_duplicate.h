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
#include <commentsframe.h>
#include <mpegfile.h>
#include <tag.h>
#include <tpropertymap.h>
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
 * TCON hides the same way, for a different reason: ID3v2::Tag::genre() maps a
 * purely numeric field through ID3v1::genre(n) (id3v2tag.cpp:200-217), and that
 * answers "" for any index outside the ID3v1 genre list. So a TCON of "255"
 * reads back empty while the frame is plainly present, and Tag::duplicate's
 * `if(target->genre().isEmpty())` guard then calls setGenre(""), which
 * id3v2tag.cpp:274-279 defines as removeFrames("TCON"). The value narrows to an
 * empty STRING rather than to zero, so it needs its own test.
 */
inline bool id3v2_genre_is_hidden(TagLib::ID3v2::Tag* tag) {
    if (!tag || !tag->genre().isEmpty()) return false;
    const TagLib::ID3v2::FrameList& frames = tag->frameList("TCON");
    if (frames.isEmpty() || !frames.front()) return false;
    return !frames.front()->toString().isEmpty();
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
    return id3v2_track_is_hidden(v2) || id3v2_year_is_hidden(v2) ||
           id3v2_genre_is_hidden(v2);
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
        if (v2->genre().isEmpty() && !id3v2_genre_is_hidden(v2)) {
            v2->setGenre(v1->genre());
        }
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

/*!
 * Surface ID3v1 values that ID3v2 does not carry (taglib-nft5).
 *
 * MPEG::File::properties() delegates to TagUnion::properties()
 * (tagunion.cpp:108-114), which returns the FIRST non-empty tag's map — ID3v2 —
 * and never merges ID3v1. So a value living only in ID3v1 was invisible, and
 * every defect in this area followed from that one fact: the declarative save
 * could not carry what it could not see, so it erased it; preserving it down in
 * C++ instead then made a deliberate clear inexpressible, because clearTags()
 * builds its map from properties() and so could never name the field it needed
 * to remove, and the value came back as a ghost in ID3v2.
 *
 * Reporting it on READ settles both directions at once. A round-trip now
 * carries the value like any other property, so no write-side preservation is
 * needed; and a clear can finally address it, because it is in the map the
 * caller enumerates. ID3v2 stays authoritative — this only fills gaps.
 */
inline void merge_id3v1_only_properties(TagLib::File* file,
                                        TagLib::PropertyMap& props) {
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return;
    TagLib::ID3v1::Tag* v1 = mpeg->ID3v1Tag();
    if (!v1 || v1->isEmpty()) return;

    auto fill = [&props](const char* key, const TagLib::String& value) {
        if (value.isEmpty()) return;
        auto it = props.find(key);
        if (it != props.end() && !it->second.isEmpty()) return;
        props[key] = TagLib::StringList(value);
    };

    fill("TITLE", v1->title());
    fill("ARTIST", v1->artist());
    fill("ALBUM", v1->album());
    // COMMENT is deliberately merged the same way as every other key, even
    // though CommentsFrame keys a DESCRIBED frame as "COMMENT:<DESC>" so a file
    // whose only COMM carries a description reads as commentless here and would
    // gain a second, bare COMM on write. Suppressing the merge when any COMM
    // exists was tried (8cb65a0f) and REVERTED: withholding the value from the
    // map makes MPEG::File::setProperties clear ID3v1's comment, which
    // duplicate_id3_tags_losslessly then backfills from the described frame —
    // so a no-op save DESTROYED the ID3v1 comment. The fix lives on the write
    // side instead: every property-write site wraps setProperties in
    // capture_id3v2_comment_guard/apply_id3v2_comment_guard below, which
    // withdraws the frame this merged value would otherwise materialise
    // (taglib-o3sl).
    fill("COMMENT", v1->comment());
    fill("GENRE", v1->genre());
    if (v1->year() != 0) fill("DATE", TagLib::String::number(v1->year()));
    if (v1->track() != 0) {
        fill("TRACKNUMBER", TagLib::String::number(v1->track()));
    }
}

/*!
 * ID3v2's bare (empty-description) COMM frame text, and whether one exists.
 * CommentsFrame keys a DESCRIBED frame as "COMMENT:<DESC>", so only the bare
 * frame corresponds to the plain COMMENT property key.
 */
inline bool id3v2_bare_comment(TagLib::ID3v2::Tag* tag, TagLib::String* text) {
    if (!tag) return false;
    for (const auto& frame : tag->frameList("COMM")) {
        auto* comm = dynamic_cast<TagLib::ID3v2::CommentsFrame*>(frame);
        if (!comm || !comm->description().isEmpty()) continue;
        if (text) *text = comm->toString();
        return true;
    }
    return false;
}

/*! True when ID3v2 carries a COMM frame that has a description. */
inline bool id3v2_has_described_comment(TagLib::ID3v2::Tag* tag) {
    if (!tag) return false;
    for (const auto& frame : tag->frameList("COMM")) {
        auto* comm = dynamic_cast<TagLib::ID3v2::CommentsFrame*>(frame);
        if (comm && !comm->description().isEmpty()) return true;
    }
    return false;
}

/*!
 * State needed to undo a COMM frame that exists only because the property map
 * had to carry ID3v1's comment (taglib-o3sl).
 *
 * When ID3v2's only comment frames are DESCRIBED — the usual iTunes shape —
 * the map has no bare COMMENT key, so merge_id3v1_only_properties fills it from
 * ID3v1. The map must carry it: ID3v1's own comment is written from that same
 * map, and withholding it CLEARS ID3v1, which is why suppressing the merge was
 * tried and reverted. But ID3v2 should not gain a second frame for a value that
 * was never its own, so the frame is removed again afterwards — and only when it
 * is provably that value, never a comment the caller actually set.
 */
struct Id3v2CommentGuard {
    bool active = false;
    TagLib::String id3v1Comment;
};

inline Id3v2CommentGuard capture_id3v2_comment_guard(TagLib::File* file) {
    Id3v2CommentGuard guard;
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return guard;
    TagLib::ID3v2::Tag* v2 = mpeg->ID3v2Tag();
    TagLib::ID3v1::Tag* v1 = mpeg->ID3v1Tag();
    if (!v2 || !v1) return guard;
    // Only when a described frame exists, no bare frame does, and ID3v1 has a
    // comment to have been merged in the first place.
    if (!id3v2_has_described_comment(v2)) return guard;
    if (id3v2_bare_comment(v2, nullptr)) return guard;
    if (v1->comment().isEmpty()) return guard;
    guard.active = true;
    guard.id3v1Comment = v1->comment();
    return guard;
}

inline void apply_id3v2_comment_guard(TagLib::File* file,
                                      const Id3v2CommentGuard& guard) {
    if (!guard.active) return;
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return;
    TagLib::ID3v2::Tag* v2 = mpeg->ID3v2Tag();
    TagLib::String text;
    if (!id3v2_bare_comment(v2, &text)) return;
    // A caller who set a DIFFERENT comment gets to keep it; only the value that
    // came from ID3v1 is withdrawn.
    if (text != guard.id3v1Comment) return;
    for (const auto& frame : v2->frameList("COMM")) {
        auto* comm = dynamic_cast<TagLib::ID3v2::CommentsFrame*>(frame);
        if (comm && comm->description().isEmpty()) {
            v2->removeFrame(comm);
            break;
        }
    }
}

}  // namespace taglib_wasm

#endif  // TAGLIB_ID3_DUPLICATE_H
