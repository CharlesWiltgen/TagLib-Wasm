#include "taglib_pictures.h"

#include <tfile.h>
#include <tvariant.h>
#include <tbytevector.h>
#include <tstring.h>
#include <tlist.h>
#include <tmap.h>
#include <mpack/mpack.h>

#include <cstring>

struct PictureTypeEntry {
    const char* name;
    uint32_t value;
};

static const PictureTypeEntry PICTURE_TYPES[] = {
    {"Artist",             8},
    {"Back Cover",         4},
    {"Band",               10},
    {"Band Logo",          19},
    {"Coloured Fish",      17},
    {"Composer",           11},
    {"Conductor",          9},
    {"During Performance", 15},
    {"During Recording",   14},
    {"File Icon",          1},
    {"Front Cover",        3},
    {"Illustration",       18},
    {"Lead Artist",        7},
    {"Leaflet Page",       5},
    {"Lyricist",           12},
    {"Media",              6},
    {"Movie Screen Capture", 16},
    {"Other",              0},
    {"Other File Icon",    2},
    {"Publisher Logo",     20},
    {"Recording Location", 13},
};

static const size_t PICTURE_TYPES_SIZE =
    sizeof(PICTURE_TYPES) / sizeof(PICTURE_TYPES[0]);

static uint32_t picture_type_to_int(const TagLib::String& name) {
    std::string utf8 = name.to8Bit(true);
    for (size_t i = 0; i < PICTURE_TYPES_SIZE; i++) {
        if (utf8 == PICTURE_TYPES[i].name) return PICTURE_TYPES[i].value;
    }
    return 0;
}

static const char* picture_type_to_string(uint32_t value) {
    for (size_t i = 0; i < PICTURE_TYPES_SIZE; i++) {
        if (PICTURE_TYPES[i].value == value) return PICTURE_TYPES[i].name;
    }
    return "Other";
}

uint32_t count_pictures(TagLib::File* file) {
    auto pictures = file->complexProperties("PICTURE");
    return static_cast<uint32_t>(pictures.size());
}

void encode_pictures(mpack_writer_t* writer, TagLib::File* file) {
    auto pictures = file->complexProperties("PICTURE");
    if (pictures.isEmpty()) return;

    mpack_write_cstr(writer, "pictures");
    mpack_start_array(writer, static_cast<uint32_t>(pictures.size()));

    for (const auto& pic : pictures) {
        mpack_start_map(writer, 4);

        // mimeType
        mpack_write_cstr(writer, "mimeType");
        auto mimeIt = pic.find("mimeType");
        if (mimeIt != pic.end()) {
            std::string mime = mimeIt->second.toString().to8Bit(true);
            mpack_write_str(writer, mime.c_str(),
                            static_cast<uint32_t>(mime.size()));
        } else {
            mpack_write_cstr(writer, "application/octet-stream");
        }

        // data
        mpack_write_cstr(writer, "data");
        auto dataIt = pic.find("data");
        if (dataIt != pic.end()) {
            TagLib::ByteVector bv = dataIt->second.toByteVector();
            mpack_write_bin(writer, bv.data(),
                            static_cast<uint32_t>(bv.size()));
        } else {
            mpack_write_bin(writer, "", 0);
        }

        // type
        mpack_write_cstr(writer, "type");
        auto typeIt = pic.find("pictureType");
        if (typeIt != pic.end()) {
            mpack_write_uint(writer, picture_type_to_int(
                typeIt->second.toString()));
        } else {
            mpack_write_uint(writer, 0);
        }

        // description
        mpack_write_cstr(writer, "description");
        auto descIt = pic.find("description");
        if (descIt != pic.end()) {
            std::string desc = descIt->second.toString().to8Bit(true);
            mpack_write_str(writer, desc.c_str(),
                            static_cast<uint32_t>(desc.size()));
        } else {
            mpack_write_cstr(writer, "");
        }

        mpack_finish_map(writer);
    }

    mpack_finish_array(writer);
}

tl_error_code apply_pictures_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);

    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return TL_ERROR_PARSE_FAILED;
    }

    bool found = false;
    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;

        char key[256];
        if (klen >= sizeof(key)) {
            mpack_reader_destroy(&reader);
            return TL_ERROR_PARSE_FAILED;
        }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        key[klen] = '\0';

        if (strcmp(key, "pictures") == 0) {
            found = true;
            mpack_tag_t tag = mpack_peek_tag(&reader);
            if (tag.type != mpack_type_array) {
                mpack_discard(&reader);
                continue;
            }

            uint32_t arr_count = mpack_expect_array(&reader);
            TagLib::List<TagLib::VariantMap> picList;

            for (uint32_t j = 0; j < arr_count; j++) {
                uint32_t pic_fields = mpack_expect_map(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;

                TagLib::String mimeType;
                TagLib::ByteVector picData;
                uint32_t picType = 0;
                TagLib::String description;

                for (uint32_t k = 0; k < pic_fields; k++) {
                    uint32_t fklen = mpack_expect_str(&reader);
                    if (mpack_reader_error(&reader) != mpack_ok) break;
                    char fkey[64];
                    if (fklen >= sizeof(fkey)) {
                        mpack_reader_destroy(&reader);
                        return TL_ERROR_PARSE_FAILED;
                    }
                    mpack_read_bytes(&reader, fkey, fklen);
                    mpack_done_str(&reader);
                    fkey[fklen] = '\0';

                    if (strcmp(fkey, "mimeType") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char vbuf[256];
                        if (vlen < sizeof(vbuf)) {
                            mpack_read_bytes(&reader, vbuf, vlen);
                            vbuf[vlen] = '\0';
                            mimeType = TagLib::String(vbuf, TagLib::String::UTF8);
                        } else {
                            mpack_skip_bytes(&reader, vlen);
                        }
                        mpack_done_str(&reader);
                    } else if (strcmp(fkey, "data") == 0) {
                        uint32_t blen = mpack_expect_bin(&reader);
                        if (blen > 0) {
                            char* buf = static_cast<char*>(malloc(blen));
                            if (!buf) {
                                mpack_reader_destroy(&reader);
                                return TL_ERROR_MEMORY_ALLOCATION;
                            }
                            mpack_read_bytes(&reader, buf, blen);
                            picData = TagLib::ByteVector(buf, blen);
                            free(buf);
                        }
                        mpack_done_bin(&reader);
                    } else if (strcmp(fkey, "type") == 0) {
                        picType = static_cast<uint32_t>(mpack_expect_u64(&reader));
                    } else if (strcmp(fkey, "description") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char vbuf[1024];
                        if (vlen < sizeof(vbuf)) {
                            mpack_read_bytes(&reader, vbuf, vlen);
                            vbuf[vlen] = '\0';
                            description = TagLib::String(vbuf, TagLib::String::UTF8);
                        } else {
                            mpack_skip_bytes(&reader, vlen);
                        }
                        mpack_done_str(&reader);
                    } else {
                        mpack_discard(&reader);
                    }
                }
                mpack_done_map(&reader);

                TagLib::VariantMap vm;
                vm["data"] = picData;
                vm["mimeType"] = mimeType;
                vm["pictureType"] = TagLib::String(
                    picture_type_to_string(picType), TagLib::String::UTF8);
                vm["description"] = description;
                picList.append(vm);
            }
            mpack_done_array(&reader);

            file->setComplexProperties("PICTURE", picList);
        } else {
            mpack_discard(&reader);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);

    if (!found) return TL_SUCCESS;
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
