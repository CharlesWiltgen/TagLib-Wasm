/**
 * @fileoverview C++ Shim Layer - Real TagLib implementation for WASI
 *
 * This file bridges the pure C boundary to TagLib's C++ API.
 * Uses FileRef for automatic format detection and dispatch.
 * Compiled with -fwasm-exceptions for proper exception handling.
 *
 * Requires an EH-enabled WASI sysroot (libc++abi + libunwind built with
 * -fwasm-exceptions). Without it, FileRef's dynamic_cast crashes with
 * call_indirect type mismatch (mixed EH/non-EH function table entries).
 */

#include "taglib_shim.h"
#include "taglib_pictures.h"
#include "taglib_ratings.h"
#include "taglib_lyrics.h"
#include "taglib_chapters.h"
#include "taglib_bwf.h"
#include "taglib_id3_strip.h"
#include "taglib_id3v2_frames.h"
#include "taglib_audio_props.h"
#include "taglib_mp4_atoms.h"
#include "taglib_id3_duplicate.h"
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

// The PropertyMap surface is the RAW text surface: every text property crosses
// the wire as the string TagLib holds, so "03" and "3/12" survive intact
// (taglib-qpl). Numeric narrowing belongs to the typed surfaces and happens in
// JS — `mapPropertiesToExtendedTag` (src/utils/tag-mapping.ts) for readTags(),
// and the `track`/`year` mirrors below for tag(). There is deliberately NO
// numeric field type here: encoding a track as an int discards the original
// string irrecoverably, and on formats with no int-pair split (FLAC/Ogg/WAV)
// that silently destroyed the total on a read-modify-write.
enum FieldType : uint8_t {
    FIELD_STRING  = 0,
    FIELD_BOOLEAN = 1,
};

struct FieldMapping {
    const char* prop;   // UPPERCASE TagLib property key (sorted for binary search)
    const char* camel;  // camelCase JS key
    FieldType type;     // how to encode/decode the value
};

static const FieldMapping FIELD_MAP[] = {
    {"ACOUSTID_FINGERPRINT", "acoustidFingerprint", FIELD_STRING},
    {"ACOUSTID_ID",          "acoustidId",          FIELD_STRING},
    {"ALBUM",                "album",               FIELD_STRING},
    {"ALBUMARTIST",          "albumArtist",          FIELD_STRING},
    {"ALBUMSORT",            "albumSort",            FIELD_STRING},
    {"ARTIST",               "artist",              FIELD_STRING},
    {"ARTISTSORT",           "artistSort",           FIELD_STRING},
    {"BPM",                  "bpm",                 FIELD_STRING},
    {"COMMENT",              "comment",             FIELD_STRING},
    {"COMPILATION",          "compilation",          FIELD_BOOLEAN},
    {"COMPOSER",             "composer",            FIELD_STRING},
    {"CONDUCTOR",            "conductor",           FIELD_STRING},
    {"COPYRIGHT",            "copyright",           FIELD_STRING},
    {"DATE",                 "date",                FIELD_STRING},
    {"DISCNUMBER",           "discNumber",          FIELD_STRING},
    {"DISCTOTAL",            "totalDiscs",          FIELD_STRING},
    {"ENCODEDBY",            "encodedBy",           FIELD_STRING},
    {"GENRE",                "genre",               FIELD_STRING},
    {"ISRC",                 "isrc",                FIELD_STRING},
    {"LYRICIST",             "lyricist",            FIELD_STRING},
    {"MUSICBRAINZ_ALBUMID",  "musicbrainzReleaseId",     FIELD_STRING},
    {"MUSICBRAINZ_ARTISTID", "musicbrainzArtistId",      FIELD_STRING},
    {"MUSICBRAINZ_RELEASEGROUPID", "musicbrainzReleaseGroupId", FIELD_STRING},
    {"MUSICBRAINZ_TRACKID",  "musicbrainzTrackId",       FIELD_STRING},
    {"REPLAYGAIN_ALBUM_GAIN", "replayGainAlbumGain",     FIELD_STRING},
    {"REPLAYGAIN_ALBUM_PEAK", "replayGainAlbumPeak",     FIELD_STRING},
    {"REPLAYGAIN_TRACK_GAIN", "replayGainTrackGain",     FIELD_STRING},
    {"REPLAYGAIN_TRACK_PEAK", "replayGainTrackPeak",     FIELD_STRING},
    {"TITLE",                "title",               FIELD_STRING},
    {"TITLESORT",            "titleSort",            FIELD_STRING},
    // camel is "trackNumber", NOT "track": "track" is the numeric tag()-surface
    // mirror emitted separately below, and keeping the names distinct is what
    // lets the raw string and the narrowed int coexist (same shape as
    // DATE/"date" + "year"). It also makes map_camel_to_prop("track") return
    // null, so the mirror is correctly ignored on the write path.
    {"TRACKNUMBER",          "trackNumber",         FIELD_STRING},
    {"TRACKTOTAL",           "totalTracks",         FIELD_STRING},
};

static const size_t FIELD_MAP_SIZE = sizeof(FIELD_MAP) / sizeof(FIELD_MAP[0]);

static const FieldMapping* find_by_prop(const char* key) {
    int left = 0, right = static_cast<int>(FIELD_MAP_SIZE) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int cmp = strcmp(key, FIELD_MAP[mid].prop);
        if (cmp == 0) return &FIELD_MAP[mid];
        if (cmp < 0) right = mid - 1;
        else left = mid + 1;
    }
    return nullptr;
}

static void write_mpack_string(mpack_writer_t* w, const TagLib::String& s) {
    std::string utf8 = s.to8Bit(true);
    mpack_write_str(w, utf8.c_str(), static_cast<uint32_t>(utf8.size()));
}

// NOTE: there is deliberately no int-pair split/merge here any more.
//
// The shim used to rewrite an "n/total" TRACKNUMBER into TRACKNUMBER + TRACKTOTAL
// on read for MPEG/MP4 and merge it back on write. Emscripten never did, so the
// SAME FILE reported trackNumber "3" + totalTracks 12 on one backend and "3/12"
// on the other — and once the raw string became a public typed field, the same
// input produced different FILES per backend (taglib-asg, taglib-febo).
//
// The raw string is now canonical everywhere: the PropertyMap crosses this layer
// untouched and TagLib decides how to store it, so both backends agree by
// construction rather than by us keeping two transformations in sync. Narrowing
// a pair into number + total is the typed surface's job and happens in
// src/utils/tag-mapping.ts, where it is additive and cannot destroy the raw value.

static bool uses_intpair_format(TagLib::File* file) {
    return dynamic_cast<TagLib::MP4::File*>(file) ||
           dynamic_cast<TagLib::MPEG::File*>(file);
}

/*!
 * Fold a separate TRACKTOTAL/DISCTOTAL into the number field for formats that
 * store the pair in ONE field: ID3v2 TRCK/TPOS and MP4 trkn/disk.
 *
 * This is the WRITE side only, and it is not the inverse of a read-side split —
 * there is deliberately no split any more, because the raw string is canonical
 * and splitting it made the two backends disagree (taglib-asg). What this does is
 * decide where a caller's SEPARATE number and total get stored. Without it they
 * land in a non-standard TXXX:TRACKTOTAL frame or a freeform TRACKTOTAL atom that
 * ordinary players and Apple Music do not read, so the total silently disappears
 * from every consumer's view.
 *
 * Skipped when the number already carries a "/": the caller supplied the pair
 * themselves and it is authoritative, so we must not append a second total.
 */
static void merge_intpair_properties(TagLib::PropertyMap& propMap) {
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

static tl_error_code encode_file_to_msgpack(TagLib::File* file,
                                            uint8_t** out_buf, size_t* out_size) {
    TagLib::PropertyMap props = file->properties();
    // TagUnion reports ID3v2's map alone, so an MP3 value living only in ID3v1
    // would be invisible here — and therefore absent from the snapshot the save
    // path writes back, which erased it (taglib-nft5).
    taglib_wasm::merge_id3v1_only_properties(file, props);
    TagLib::AudioProperties* audio = file->audioProperties();

    uint32_t count = 0;
    for (auto it = props.begin(); it != props.end(); ++it) {
        if (!it->second.isEmpty()) count++;
    }
    if (audio) count += 5;

    uint32_t pic_count = count_pictures(file);
    if (pic_count > 0) count++;  // "pictures" key + array

    uint32_t rating_count = count_ratings(file);
    if (rating_count > 0) count++;  // "ratings" key + array

    uint32_t lyrics_count = count_lyrics(file);
    if (lyrics_count > 0) count++;  // "lyrics" key + array

    uint32_t chapter_count = count_chapters(file);
    if (chapter_count > 0) count++;  // "chapters" key + array

    uint32_t bwf_keys = count_bwf_keys(file);
    count += bwf_keys;  // "bextData" and/or "ixml" keys (WAV/FLAC)

    uint32_t id3_strip_keys = count_id3_strip_keys(file);
    count += id3_strip_keys;  // "id3Tags" key (FLAC with ID3 attached)

    // DATE and TRACKNUMBER cross the wire as their raw strings ("1975-10-31",
    // "3/12"). Each also gets a numeric mirror so Tag.year / tag().track and the
    // fast-read path keep getting a number without re-parsing; the leading
    // integer is exactly what those surfaces promise. Guarded on a parseable,
    // non-zero value.
    //
    // Resolved ONCE here and reused when writing below: looking the keys up
    // again in the write phase both repeated the map traversal and let the two
    // phases drift, which would desync mpack_start_map(count) from the keys
    // actually written and corrupt the stream (taglib-iyfr).
    struct NumericMirror {
        const char* prop_key;   // uppercase PropertyMap key holding the raw value
        const char* out_key;    // camelCase mirror key on the wire
        int value;              // narrowed value, only valid when emit is true
        bool emit;
    };
    NumericMirror mirrors[] = {
        {"DATE", "year", 0, false},
        {"TRACKNUMBER", "track", 0, false},
    };
    for (auto& mirror : mirrors) {
        auto it = props.find(mirror.prop_key);
        if (it == props.end() || it->second.isEmpty()) continue;
        const int narrowed = it->second.front().toInt();
        if (narrowed <= 0) continue;
        mirror.value = narrowed;
        mirror.emit = true;
        count++;
    }

    ExtendedAudioInfo ext_info = {0, "", "", false, 0, 0, false, 0, nullptr};
    if (audio) {
        ext_info = get_extended_audio_info(file, audio);
        count += count_extended_audio_fields(ext_info);
    }

    mpack_writer_t writer;
    char* data = nullptr;
    size_t size = 0;
    mpack_writer_init_growable(&writer, &data, &size);
    mpack_start_map(&writer, count);

    for (auto it = props.begin(); it != props.end(); ++it) {
        if (it->second.isEmpty()) continue;

        std::string propKey = it->first.to8Bit(true);
        const FieldMapping* mapping = find_by_prop(propKey.c_str());
        const char* outKey = mapping ? mapping->camel : propKey.c_str();

        mpack_write_cstr(&writer, outKey);

        if (mapping && mapping->type == FIELD_BOOLEAN) {
            TagLib::String raw = it->second.front();
            mpack_write_bool(&writer, raw == "1" || raw == "true");
        } else {
            const TagLib::StringList& values = it->second;
            if (values.size() == 1) {
                write_mpack_string(&writer, values.front());
            } else {
                mpack_start_array(&writer, static_cast<uint32_t>(values.size()));
                for (const auto& s : values) {
                    write_mpack_string(&writer, s);
                }
                mpack_finish_array(&writer);
            }
        }
    }

    for (const auto& mirror : mirrors) {
        if (!mirror.emit) continue;
        mpack_write_cstr(&writer, mirror.out_key);
        mpack_write_uint(&writer, static_cast<uint32_t>(mirror.value));
    }

    if (audio) {
        mpack_write_cstr(&writer, "bitrate");
        mpack_write_uint(&writer, audio->bitrate());
        mpack_write_cstr(&writer, "sampleRate");
        mpack_write_uint(&writer, audio->sampleRate());
        mpack_write_cstr(&writer, "channels");
        mpack_write_uint(&writer, audio->channels());
        mpack_write_cstr(&writer, "length");
        mpack_write_uint(&writer, audio->lengthInSeconds());
        mpack_write_cstr(&writer, "lengthMs");
        mpack_write_uint(&writer, audio->lengthInMilliseconds());

        encode_extended_audio(&writer, ext_info);
    }

    if (pic_count > 0) {
        encode_pictures(&writer, file);
    }

    if (rating_count > 0) {
        encode_ratings(&writer, file);
    }

    if (lyrics_count > 0) {
        encode_lyrics(&writer, file);
    }

    if (chapter_count > 0) {
        encode_chapters(&writer, file);
    }

    encode_bwf(&writer, file);  // emits exactly `bwf_keys` keys (self-guards)

    encode_id3_strip(&writer, file);  // emits "id3Tags" if FLAC has any ID3

    mpack_finish_map(&writer);

    if (mpack_writer_error(&writer) != mpack_ok) {
        mpack_writer_destroy(&writer);
        return TL_ERROR_SERIALIZE_FAILED;
    }
    mpack_writer_destroy(&writer);

    *out_buf = reinterpret_cast<uint8_t*>(data);
    *out_size = size;
    return TL_SUCCESS;
}

static TagLib::File* create_file_for_format(tl_format format, TagLib::IOStream* stream) {
    switch (format) {
        case TL_FORMAT_MP3:      return new TagLib::MPEG::File(stream);
        case TL_FORMAT_FLAC:     return new TagLib::FLAC::File(stream);
        case TL_FORMAT_M4A:      return new TagLib::MP4::File(stream);
        case TL_FORMAT_OGG:      return new TagLib::Ogg::Vorbis::File(stream);
        case TL_FORMAT_WAV:      return new TagLib::RIFF::WAV::File(stream);
        case TL_FORMAT_OPUS:     return new TagLib::Ogg::Opus::File(stream);
        case TL_FORMAT_AIFF:     return new TagLib::RIFF::AIFF::File(stream);
        case TL_FORMAT_APE:      return new TagLib::APE::File(stream);
        case TL_FORMAT_WV:       return new TagLib::WavPack::File(stream);
        case TL_FORMAT_MPC:      return new TagLib::MPC::File(stream);
        case TL_FORMAT_ASF:      return new TagLib::ASF::File(stream);
        case TL_FORMAT_DSF:      return new TagLib::DSF::File(stream);
        case TL_FORMAT_TTA:      return new TagLib::TrueAudio::File(stream);
        case TL_FORMAT_OGG_FLAC: return new TagLib::Ogg::FLAC::File(stream);
        case TL_FORMAT_SPEEX:    return new TagLib::Ogg::Speex::File(stream);
        case TL_FORMAT_DSDIFF:   return new TagLib::DSDIFF::File(stream);
        case TL_FORMAT_SHN:      return new TagLib::Shorten::File(stream);
        case TL_FORMAT_MOD:      return new TagLib::Mod::File(stream);
        case TL_FORMAT_S3M:      return new TagLib::S3M::File(stream);
        case TL_FORMAT_IT:       return new TagLib::IT::File(stream);
        case TL_FORMAT_XM:       return new TagLib::XM::File(stream);
        case TL_FORMAT_MATROSKA: return new TagLib::Matroska::File(stream);
        default:                 return nullptr;
    }
}

static tl_error_code read_from_buffer(const uint8_t* buf, size_t len,
                                      tl_format format,
                                      uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::ByteVector bv(reinterpret_cast<const char*>(buf),
                              static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(bv);

        if (format == TL_FORMAT_AUTO) {
            format = tl_detect_format(buf, len);
        }

        std::unique_ptr<TagLib::File> file(create_file_for_format(format, &stream));

        if (file && file->isValid()) {
            return encode_file_to_msgpack(file.get(), out_buf, out_size);
        }

        file.reset();
        TagLib::FileRef ref(&stream);
        if (ref.isNull()) return TL_ERROR_PARSE_FAILED;
        return encode_file_to_msgpack(ref.file(), out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

static tl_error_code read_from_path(const char* path,
                                    uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::FileRef ref(path);
        if (ref.isNull()) return TL_ERROR_IO_READ;

        return encode_file_to_msgpack(ref.file(), out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

// MUST stay sorted (byte-wise strcmp) — this array is binary-searched.
static const char* SKIP_KEYS[] = {
    "bextData", "bitrate", "bitsPerSample", "channels", "chapters", "codec",
    "containerFormat", "formatVersion", "isEncrypted", "isLossless", "ixml",
    "length", "lengthMs", "lyrics", "mpegLayer", "mpegVersion",
    "pictures", "ratings", "sampleRate",
};

static const size_t SKIP_KEYS_SIZE = sizeof(SKIP_KEYS) / sizeof(SKIP_KEYS[0]);

static bool should_skip(const char* key) {
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

static bool is_uppercase_key(const char* key) {
    for (const char* p = key; *p; p++) {
        if (*p >= 'a' && *p <= 'z') return false;
    }
    return true;
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
                    list.append(TagLib::String(sbuf, TagLib::String::UTF8));
                } else if (slen <= MAX_STRING_VALUE_LEN) {
                    char* heap = static_cast<char*>(malloc(slen + 1));
                    if (!heap) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                    mpack_read_bytes(&reader, heap, slen);
                    mpack_done_str(&reader);
                    heap[slen] = '\0';
                    list.append(TagLib::String(heap, TagLib::String::UTF8));
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
                } else if (is_uppercase_key(key)) {
                    propMap[key] = list;
                }
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
                    value = TagLib::String(vbuf, TagLib::String::UTF8);
                    has_value = true;
                }
            } else if (vlen <= MAX_STRING_VALUE_LEN) {
                char* heap = static_cast<char*>(malloc(vlen + 1));
                if (!heap) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                mpack_read_bytes(&reader, heap, vlen);
                mpack_done_str(&reader);
                heap[vlen] = '\0';
                value = TagLib::String(heap, TagLib::String::UTF8);
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
        } else if (is_uppercase_key(key)) {
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
    file->setProperties(propMap);

    TagLib::Tag* tag = file->tag();
    if (!tag) return;
    auto it = propMap.find("TITLE");
    if (it != propMap.end() && it->second.size() == 1)
        tag->setTitle(it->second.front());
    it = propMap.find("ARTIST");
    if (it != propMap.end() && it->second.size() == 1)
        tag->setArtist(it->second.front());
    it = propMap.find("ALBUM");
    if (it != propMap.end() && it->second.size() == 1)
        tag->setAlbum(it->second.front());
    it = propMap.find("COMMENT");
    if (it != propMap.end() && it->second.size() == 1)
        tag->setComment(it->second.front());
    it = propMap.find("GENRE");
    if (it != propMap.end() && it->second.size() == 1)
        tag->setGenre(it->second.front());

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
static std::vector<std::string> read_mp4_item_names(const uint8_t* data, size_t len)
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

        if (strcmp(key, "_mp4ItemNames") != 0) {
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

        if (uses_intpair_format(ref.file())) {
            merge_intpair_properties(propMap);
        }
        // Snapshot the real freeform atom names off the file BEFORE the
        // PropertyMap write mangles their casing, add the names JS is creating,
        // and repair afterwards (taglib-bnhl).
        auto mp4_names = capture_mp4_freeform_names(ref.file());
        for (auto& n : read_mp4_item_names(tags_msgpack, tags_msgpack_len)) {
            mp4_names.push_back(std::move(n));
        }
        apply_propmap(ref.file(), propMap);
        restore_mp4_freeform_names(ref.file(), mp4_names);
        apply_pictures_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_lyrics_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
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

        if (uses_intpair_format(f)) {
            merge_intpair_properties(propMap);
        }
        // See write_to_path: capture before, restore after (taglib-bnhl).
        auto mp4_names = capture_mp4_freeform_names(f);
        for (auto& n : read_mp4_item_names(tags_msgpack, tags_msgpack_len)) {
            mp4_names.push_back(std::move(n));
        }
        apply_propmap(f, propMap);
        restore_mp4_freeform_names(f, mp4_names);
        apply_pictures_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(f, tags_msgpack, tags_msgpack_len);
        apply_lyrics_from_msgpack(f, tags_msgpack, tags_msgpack_len);
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

tl_error_code taglib_read_shim(const char* path, const uint8_t* buf, size_t len,
                               tl_format format, uint8_t** out_buf, size_t* out_size) {
    if (!out_buf || !out_size) {
        return TL_ERROR_INVALID_INPUT;
    }

    *out_buf = nullptr;
    *out_size = 0;

    if (path && path[0] != '\0') {
        return read_from_path(path, out_buf, out_size);
    } else if (buf && len > 0) {
        return read_from_buffer(buf, len, format, out_buf, out_size);
    } else {
        return TL_ERROR_INVALID_INPUT;
    }
}

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
