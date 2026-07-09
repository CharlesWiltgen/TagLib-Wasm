#include "taglib_id3v2_frames.h"
#include "taglib_shim.h"

#include <tfile.h>
#include <fileref.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/id3v2frame.h>
#include <mpeg/id3v2/id3v2synchdata.h>
#include <mpeg/id3v2/frames/unknownframe.h>

#include <cstring>
#include <memory>
#include <vector>

// v2.4 frame header layout: bytes 0-3 ID, 4-7 syncsafe size, 8-9 flags.
static uint16_t frame_flags(const TagLib::ByteVector& rendered) {
    if (rendered.size() < 10) return 0;
    return static_cast<uint16_t>(
        (static_cast<uint8_t>(rendered[8]) << 8) |
        static_cast<uint8_t>(rendered[9]));
}

tl_error_code read_id3v2_frames_to_msgpack(
    TagLib::File* file, const char* id_filter,
    uint8_t** out_buf, size_t* out_size)
{
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return TL_ERROR_UNSUPPORTED_FORMAT;

    const size_t filter_len = id_filter ? strlen(id_filter) : 0;
    const bool has_filter = filter_len > 0;

    std::vector<TagLib::ID3v2::Frame*> matched;
    if (mpeg->hasID3v2Tag() && (!has_filter || filter_len == 4)) {
        for (const auto& frame : mpeg->ID3v2Tag()->frameList()) {
            if (has_filter) {
                TagLib::ByteVector id = frame->frameID();
                if (id.size() != 4 ||
                    std::memcmp(id.data(), id_filter, 4) != 0) {
                    continue;
                }
            }
            matched.push_back(frame);
        }
    }

    char* buf = nullptr;
    size_t used = 0;
    mpack_writer_t writer;
    mpack_writer_init_growable(&writer, &buf, &used);

    mpack_start_array(&writer, static_cast<uint32_t>(matched.size()));
    for (const auto* frame : matched) {
        TagLib::ByteVector rendered = frame->render();
        TagLib::ByteVector body = rendered.mid(frame->headerSize());
        TagLib::ByteVector id = frame->frameID();

        mpack_start_map(&writer, 3);
        mpack_write_cstr(&writer, "id");
        mpack_write_str(&writer, id.data(), static_cast<uint32_t>(id.size()));
        mpack_write_cstr(&writer, "data");
        mpack_write_bin(&writer, body.data(),
                        static_cast<uint32_t>(body.size()));
        mpack_write_cstr(&writer, "flags");
        mpack_write_u16(&writer, frame_flags(rendered));
        mpack_finish_map(&writer);
    }
    mpack_finish_array(&writer);

    if (mpack_writer_destroy(&writer) != mpack_ok) {
        if (buf) free(buf);
        return TL_ERROR_SERIALIZE_FAILED;
    }
    *out_buf = reinterpret_cast<uint8_t*>(buf);
    *out_size = used;
    return TL_SUCCESS;
}

static void apply_frame_set(TagLib::MPEG::File* mpeg, const char id[4],
                            const std::vector<TagLib::ByteVector>& bodies)
{
    TagLib::ByteVector idBv(id, 4);
    if (bodies.empty()) {
        if (mpeg->hasID3v2Tag()) mpeg->ID3v2Tag()->removeFrames(idBv);
        return;
    }
    TagLib::ID3v2::Tag* tag = mpeg->ID3v2Tag(true);
    tag->removeFrames(idBv);
    for (const auto& body : bodies) {
        TagLib::ByteVector full;
        full.append(idBv);
        full.append(TagLib::ID3v2::SynchData::fromUInt(body.size()));
        full.append(TagLib::ByteVector("\0\0", 2));  // zero flags (v1)
        full.append(body);
        tag->addFrame(new TagLib::ID3v2::UnknownFrame(full));
    }
}

tl_error_code apply_id3v2_frames_from_msgpack(
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

        if (strcmp(key, "id3v2Frames") != 0) {
            mpack_discard(&reader);
            continue;
        }
        found = true;

        auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
        mpack_tag_t tag = mpack_peek_tag(&reader);
        if (tag.type != mpack_type_map) {
            mpack_discard(&reader);
            continue;
        }

        uint32_t id_count = mpack_expect_map(&reader);
        for (uint32_t j = 0; j < id_count; j++) {
            uint32_t idlen = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) break;
            char frame_id[5];
            if (idlen != 4) {
                mpack_reader_destroy(&reader);
                return TL_ERROR_PARSE_FAILED;
            }
            mpack_read_bytes(&reader, frame_id, 4);
            mpack_done_str(&reader);
            frame_id[4] = '\0';

            uint32_t body_count = mpack_expect_array(&reader);
            std::vector<TagLib::ByteVector> bodies;
            bodies.reserve(body_count);
            for (uint32_t k = 0; k < body_count; k++) {
                uint32_t blen = mpack_expect_bin(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;
                std::vector<char> body(blen);
                if (blen > 0) mpack_read_bytes(&reader, body.data(), blen);
                mpack_done_bin(&reader);
                bodies.emplace_back(body.data(),
                                    static_cast<unsigned int>(blen));
            }
            mpack_done_array(&reader);

            // Non-MP3 files: parse (to keep the reader in sync) but skip
            // application, matching the silent-skip idiom of other modules.
            if (mpeg) apply_frame_set(mpeg, frame_id, bodies);
        }
        mpack_done_map(&reader);
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);
    if (!found) return TL_SUCCESS;
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}

// C entry for taglib_boundary.c — opens the file itself (FileRef handles
// both path and in-memory stream modes), so taglib_shim.cpp stays untouched
// on the read side.
extern "C" tl_error_code taglib_read_id3v2_frames_shim(
    const char* path, const uint8_t* buf, size_t len,
    const char* id_filter, uint8_t** out_buf, size_t* out_size)
{
    try {
        if (path) {
            TagLib::FileRef ref(path);
            if (ref.isNull()) return TL_ERROR_IO_READ;
            return read_id3v2_frames_to_msgpack(
                ref.file(), id_filter, out_buf, out_size);
        }
        if (!buf || len == 0) return TL_ERROR_INVALID_INPUT;
        TagLib::ByteVector bv(reinterpret_cast<const char*>(buf),
                              static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(bv);
        TagLib::FileRef ref(&stream);
        if (ref.isNull()) return TL_ERROR_PARSE_FAILED;
        return read_id3v2_frames_to_msgpack(
            ref.file(), id_filter, out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}
