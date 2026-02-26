#include "taglib_lyrics.h"

#include <tfile.h>
#include <tvariant.h>
#include <tstring.h>
#include <tlist.h>
#include <tmap.h>
#include <mpack/mpack.h>

#include <cstring>
#include <cstdlib>

uint32_t count_lyrics(TagLib::File* file) {
    auto lyrics = file->complexProperties("LYRICS");
    return static_cast<uint32_t>(lyrics.size());
}

void encode_lyrics(mpack_writer_t* writer, TagLib::File* file) {
    auto lyrics = file->complexProperties("LYRICS");
    if (lyrics.isEmpty()) return;

    mpack_write_cstr(writer, "lyrics");
    mpack_start_array(writer, static_cast<uint32_t>(lyrics.size()));

    for (const auto& entry : lyrics) {
        mpack_start_map(writer, 3);

        mpack_write_cstr(writer, "text");
        auto textIt = entry.find("text");
        if (textIt != entry.end()) {
            std::string text = textIt->second.toString().to8Bit(true);
            mpack_write_str(writer, text.c_str(),
                            static_cast<uint32_t>(text.size()));
        } else {
            mpack_write_cstr(writer, "");
        }

        mpack_write_cstr(writer, "description");
        auto descIt = entry.find("description");
        if (descIt != entry.end()) {
            std::string desc = descIt->second.toString().to8Bit(true);
            mpack_write_str(writer, desc.c_str(),
                            static_cast<uint32_t>(desc.size()));
        } else {
            mpack_write_cstr(writer, "");
        }

        mpack_write_cstr(writer, "language");
        auto langIt = entry.find("language");
        if (langIt != entry.end()) {
            std::string lang = langIt->second.toString().to8Bit(true);
            mpack_write_str(writer, lang.c_str(),
                            static_cast<uint32_t>(lang.size()));
        } else {
            mpack_write_cstr(writer, "");
        }

        mpack_finish_map(writer);
    }

    mpack_finish_array(writer);
}

tl_error_code apply_lyrics_from_msgpack(
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

        if (strcmp(key, "lyrics") == 0) {
            found = true;
            mpack_tag_t tag = mpack_peek_tag(&reader);
            if (tag.type != mpack_type_array) {
                mpack_discard(&reader);
                continue;
            }

            uint32_t arr_count = mpack_expect_array(&reader);
            TagLib::List<TagLib::VariantMap> lyricsList;

            for (uint32_t j = 0; j < arr_count; j++) {
                uint32_t entry_fields = mpack_expect_map(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;

                TagLib::String text, description, language;

                for (uint32_t k = 0; k < entry_fields; k++) {
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

                    if (strcmp(fkey, "text") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char* vbuf = static_cast<char*>(malloc(vlen + 1));
                        if (!vbuf) {
                            mpack_reader_destroy(&reader);
                            return TL_ERROR_MEMORY_ALLOCATION;
                        }
                        mpack_read_bytes(&reader, vbuf, vlen);
                        mpack_done_str(&reader);
                        vbuf[vlen] = '\0';
                        text = TagLib::String(vbuf, TagLib::String::UTF8);
                        free(vbuf);
                    } else if (strcmp(fkey, "description") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char vbuf[256];
                        if (vlen < sizeof(vbuf)) {
                            mpack_read_bytes(&reader, vbuf, vlen);
                            vbuf[vlen] = '\0';
                            description = TagLib::String(vbuf, TagLib::String::UTF8);
                        } else {
                            mpack_skip_bytes(&reader, vlen);
                        }
                        mpack_done_str(&reader);
                    } else if (strcmp(fkey, "language") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char vbuf[16];
                        if (vlen < sizeof(vbuf)) {
                            mpack_read_bytes(&reader, vbuf, vlen);
                            vbuf[vlen] = '\0';
                            language = TagLib::String(vbuf, TagLib::String::UTF8);
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
                vm["text"] = text;
                vm["description"] = description;
                vm["language"] = language;
                lyricsList.append(vm);
            }
            mpack_done_array(&reader);

            file->setComplexProperties("LYRICS", lyricsList);
        } else {
            mpack_discard(&reader);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);

    if (!found) return TL_SUCCESS;
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
