#include "taglib_id3_strip.h"

#include <tfile.h>
#include <flac/flacfile.h>
#include <mpack/mpack.h>

#include <cstring>

namespace {

TagLib::FLAC::File* as_flac(TagLib::File* file) {
    return dynamic_cast<TagLib::FLAC::File*>(file);
}

bool has_any_id3(TagLib::FLAC::File* flac) {
    return flac->hasID3v1Tag() || flac->hasID3v2Tag();
}

} // namespace

uint32_t count_id3_strip_keys(TagLib::File* file) {
    auto* flac = as_flac(file);
    if (!flac) return 0;
    return has_any_id3(flac) ? 1 : 0;
}

void encode_id3_strip(mpack_writer_t* writer, TagLib::File* file) {
    auto* flac = as_flac(file);
    if (!flac || !has_any_id3(flac)) return;
    mpack_write_cstr(writer, "id3Tags");
    mpack_start_map(writer, 2);
    mpack_write_cstr(writer, "v1");
    mpack_write_bool(writer, flac->hasID3v1Tag());
    mpack_write_cstr(writer, "v2");
    mpack_write_bool(writer, flac->hasID3v2Tag());
    mpack_finish_map(writer);
}

tl_error_code apply_id3_strip_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    auto* flac = as_flac(file);
    if (!flac) return TL_SUCCESS;

    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);
    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return TL_ERROR_PARSE_FAILED;
    }

    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        char key[64];
        if (klen >= sizeof(key)) {
            mpack_skip_bytes(&reader, klen);
            mpack_done_str(&reader);
            mpack_discard(&reader);
            continue;
        }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        key[klen] = '\0';

        if (strcmp(key, "_stripId3") != 0) {
            mpack_discard(&reader);
            continue;
        }

        // Parse { "v1": bool, "v2": bool }
        uint32_t inner_count = mpack_expect_map(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        bool strip_v1 = false;
        bool strip_v2 = false;
        for (uint32_t j = 0; j < inner_count; j++) {
            uint32_t ilen = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            char ikey[8];
            if (ilen >= sizeof(ikey)) {
                mpack_skip_bytes(&reader, ilen);
                mpack_done_str(&reader);
                mpack_discard(&reader);
                continue;
            }
            mpack_read_bytes(&reader, ikey, ilen);
            mpack_done_str(&reader);
            ikey[ilen] = '\0';
            bool val = mpack_expect_bool(&reader);
            if (strcmp(ikey, "v1") == 0) strip_v1 = val;
            else if (strcmp(ikey, "v2") == 0) strip_v2 = val;
        }
        mpack_done_map(&reader);

        int mask = 0;
        if (strip_v1) mask |= TagLib::FLAC::File::ID3v1;
        if (strip_v2) mask |= TagLib::FLAC::File::ID3v2;
        if (mask) flac->strip(mask);
    }
    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
