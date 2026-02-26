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
#include "taglib_audio_props.h"
#include "core/taglib_msgpack.h"
#include "core/taglib_core.h"

#include <fileref.h>
#include <tag.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <tfilestream.h>
#include <audioproperties.h>

#include <mpack/mpack.h>

#include <memory>
#include <cstring>
#include <cstdlib>

struct FieldMapping {
    const char* prop;   // UPPERCASE TagLib property key (sorted for binary search)
    const char* camel;  // camelCase JS key
    bool numeric;       // encode as uint instead of string
};

static const FieldMapping FIELD_MAP[] = {
    {"ACOUSTID_FINGERPRINT", "acoustidFingerprint", false},
    {"ACOUSTID_ID",          "acoustidId",          false},
    {"ALBUM",                "album",               false},
    {"ALBUMARTIST",          "albumArtist",          false},
    {"ALBUMSORT",            "albumSort",            false},
    {"ARTIST",               "artist",              false},
    {"ARTISTSORT",           "artistSort",           false},
    {"BPM",                  "bpm",                 true},
    {"COMMENT",              "comment",             false},
    {"COMPILATION",          "compilation",          false},
    {"COMPOSER",             "composer",            false},
    {"CONDUCTOR",            "conductor",           false},
    {"COPYRIGHT",            "copyright",           false},
    {"DATE",                 "year",                true},
    {"DISCNUMBER",           "discNumber",          true},
    {"DISCTOTAL",            "totalDiscs",          true},
    {"ENCODEDBY",            "encodedBy",           false},
    {"GENRE",                "genre",               false},
    {"ISRC",                 "isrc",                false},
    {"LYRICIST",             "lyricist",            false},
    {"MUSICBRAINZ_ALBUMID",  "musicbrainzReleaseId",     false},
    {"MUSICBRAINZ_ARTISTID", "musicbrainzArtistId",      false},
    {"MUSICBRAINZ_RELEASEGROUPID", "musicbrainzReleaseGroupId", false},
    {"MUSICBRAINZ_TRACKID",  "musicbrainzTrackId",       false},
    {"REPLAYGAIN_ALBUM_GAIN", "replayGainAlbumGain",     false},
    {"REPLAYGAIN_ALBUM_PEAK", "replayGainAlbumPeak",     false},
    {"REPLAYGAIN_TRACK_GAIN", "replayGainTrackGain",     false},
    {"REPLAYGAIN_TRACK_PEAK", "replayGainTrackPeak",     false},
    {"TITLE",                "title",               false},
    {"TITLESORT",            "titleSort",            false},
    {"TRACKNUMBER",          "track",               true},
    {"TRACKTOTAL",           "totalTracks",         true},
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

static tl_error_code encode_file_to_msgpack(TagLib::File* file,
                                            uint8_t** out_buf, size_t* out_size) {
    TagLib::PropertyMap props = file->properties();
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

    ExtendedAudioInfo ext_info = {0, "", "", false, 0, 0, 0, false, 0};
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

        if (mapping && mapping->numeric) {
            int val = it->second.front().toInt();
            mpack_write_uint(&writer, static_cast<uint32_t>(val));
        } else {
            write_mpack_string(&writer, it->second.front());
        }
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

static tl_error_code read_from_buffer(const uint8_t* buf, size_t len,
                                      tl_format /* format */,
                                      uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::ByteVector bv(reinterpret_cast<const char*>(buf),
                              static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(bv);
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

static const char* SKIP_KEYS[] = {
    "bitsPerSample", "bitrate", "channels", "chapters", "codec",
    "containerFormat", "formatVersion", "isEncrypted", "isLossless",
    "length", "lengthMs", "lyrics", "mpegLayer", "mpegVersion",
    "pictures", "ratings", "sampleRate",
};

static const size_t SKIP_KEYS_SIZE = sizeof(SKIP_KEYS) / sizeof(SKIP_KEYS[0]);

static bool should_skip(const char* key) {
    for (size_t i = 0; i < SKIP_KEYS_SIZE; i++) {
        if (strcmp(key, SKIP_KEYS[i]) == 0) return true;
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
            } else {
                char* heap = static_cast<char*>(malloc(vlen + 1));
                if (!heap) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                mpack_read_bytes(&reader, heap, vlen);
                mpack_done_str(&reader);
                heap[vlen] = '\0';
                value = TagLib::String(heap, TagLib::String::UTF8);
                has_value = true;
                free(heap);
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

static void apply_propmap(TagLib::FileRef& ref, const TagLib::PropertyMap& propMap) {
    ref.file()->setProperties(propMap);

    TagLib::Tag* tag = ref.tag();
    if (!tag) return;
    auto it = propMap.find("TITLE");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setTitle(it->second.front());
    it = propMap.find("ARTIST");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setArtist(it->second.front());
    it = propMap.find("ALBUM");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setAlbum(it->second.front());
    it = propMap.find("COMMENT");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setComment(it->second.front());
    it = propMap.find("GENRE");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setGenre(it->second.front());
    it = propMap.find("DATE");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setYear(it->second.front().toInt());
    it = propMap.find("TRACKNUMBER");
    if (it != propMap.end() && !it->second.isEmpty())
        tag->setTrack(it->second.front().toInt());
}

static tl_error_code write_to_path(const char* path,
                                   const uint8_t* tags_msgpack, size_t tags_msgpack_len) {
    try {
        TagLib::PropertyMap propMap;
        tl_error_code rc = decode_msgpack_to_propmap(tags_msgpack, tags_msgpack_len, propMap);
        if (rc != TL_SUCCESS) return rc;

        TagLib::FileRef ref(path);
        if (ref.isNull() || !ref.tag()) return TL_ERROR_IO_WRITE;

        apply_propmap(ref, propMap);
        apply_pictures_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_lyrics_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_chapters_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);

        if (!ref.save()) return TL_ERROR_IO_WRITE;
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

        TagLib::ByteVector bv(reinterpret_cast<const char*>(buf),
                              static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(bv);
        TagLib::FileRef ref(&stream);
        if (ref.isNull() || !ref.tag()) return TL_ERROR_PARSE_FAILED;

        apply_propmap(ref, propMap);
        apply_pictures_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_ratings_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_lyrics_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);
        apply_chapters_from_msgpack(ref.file(), tags_msgpack, tags_msgpack_len);

        if (!ref.save()) return TL_ERROR_IO_WRITE;

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
