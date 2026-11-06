/**
 * @fileoverview WASI C++ shim - write half.
 *
 * Decodes the MessagePack snapshot and applies it through the PropertyMap and
 * the format-specific appliers, then saves while preserving ID3v1/ID3v2 data.
 * Split out of taglib_shim.cpp (taglib-1zc.b6d).
 */

#include "taglib_shim.h"
#include "taglib_shim_common.h"
#include "taglib_pictures.h"
#include "taglib_ratings.h"
#include "taglib_chapters.h"
#include "taglib_bwf.h"
#include "taglib_id3_strip.h"
#include "taglib_id3v2_frames.h"
#include "taglib_audio_props.h"
#include "taglib_mp4_atoms.h"
#include "taglib_id3_duplicate.h"
#include "taglib_asf_multi_value.h"
#include "taglib_asf_properties.h"
#include "taglib_mp4_advisory.h"
#include "taglib_mp4_genre.h"
#include "taglib_intpair.h"
#include "core/taglib_msgpack.h"
#include "core/taglib_core.h"

#include <fileref.h>
#include <tag.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <tfilestream.h>
#include <audioproperties.h>
#include <mpegfile.h>
#include <flacfile.h>
#include <mp4file.h>
#include <oggfile.h>
#include <vorbisfile.h>
#include <wavfile.h>
#include <opusfile.h>
#include <aifffile.h>
#include <apefile.h>
#include <wavpackfile.h>
#include <mpcfile.h>
#include <asffile.h>
#include <dsffile.h>
#include <trueaudiofile.h>
#include <oggflacfile.h>
#include <speexfile.h>
#include <dsdifffile.h>
#include <shortenfile.h>
#include <modfile.h>
#include <s3mfile.h>
#include <itfile.h>
#include <xmfile.h>
#include <matroskafile.h>

#include <mpack/mpack.h>

#include <memory>
#include <cstring>
#include <cstdlib>


#include <string>
#include <vector>

// MUST stay sorted (byte-wise strcmp) — this array is binary-searched.
// Audio/derived keys ride the same wire as tags (the WASI read merges them
// into the snapshot) but are never properties: writing them through the
// PropertyMap would materialize junk frames (e.g. TXXX:bitrateMode).
static const char* SKIP_KEYS[] = {
    "bextData", "bitrate", "bitrateMode", "bitsPerSample", "channels",
    "chapters", "codec", "containerFormat", "duration", "formatVersion",
    "id3Tags", "id3v2Frames", "isEncrypted", "isLossless", "ixml", "length",
    // "lyrics" stays skipped: the batch encoder ships the raw structured
    // key and this list keeps it off the PropertyMap (taglib-0mx removed
    // the dead complexProperties path, not this guard).
    "lengthMs", "lyrics", "mpegLayer", "mpegVersion", "outputGainDb",
    "pictures", "ratings", "sampleRate", "track", "year",
};

static const size_t SKIP_KEYS_SIZE = sizeof(SKIP_KEYS) / sizeof(SKIP_KEYS[0]);

static bool should_skip(const char* key) {
    // A full `----:mean:name` key is the foreign-atom read channel
    // (taglib-5ibr). The atom already lives in the file's own bytes; pushing
    // the key through the PropertyMap would re-file it in Apple's namespace
    // under a mangled name. Never a property, whatever its case.
    if (strncmp(key, "----:", 5) == 0) return true;
    // Write-time directives ride `_`-prefixed pseudo-keys (_mp4ChapterStyle,
    // _stripId3, _mp4ItemNames, ...); never properties. Narrow to the
    // `_`+lowercase convention those keys use, so a legitimate user property
    // like an all-uppercase "_FOO" still round-trips (taglib-984r review).
    if (key[0] == '_' && key[1] >= 'a' && key[1] <= 'z') return true;
    int left = 0, right = static_cast<int>(SKIP_KEYS_SIZE) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int cmp = strcmp(key, SKIP_KEYS[mid]);
        if (cmp == 0) return true;
        if (cmp < 0) right = mid - 1;
        else left = mid + 1;
    }
    return false;
}

static const char* map_camel_to_prop(const char* key) {
    for (size_t i = 0; i < FIELD_MAP_SIZE; i++) {
        if (strcmp(key, FIELD_MAP[i].camel) == 0) return FIELD_MAP[i].prop;
    }
    return nullptr;
}

static const uint32_t MAX_STRING_VALUE_LEN = 1024 * 1024;  // 1 MB

static tl_error_code decode_msgpack_to_propmap(
    const uint8_t* data, size_t len, TagLib::PropertyMap& propMap)
{
    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);

    uint32_t count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return TL_ERROR_PARSE_FAILED;
    }

    for (uint32_t i = 0; i < count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        char key[256];
        if (klen >= sizeof(key)) { mpack_reader_destroy(&reader); return TL_ERROR_PARSE_FAILED; }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        key[klen] = '\0';
        if (mpack_reader_error(&reader) != mpack_ok) break;

        if (should_skip(key)) {
            mpack_discard(&reader);
            continue;
        }

        mpack_tag_t tag = mpack_peek_tag(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;

        if (tag.type == mpack_type_array) {
            uint32_t arr_count = mpack_expect_array(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            TagLib::StringList list;
            for (uint32_t j = 0; j < arr_count; j++) {
                uint32_t slen = mpack_expect_str(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;
                char sbuf[4096];
                if (slen < sizeof(sbuf)) {
                    mpack_read_bytes(&reader, sbuf, slen);
                    mpack_done_str(&reader);
                    sbuf[slen] = '\0';
                    list.append(TagLib::String(std::string(sbuf, slen), TagLib::String::UTF8));
                } else if (slen <= MAX_STRING_VALUE_LEN) {
                    char* heap = static_cast<char*>(malloc(slen + 1));
                    if (!heap) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                    mpack_read_bytes(&reader, heap, slen);
                    mpack_done_str(&reader);
                    heap[slen] = '\0';
                    list.append(TagLib::String(std::string(heap, slen), TagLib::String::UTF8));
                    free(heap);
                } else {
                    mpack_reader_destroy(&reader);
                    return TL_ERROR_PARSE_FAILED;
                }
            }
            mpack_done_array(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            if (!list.isEmpty()) {
                const char* mapped = map_camel_to_prop(key);
                if (mapped) {
                    propMap[mapped] = list;
                } else {
                    // Any non-skipped key reaches the PropertyMap verbatim.
                    // Channel/pseudo keys are filtered by should_skip, so
                    // raw lowercase wire names (ASF attributes like
                    // "replaygain_track_gain", Xiph fields) survive the
                    // round-trip — the old uppercase gate dropped them,
                    // which made a no-op save DELETE the attribute
                    // (taglib-984r review).
                    propMap[key] = list;
                }
            } else if (strcmp(key, "ITUNESADVISORY") == 0) {
                // An empty advisory list is the clear signal for MP4's rtng
                // item, which is invisible to the property map (taglib-an30);
                // the generic decoder treats [] as absent, so keep it here.
                propMap[key] = list;
            }
            continue;
        }

        TagLib::String value;
        bool has_value = false;

        if (tag.type == mpack_type_str) {
            uint32_t vlen = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            char vbuf[4096];
            if (vlen < sizeof(vbuf)) {
                mpack_read_bytes(&reader, vbuf, vlen);
                mpack_done_str(&reader);
                vbuf[vlen] = '\0';
                if (vlen > 0) {
                    value = TagLib::String(std::string(vbuf, vlen), TagLib::String::UTF8);
                    has_value = true;
                }
            } else if (vlen <= MAX_STRING_VALUE_LEN) {
                char* heap = static_cast<char*>(malloc(vlen + 1));
                if (!heap) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                mpack_read_bytes(&reader, heap, vlen);
                mpack_done_str(&reader);
                heap[vlen] = '\0';
                value = TagLib::String(std::string(heap, vlen), TagLib::String::UTF8);
                has_value = true;
                free(heap);
            } else {
                mpack_reader_destroy(&reader);
                return TL_ERROR_PARSE_FAILED;
            }
        } else if (tag.type == mpack_type_uint) {
            uint64_t num = mpack_expect_u64(&reader);
            if (num > 0 && num <= INT32_MAX) {
                value = TagLib::String::number(static_cast<int>(num));
                has_value = true;
            }
        } else if (tag.type == mpack_type_int) {
            int64_t num = mpack_expect_i64(&reader);
            if (num != 0 && num >= INT32_MIN && num <= INT32_MAX) {
                value = TagLib::String::number(static_cast<int>(num));
                has_value = true;
            }
        } else if (tag.type == mpack_type_bool) {
            bool bval = mpack_expect_bool(&reader);
            value = TagLib::String(bval ? "1" : "0");
            has_value = true;
        } else {
            mpack_discard(&reader);
            continue;
        }

        if (mpack_reader_error(&reader) != mpack_ok) break;
        if (!has_value) continue;

        const char* mapped = map_camel_to_prop(key);
        if (mapped) {
            propMap[mapped] = TagLib::StringList(value);
        } else {
            // Same verbatim rule as the array branch: should_skip filters
            // channel/pseudo keys, everything else is a real wire name.
            propMap[key] = TagLib::StringList(value);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}

static void apply_propmap(TagLib::File* file, const TagLib::PropertyMap& propMap) {
    // No ID3v1 preservation here any more: the read path now reports ID3v1-only
    // values, so the incoming map already carries them and an absent key means
    // the caller genuinely dropped the field (taglib-nft5). The one exception is
    // the comment, whose merged value must not materialise as a second ID3v2
    // frame (taglib-o3sl).
    const auto commentGuard = taglib_wasm::capture_id3v2_comment_guard(file);

    // Prior properties are read ONLY when an incoming value is empty — see
    // echoesPriorEmpty below. file->properties() walks every frame allocating
    // a String/StringList per frame, so build it lazily on the first empty
    // hit instead of eagerly on every save (taglib-k3vw).

    // MP4 content advisory: apply to the native rtng item before the
    // PropertyMap write, and hand setProperties the effective map (a set
    // suppresses the freeform write; an empty list clears rtng and lets the
    // generic path clear any freeform atom) (taglib-an30).
    const TagLib::PropertyMap effective =
        taglib_wasm::normalize_advisory_write(file, propMap);

    // TagLib ignores untranslated keys for ASF (asftag.cpp:394); write them
    // as real attributes so nothing is silently dropped (taglib-984r).
    const TagLib::PropertyMap ignored = file->setProperties(effective);
    taglib_wasm::apply_asf_properties(file, effective, ignored);

    TagLib::Tag* tag = file->tag();
    if (!tag) return;

    // setProperties() keeps a frame whose projection matches the incoming map
    // (id3v2tag.cpp:450-453), so an unchanged empty value survives it. These
    // typed mirrors would then destroy it anyway — setGenre("") is defined as
    // removeFrames("TCON") — deleting a frame on a save that changed nothing
    // (taglib-yc1x). An empty value equal to what the file already held is a
    // round-trip echo, not an instruction, so the mirror is skipped.
    //
    // Note this needs no knowledge of caller intent: it compares against the
    // FILE, which is why it can live here and could not live in
    // normalizeTagInput, where the earlier attempt put it.
    // Why sampling AFTER setProperties is safe here (reviewed 2026-08-10):
    // a clear (incoming [""] over a stored non-empty value) deletes the old
    // frame and does NOT materialize an empty replacement on this TagLib
    // build — ID3v2 renders drop empty text frames, so the post-write read
    // sees the frame absent and the echo check correctly returns false
    // (measured: setProperties({genre:[""]}) removes TCON outright). The
    // only case the echo check must skip is a frame that already WAS empty
    // pre-write, which setProperties leaves untouched — identical before
    // and after the call. Lazy sampling is therefore behavior-neutral while
    // keeping the k3vw win for the common save.
    struct PriorCache {
        bool built = false;
        TagLib::PropertyMap map;
    } prior;
    auto echoesPriorEmpty = [&prior, file](const char* key,
                                           const TagLib::String& incoming) {
        if (!incoming.isEmpty()) return false;
        if (!prior.built) {
            // Merged exactly as the read path builds the snapshot
            // (taglib_read.cpp encode_file_to_msgpack) — otherwise an ID3v1-only value would look
            // changed here when the caller never touched it.
            prior.map = file->properties();
            taglib_wasm::merge_id3v1_only_properties(file, prior.map);
            prior.built = true;
        }
        auto p = prior.map.find(key);
        return p != prior.map.end() && p->second.size() == 1 &&
               p->second.front().isEmpty();
    };

    // Table-driven mirrors (taglib-hahs): each block used to repeat its key
    // literal twice — a wrong key in one call compiled, passed every test,
    // and silently reinstated the data-loss bug for one field. One table,
    // iterated once, has no second spelling to drift.
    struct Mirror {
        const char* key;
        void (TagLib::Tag::*setter)(const TagLib::String&);
    };
    static constexpr Mirror MIRRORS[] = {
        {"TITLE", &TagLib::Tag::setTitle},
        {"ARTIST", &TagLib::Tag::setArtist},
        {"ALBUM", &TagLib::Tag::setAlbum},
        {"COMMENT", &TagLib::Tag::setComment},
        {"GENRE", &TagLib::Tag::setGenre},
    };
    for (const auto& m : MIRRORS) {
        auto it = propMap.find(m.key);
        if (it != propMap.end() && it->second.size() == 1 &&
            !echoesPriorEmpty(m.key, it->second.front())) {
            (tag->*m.setter)(it->second.front());
        }
    }

    // LAST, and the ordering is load-bearing. ID3v2::Tag::setComment prefers a
    // bare frame and FALLS BACK to comments.front()->setText() when there is
    // none (id3v2tag.cpp:265). Withdrawing the bare frame before the COMMENT
    // mirror ran therefore aimed that mirror at the DESCRIBED frame and
    // overwrote its payload — an iTunes Sound Check value destroyed by a save
    // that changed nothing. Running after leaves the mirror a bare frame to
    // write to, and only then is it taken away again.
    taglib_wasm::apply_id3v2_comment_guard(file, commentGuard);
    // NOTE: DATE is intentionally NOT mirrored to tag->setYear() here.
    // file->setProperties() above already wrote the full DATE string; calling
    // setYear(front().toInt()) would truncate "1975-10-31" back to 1975 and
    // overwrite it (taglib-bk7 / GitHub #23).
    //
    // TRACKNUMBER is omitted for exactly the same reason (taglib-qpl):
    // setTrack(front().toInt()) would rewrite a "3/12" or "03" that
    // setProperties() just stored correctly as a bare "3".
}

/*!
 * Exact MP4 atom names the JS layer is creating this save, sent under the
 * reserved "_mp4ItemNames" key (setMP4Item's argument, or the canonical atom
 * name from the PROPERTIES table for a typed property). A name that is not yet
 * on disk cannot be captured from the file, so the caller has to supply it —
 * see taglib_mp4_atoms.h (taglib-bnhl).
 */
static std::vector<std::string> read_mp4_key_list(const uint8_t* data, size_t len,
                                                  const char* want)
{
    std::vector<std::string> names;
    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);
    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return names;
    }

    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        char key[64];
        if (klen >= sizeof(key)) {
            // A key too long to be ours: SKIP it and keep scanning. Breaking out
            // here abandoned the rest of the map, so one long user property key
            // encoded before "_mp4ItemNames" silently reverted the atom-casing
            // fix with no error (taglib-bnhl review).
            mpack_skip_bytes(&reader, klen);
            mpack_done_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            mpack_discard(&reader);
            continue;
        }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        key[klen] = '\0';

        if (strcmp(key, want) != 0) {
            mpack_discard(&reader);
            continue;
        }

        uint32_t count = mpack_expect_array(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        for (uint32_t j = 0; j < count; j++) {
            uint32_t nlen = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            if (nlen > 512) { mpack_skip_bytes(&reader, nlen); mpack_done_str(&reader); continue; }
            char nbuf[513];
            mpack_read_bytes(&reader, nbuf, nlen);
            mpack_done_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            nbuf[nlen] = '\0';
            names.push_back(std::string(nbuf));
        }
        mpack_done_array(&reader);
        break;
    }

    mpack_reader_destroy(&reader);
    return names;
}

static std::vector<std::string> read_mp4_item_names(const uint8_t* data, size_t len)
{
    return read_mp4_key_list(data, len, "_mp4ItemNames");
}

/*! Foreign-mean atom deletions queued by removeMP4Item (taglib-65nm). */
static std::vector<std::string> read_mp4_item_removals(const uint8_t* data, size_t len)
{
    return read_mp4_key_list(data, len, "_mp4ItemRemovals");
}

/*!
 * Save `file`, keeping MPEG's ID3v1<->ID3v2 sync from destroying tag data.
 *
 * Two distinct cases need the DoNotDuplicate save mode, and they are NOT
 * interchangeable:
 *
 *  - taglib-b67 (`raw_frames_written`): a raw write to an ID3v1-mapped frame ID
 *    must skip the sync ENTIRELY. An UnknownFrame is unreadable to Tag's typed
 *    getters, so any sync — including the lossless one below — reads "" and
 *    clobbers the raw bytes.
 *  - taglib-9m0w: a TRCK/TDRC that merely narrows to 0 ("A1", "unknown") is
 *    deleted by TagLib's pass, so we run an equivalent pass ourselves first and
 *    then suppress TagLib's. Skipping it outright would be wrong here — the sync
 *    still has a job in both directions.
 */
static bool save_preserving_id3(TagLib::File* file, bool raw_frames_written) {
    // ASF multi-value attributes are rotated by TagLib's render+parse
    // (ECDO/MLO split); right-rotate before render, restore after save
    // (taglib-ilrg). Inert for every other format.
    taglib_wasm::ASFMultiValueRotationGuard asfGuard(file);
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return file->save();

    bool skip_taglib_duplicate = raw_frames_written;
    if (!skip_taglib_duplicate && taglib_wasm::id3_duplicate_would_destroy(mpeg)) {
        taglib_wasm::duplicate_id3_tags_losslessly(mpeg);
        skip_taglib_duplicate = true;
    }
    if (!skip_taglib_duplicate) return file->save();

    return mpeg->save(TagLib::MPEG::File::AllTags, TagLib::File::StripOthers,
                      TagLib::ID3v2::v4, TagLib::File::DoNotDuplicate);
}

static tl_error_code write_to_path(const char* path,
                                   const uint8_t* tags_msgpack, size_t tags_msgpack_len) {
    try {
        TagLib::PropertyMap propMap;
        tl_error_code rc = decode_msgpack_to_propmap(tags_msgpack, tags_msgpack_len, propMap);
        if (rc != TL_SUCCESS) return rc;

        TagLib::FileRef ref(path);
        if (ref.isNull() || !ref.tag()) return TL_ERROR_IO_WRITE;

        if (taglib_wasm::uses_intpair_format(ref.file())) {
            taglib_wasm::merge_intpair_properties(propMap);
        }
        // Snapshot the real freeform atom names off the file BEFORE the
        // PropertyMap write mangles their casing, add the names JS is creating,
        // and repair afterwards (taglib-bnhl).
        auto mp4_names = capture_mp4_freeform_names(ref.file());
        for (auto& n : read_mp4_item_names(tags_msgpack, tags_msgpack_len)) {
            mp4_names.push_back(std::move(n));
        }
        // Foreign-mean atom deletions queued by removeMP4Item: the PropertyMap
        // cannot express them, so delete them here (taglib-65nm).
        apply_mp4_item_removals(ref.file(),
                                read_mp4_item_removals(tags_msgpack,
                                                       tags_msgpack_len));
        apply_propmap(ref.file(), propMap);
        restore_mp4_freeform_names(ref.file(), mp4_names);
        apply_pictures_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_chapters_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_bwf_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_id3_strip_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        // Raw id3v2Frames apply runs after propmap/strip so a raw write always
        // wins over a same-save typed write to the same ID (see I3 spec note).
        bool needs_no_duplicate = false;
        apply_id3v2_frames_from_msgpack(ref.file(), tags_msgpack,
                                         tags_msgpack_len, &needs_no_duplicate);

        if (!save_preserving_id3(ref.file(), needs_no_duplicate)) {
            return TL_ERROR_IO_WRITE;
        }
        return TL_SUCCESS;
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

static tl_error_code write_to_buffer(const uint8_t* buf, size_t len,
                                     const uint8_t* tags_msgpack, size_t tags_msgpack_len,
                                     uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::PropertyMap propMap;
        tl_error_code rc = decode_msgpack_to_propmap(tags_msgpack, tags_msgpack_len, propMap);
        if (rc != TL_SUCCESS) return rc;

        TagLib::ByteVectorStream stream(
            TagLib::ByteVector(reinterpret_cast<const char*>(buf),
                               static_cast<unsigned int>(len)));

        tl_format format = tl_detect_format(buf, len);
        std::unique_ptr<TagLib::File> file(create_file_for_format(format, &stream));
        TagLib::FileRef ref_fallback;
        TagLib::File* f = nullptr;

        if (file && file->isValid() && file->tag()) {
            f = file.get();
        } else {
            file.reset();
            ref_fallback = TagLib::FileRef(&stream);
            if (ref_fallback.isNull() || !ref_fallback.tag()) return TL_ERROR_PARSE_FAILED;
            f = ref_fallback.file();
        }

        if (taglib_wasm::uses_intpair_format(f)) {
            taglib_wasm::merge_intpair_properties(propMap);
        }
        // See write_to_path: capture before, restore after (taglib-bnhl).
        auto mp4_names = capture_mp4_freeform_names(f);
        for (auto& n : read_mp4_item_names(tags_msgpack, tags_msgpack_len)) {
            mp4_names.push_back(std::move(n));
        }
        // Foreign-mean atom deletions queued by removeMP4Item (taglib-65nm).
        apply_mp4_item_removals(f, read_mp4_item_removals(tags_msgpack,
                                                          tags_msgpack_len));
        apply_propmap(f, propMap);
        restore_mp4_freeform_names(f, mp4_names);
        apply_pictures_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_chapters_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_bwf_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_id3_strip_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        // Raw id3v2Frames apply runs after propmap/strip so a raw write always
        // wins over a same-save typed write to the same ID (see I3 spec note).
        bool needs_no_duplicate = false;
        apply_id3v2_frames_from_msgpack(f, tags_msgpack, tags_msgpack_len,
                                         &needs_no_duplicate);

        if (!save_preserving_id3(f, needs_no_duplicate)) return TL_ERROR_IO_WRITE;

        const TagLib::ByteVector* result = stream.data();
        *out_size = result->size();
        *out_buf = (uint8_t*)malloc(result->size());
        if (!*out_buf) return TL_ERROR_MEMORY_ALLOCATION;
        memcpy(*out_buf, result->data(), result->size());
        return TL_SUCCESS;
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

extern "C" {

tl_error_code taglib_write_shim(const char* path, const uint8_t* buf, size_t len,
                                const uint8_t* tags_msgpack, size_t tags_msgpack_len,
                                uint8_t** out_buf, size_t* out_size) {
    if (!tags_msgpack || tags_msgpack_len == 0) {
        return TL_ERROR_INVALID_INPUT;
    }

    if (path && path[0] != '\0') {
        return write_to_path(path, tags_msgpack, tags_msgpack_len);
    } else if (buf && len > 0) {
        if (!out_buf || !out_size) return TL_ERROR_INVALID_INPUT;
        *out_buf = nullptr;
        *out_size = 0;
        return write_to_buffer(buf, len, tags_msgpack, tags_msgpack_len, out_buf, out_size);
    } else {
        return TL_ERROR_INVALID_INPUT;
    }
}

} // extern "C"
