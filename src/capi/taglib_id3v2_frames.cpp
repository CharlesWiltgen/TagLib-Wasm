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

    const bool has_filter = id_filter && id_filter[0] != '\0';

    std::vector<TagLib::ID3v2::Frame*> matched;
    if (mpeg->hasID3v2Tag()) {
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

tl_error_code apply_id3v2_frames_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    (void)file; (void)data; (void)len;
    return TL_SUCCESS;  // Implemented in the write-path task.
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
