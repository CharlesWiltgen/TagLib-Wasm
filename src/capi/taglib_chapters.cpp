#include "taglib_chapters.h"

#include <tfile.h>
#include <tstring.h>
#include <tbytevector.h>
#include <mpack/mpack.h>

#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/frames/chapterframe.h>
#include <mpeg/id3v2/frames/textidentificationframe.h>

#include <cstring>
#include <cstdlib>

static TagLib::ID3v2::Tag* get_id3v2_tag(TagLib::File* file) {
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return nullptr;
    return mpeg->ID3v2Tag();
}

uint32_t count_chapters(TagLib::File* file) {
    auto* tag = get_id3v2_tag(file);
    if (!tag) return 0;

    uint32_t count = 0;
    for (const auto* frame : tag->frameList("CHAP")) {
        if (dynamic_cast<const TagLib::ID3v2::ChapterFrame*>(frame))
            count++;
    }
    return count;
}

void encode_chapters(mpack_writer_t* writer, TagLib::File* file) {
    auto* tag = get_id3v2_tag(file);
    if (!tag) return;

    auto chaps = tag->frameList("CHAP");
    if (chaps.isEmpty()) return;

    uint32_t valid = 0;
    for (const auto* frame : chaps) {
        if (dynamic_cast<const TagLib::ID3v2::ChapterFrame*>(frame))
            valid++;
    }
    if (valid == 0) return;

    mpack_write_cstr(writer, "chapters");
    mpack_start_array(writer, valid);

    for (const auto* frame : chaps) {
        auto* chap = dynamic_cast<const TagLib::ID3v2::ChapterFrame*>(frame);
        if (!chap) continue;

        // Find embedded TIT2 for chapter title
        TagLib::String title;
        auto embedded = chap->embeddedFrameList("TIT2");
        if (!embedded.isEmpty()) {
            auto* tit2 = dynamic_cast<const TagLib::ID3v2::TextIdentificationFrame*>(
                embedded.front());
            if (tit2) title = tit2->toString();
        }

        uint32_t field_count = 3; // startTimeMs, endTimeMs, id
        if (!title.isEmpty()) field_count++;

        mpack_start_map(writer, field_count);

        mpack_write_cstr(writer, "id");
        std::string eid = chap->elementID().data();
        mpack_write_str(writer, eid.c_str(),
                        static_cast<uint32_t>(eid.size()));

        mpack_write_cstr(writer, "startTimeMs");
        mpack_write_uint(writer, chap->startTime());

        mpack_write_cstr(writer, "endTimeMs");
        mpack_write_uint(writer, chap->endTime());

        if (!title.isEmpty()) {
            mpack_write_cstr(writer, "title");
            std::string utf8 = title.to8Bit(true);
            mpack_write_str(writer, utf8.c_str(),
                            static_cast<uint32_t>(utf8.size()));
        }

        mpack_finish_map(writer);
    }

    mpack_finish_array(writer);
}

tl_error_code apply_chapters_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    auto* tag = get_id3v2_tag(file);
    if (!tag) return TL_SUCCESS; // Not an MPEG file, silently skip

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

        if (strcmp(key, "chapters") == 0) {
            found = true;
            mpack_tag_t mtag = mpack_peek_tag(&reader);
            if (mtag.type != mpack_type_array) {
                mpack_discard(&reader);
                continue;
            }

            // Remove existing CHAP frames
            tag->removeFrames("CHAP");

            uint32_t arr_count = mpack_expect_array(&reader);

            for (uint32_t j = 0; j < arr_count; j++) {
                uint32_t entry_fields = mpack_expect_map(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;

                TagLib::ByteVector elementId;
                unsigned int startTime = 0, endTime = 0;
                TagLib::String title;

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

                    if (strcmp(fkey, "id") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char* vbuf = static_cast<char*>(malloc(vlen + 1));
                        if (!vbuf) {
                            mpack_reader_destroy(&reader);
                            return TL_ERROR_MEMORY_ALLOCATION;
                        }
                        mpack_read_bytes(&reader, vbuf, vlen);
                        mpack_done_str(&reader);
                        vbuf[vlen] = '\0';
                        elementId = TagLib::ByteVector(vbuf, vlen);
                        free(vbuf);
                    } else if (strcmp(fkey, "startTimeMs") == 0) {
                        startTime = static_cast<unsigned int>(mpack_expect_u64(&reader));
                    } else if (strcmp(fkey, "endTimeMs") == 0) {
                        endTime = static_cast<unsigned int>(mpack_expect_u64(&reader));
                    } else if (strcmp(fkey, "title") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        char* vbuf = static_cast<char*>(malloc(vlen + 1));
                        if (!vbuf) {
                            mpack_reader_destroy(&reader);
                            return TL_ERROR_MEMORY_ALLOCATION;
                        }
                        mpack_read_bytes(&reader, vbuf, vlen);
                        mpack_done_str(&reader);
                        vbuf[vlen] = '\0';
                        title = TagLib::String(vbuf, TagLib::String::UTF8);
                        free(vbuf);
                    } else {
                        mpack_discard(&reader);
                    }
                }
                mpack_done_map(&reader);

                if (elementId.isEmpty()) {
                    char autoId[32];
                    snprintf(autoId, sizeof(autoId), "chap%u", j);
                    elementId = TagLib::ByteVector(autoId);
                }

                TagLib::ID3v2::FrameList embeddedFrames;
                if (!title.isEmpty()) {
                    auto* tit2 = new TagLib::ID3v2::TextIdentificationFrame("TIT2");
                    tit2->setText(title);
                    embeddedFrames.append(tit2);
                }

                auto* chap = new TagLib::ID3v2::ChapterFrame(
                    elementId, startTime, endTime,
                    0xFFFFFFFF, 0xFFFFFFFF,
                    embeddedFrames);
                tag->addFrame(chap);
            }
            mpack_done_array(&reader);
        } else {
            mpack_discard(&reader);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);

    if (!found) return TL_SUCCESS;
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
