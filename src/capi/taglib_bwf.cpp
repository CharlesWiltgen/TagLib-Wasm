#include "taglib_bwf.h"

#include <tfile.h>
#include <tstring.h>
#include <tbytevector.h>
#include <mpack/mpack.h>

#include <riff/wav/wavfile.h>
#include <flac/flacfile.h>

#include <cstring>
#include <cstdlib>
#include <string>

namespace {

bool is_bwf_file(TagLib::File* file) {
    return dynamic_cast<TagLib::RIFF::WAV::File*>(file) != nullptr ||
           dynamic_cast<TagLib::FLAC::File*>(file) != nullptr;
}

bool get_bext(TagLib::File* file, TagLib::ByteVector* out) {
    if (auto* wav = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
        if (!wav->hasBEXTData()) return false;
        *out = wav->BEXTData();
        return true;
    }
    if (auto* flac = dynamic_cast<TagLib::FLAC::File*>(file)) {
        if (!flac->hasBEXTData()) return false;
        *out = flac->BEXTData();
        return true;
    }
    return false;
}

bool get_ixml(TagLib::File* file, TagLib::String* out) {
    if (auto* wav = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
        if (!wav->hasiXMLData()) return false;
        *out = wav->iXMLData();
        return true;
    }
    if (auto* flac = dynamic_cast<TagLib::FLAC::File*>(file)) {
        if (!flac->hasiXMLData()) return false;
        *out = flac->iXMLData();
        return true;
    }
    return false;
}

void set_bext(TagLib::File* file, const TagLib::ByteVector& data) {
    if (auto* wav = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) { wav->setBEXTData(data); return; }
    if (auto* flac = dynamic_cast<TagLib::FLAC::File*>(file)) flac->setBEXTData(data);
}

void set_ixml(TagLib::File* file, const TagLib::String& data) {
    if (auto* wav = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) { wav->setiXMLData(data); return; }
    if (auto* flac = dynamic_cast<TagLib::FLAC::File*>(file)) flac->setiXMLData(data);
}

// Reads a msgpack str into a heap buffer (caller frees). nullptr on OOM/error.
char* read_owned_str(mpack_reader_t* reader, uint32_t* out_len) {
    uint32_t vlen = mpack_expect_str(reader);
    if (mpack_reader_error(reader) != mpack_ok) return nullptr;
    char* buf = static_cast<char*>(malloc(vlen + 1));
    if (!buf) return nullptr;
    mpack_read_bytes(reader, buf, vlen);
    mpack_done_str(reader);
    buf[vlen] = '\0';
    if (out_len) *out_len = vlen;
    return buf;
}

} // namespace

uint32_t count_bwf_keys(TagLib::File* file) {
    if (!is_bwf_file(file)) return 0;
    uint32_t n = 0;
    TagLib::ByteVector bv;
    TagLib::String s;
    if (get_bext(file, &bv)) n++;
    if (get_ixml(file, &s)) n++;
    return n;
}

void encode_bwf(mpack_writer_t* writer, TagLib::File* file) {
    if (!is_bwf_file(file)) return;
    TagLib::ByteVector bv;
    if (get_bext(file, &bv)) {
        mpack_write_cstr(writer, "bextData");
        mpack_write_bin(writer, bv.data(), static_cast<uint32_t>(bv.size()));
    }
    TagLib::String s;
    if (get_ixml(file, &s)) {
        std::string utf8 = s.to8Bit(true);
        mpack_write_cstr(writer, "ixml");
        mpack_write_str(writer, utf8.c_str(), static_cast<uint32_t>(utf8.size()));
    }
}

tl_error_code apply_bwf_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    if (!is_bwf_file(file)) return TL_SUCCESS;

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
        char key[256];
        if (klen >= sizeof(key)) { mpack_reader_destroy(&reader); return TL_ERROR_PARSE_FAILED; }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        key[klen] = '\0';

        if (strcmp(key, "bextData") == 0) {
            mpack_type_t t = mpack_peek_tag(&reader).type;
            if (t == mpack_type_nil) {
                mpack_expect_nil(&reader);
                set_bext(file, TagLib::ByteVector());
            } else if (t == mpack_type_bin) {
                uint32_t blen = mpack_expect_bin(&reader);
                char* buf = static_cast<char*>(malloc(blen ? blen : 1));
                if (!buf) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                mpack_read_bytes(&reader, buf, blen);
                mpack_done_bin(&reader);
                set_bext(file, TagLib::ByteVector(buf, blen));
                free(buf);
            } else {
                mpack_discard(&reader);
            }
        } else if (strcmp(key, "ixml") == 0) {
            mpack_type_t t = mpack_peek_tag(&reader).type;
            if (t == mpack_type_nil) {
                mpack_expect_nil(&reader);
                set_ixml(file, TagLib::String());
            } else if (t == mpack_type_str) {
                uint32_t vlen = 0;
                char* buf = read_owned_str(&reader, &vlen);
                if (!buf) { mpack_reader_destroy(&reader); return TL_ERROR_MEMORY_ALLOCATION; }
                set_ixml(file, TagLib::String(buf, TagLib::String::UTF8));
                free(buf);
            } else {
                mpack_discard(&reader);
            }
        } else {
            mpack_discard(&reader);
        }
    }
    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
