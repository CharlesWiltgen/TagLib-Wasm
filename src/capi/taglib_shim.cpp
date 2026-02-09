/**
 * @fileoverview C++ Shim Layer - Real TagLib implementation for WASI
 *
 * This file bridges the pure C boundary to TagLib's C++ API.
 * Compiled with -fwasm-exceptions for proper exception handling.
 */

#include "taglib_shim.h"
#include "core/taglib_msgpack.h"
#include "core/taglib_core.h"

// TagLib headers
#include <tag.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <tfilestream.h>
#include <audioproperties.h>

// Format-specific headers for buffer parsing
#include <mpegfile.h>
#include <flacfile.h>
#include <oggfile.h>
#include <vorbisfile.h>
#include <opusfile.h>
#include <mp4file.h>
#include <wavfile.h>

#include <memory>
#include <cstring>
#include <cstdlib>

static char* string_to_cstr(const TagLib::String& str) {
    if (str.isEmpty()) return nullptr;
    std::string utf8 = str.to8Bit(true);
    char* result = (char*)malloc(utf8.size() + 1);
    if (result) std::memcpy(result, utf8.c_str(), utf8.size() + 1);
    return result;
}

// Create TagLib file from IOStream based on format
static TagLib::File* create_file_from_buffer(TagLib::IOStream* stream, tl_format format) {
    switch (format) {
        case TL_FORMAT_MP3:
            return new TagLib::MPEG::File(stream, TagLib::ID3v2::FrameFactory::instance());
        case TL_FORMAT_FLAC:
            return new TagLib::FLAC::File(stream, TagLib::ID3v2::FrameFactory::instance());
        case TL_FORMAT_OGG:
            return new TagLib::Ogg::Vorbis::File(stream);
        case TL_FORMAT_OPUS:
            return new TagLib::Ogg::Opus::File(stream);
        case TL_FORMAT_M4A:
            return new TagLib::MP4::File(stream);
        case TL_FORMAT_WAV:
            return new TagLib::RIFF::WAV::File(stream);
        default:
            return nullptr;
    }
}

// Extract tags from TagLib file
static void extract_tags(TagLib::File* file, TagData* data) {
    TagLib::Tag* tag = file->tag();
    if (!tag) return;

    data->title = string_to_cstr(tag->title());
    data->artist = string_to_cstr(tag->artist());
    data->album = string_to_cstr(tag->album());
    data->comment = string_to_cstr(tag->comment());
    data->genre = string_to_cstr(tag->genre());
    data->year = tag->year();
    data->track = tag->track();
}

// Extract audio properties
static void extract_properties(TagLib::File* file, TagData* data) {
    TagLib::AudioProperties* props = file->audioProperties();
    if (!props) return;

    data->bitrate = props->bitrate();
    data->sampleRate = props->sampleRate();
    data->channels = props->channels();
    data->length = props->lengthInSeconds();
    data->lengthMs = props->lengthInMilliseconds();
}

// Free TagData string fields
static void free_tag_data_strings(TagData* data) {
    if (data->title) { free((void*)data->title); data->title = nullptr; }
    if (data->artist) { free((void*)data->artist); data->artist = nullptr; }
    if (data->album) { free((void*)data->album); data->album = nullptr; }
    if (data->comment) { free((void*)data->comment); data->comment = nullptr; }
    if (data->genre) { free((void*)data->genre); data->genre = nullptr; }
}

// Encode TagData to MessagePack output buffer
static tl_error_code encode_tag_data(TagData* tag_data,
                                     uint8_t** out_buf, size_t* out_size) {
    size_t required_size;
    mp_status status = tags_encode_size(tag_data, &required_size);
    if (status != MP_OK) {
        free_tag_data_strings(tag_data);
        return TL_ERROR_SERIALIZE_FAILED;
    }

    uint8_t* buffer = (uint8_t*)malloc(required_size);
    if (!buffer) {
        free_tag_data_strings(tag_data);
        return TL_ERROR_MEMORY_ALLOCATION;
    }

    size_t actual_size;
    status = tags_encode(tag_data, buffer, required_size, &actual_size);
    free_tag_data_strings(tag_data);

    if (status != MP_OK) {
        free(buffer);
        return TL_ERROR_SERIALIZE_FAILED;
    }

    *out_buf = buffer;
    *out_size = actual_size;
    return TL_SUCCESS;
}

// Read tags from in-memory buffer
static tl_error_code read_from_buffer(const uint8_t* buf, size_t len,
                                      tl_format format,
                                      uint8_t** out_buf, size_t* out_size) {
    if (format == TL_FORMAT_AUTO) {
        format = tl_detect_format(buf, len);
        if (format == TL_FORMAT_AUTO) {
            return TL_ERROR_UNSUPPORTED_FORMAT;
        }
    }

    try {
        TagLib::ByteVector byteVector(reinterpret_cast<const char*>(buf),
                                      static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(byteVector);

        std::unique_ptr<TagLib::File> file(
            create_file_from_buffer(&stream, format));
        if (!file || !file->isValid()) {
            return TL_ERROR_PARSE_FAILED;
        }

        TagData tag_data = {0};
        extract_tags(file.get(), &tag_data);
        extract_properties(file.get(), &tag_data);

        return encode_tag_data(&tag_data, out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

// Detect format from stream header and create format-specific TagLib::File.
// Returns nullptr on failure and sets *error to the specific error code.
static TagLib::File* detect_and_open(TagLib::IOStream* stream,
                                     tl_error_code* error) {
    TagLib::ByteVector header = stream->readBlock(200);
    if (header.isEmpty()) { *error = TL_ERROR_IO_READ; return nullptr; }

    tl_format format = tl_detect_format(
        reinterpret_cast<const uint8_t*>(header.data()), header.size());
    if (format == TL_FORMAT_AUTO) { *error = TL_ERROR_UNSUPPORTED_FORMAT; return nullptr; }

    stream->seek(0);
    return create_file_from_buffer(stream, format);
}

// Read tags via path using TagLib::FileStream for efficient seek-based I/O.
// FileStream uses fopen/fseek/fread (backed by WASI syscalls), letting TagLib
// read only tag headers/footers instead of loading the entire file.
static tl_error_code read_from_path(const char* path,
                                    uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::FileStream stream(path, true);
        if (!stream.isOpen()) return TL_ERROR_IO_READ;

        tl_error_code err;
        std::unique_ptr<TagLib::File> file(detect_and_open(&stream, &err));
        if (!file) return err;
        if (!file->isValid()) return TL_ERROR_PARSE_FAILED;

        TagData tag_data = {0};
        extract_tags(file.get(), &tag_data);
        extract_properties(file.get(), &tag_data);

        return encode_tag_data(&tag_data, out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

// Write tags to file via path using TagLib::FileStream for efficient I/O.
static tl_error_code write_to_path(const char* path, const TagData* tag_data) {
    try {
        TagLib::FileStream stream(path, false);
        if (!stream.isOpen()) return TL_ERROR_IO_WRITE;

        tl_error_code err;
        std::unique_ptr<TagLib::File> file(detect_and_open(&stream, &err));
        if (!file) return err;
        if (!file->isValid() || !file->tag()) return TL_ERROR_PARSE_FAILED;

        TagLib::Tag* tag = file->tag();
        if (tag_data->title)
            tag->setTitle(TagLib::String(tag_data->title, TagLib::String::UTF8));
        if (tag_data->artist)
            tag->setArtist(TagLib::String(tag_data->artist, TagLib::String::UTF8));
        if (tag_data->album)
            tag->setAlbum(TagLib::String(tag_data->album, TagLib::String::UTF8));
        if (tag_data->comment)
            tag->setComment(TagLib::String(tag_data->comment, TagLib::String::UTF8));
        if (tag_data->genre)
            tag->setGenre(TagLib::String(tag_data->genre, TagLib::String::UTF8));
        if (tag_data->year)
            tag->setYear(tag_data->year);
        if (tag_data->track)
            tag->setTrack(tag_data->track);

        if (!file->save()) return TL_ERROR_IO_WRITE;

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
                                const TagData* tag_data) {
    if (!tag_data) {
        return TL_ERROR_INVALID_INPUT;
    }

    if (path && path[0] != '\0') {
        return write_to_path(path, tag_data);
    } else if (buf && len > 0) {
        return TL_ERROR_NOT_IMPLEMENTED;
    } else {
        return TL_ERROR_INVALID_INPUT;
    }
}

} // extern "C"
