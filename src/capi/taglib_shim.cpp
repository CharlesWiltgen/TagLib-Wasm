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
#include <aifffile.h>

#include <memory>
#include <cstring>
#include <cstdlib>
#include <cstdio>

// Helper to convert TagLib::String to C string (caller owns the memory)
static char* string_to_cstr(const TagLib::String& str) {
    if (str.isEmpty()) {
        return nullptr;
    }
    std::string utf8 = str.to8Bit(true);
    char* result = (char*)malloc(utf8.size() + 1);
    if (result) {
        std::memcpy(result, utf8.c_str(), utf8.size() + 1);
    }
    return result;
}

// Helper to detect format from buffer signature
static tl_format detect_format_from_buffer(const uint8_t* buf, size_t len) {
    if (len < 12) return TL_FORMAT_AUTO;

    // MP3: ID3 tag or MPEG sync
    if ((buf[0] == 'I' && buf[1] == 'D' && buf[2] == '3') ||
        (buf[0] == 0xFF && (buf[1] & 0xE0) == 0xE0)) {
        return TL_FORMAT_MP3;
    }

    // FLAC: "fLaC" signature
    if (std::memcmp(buf, "fLaC", 4) == 0) {
        return TL_FORMAT_FLAC;
    }

    // M4A/MP4: "ftyp" at offset 4
    if (len > 8 && std::memcmp(buf + 4, "ftyp", 4) == 0) {
        return TL_FORMAT_M4A;
    }

    // OGG: "OggS" signature (could be Vorbis or Opus)
    if (std::memcmp(buf, "OggS", 4) == 0) {
        // Check for Opus by looking for "OpusHead" later in the stream
        for (size_t i = 0; i + 8 < len && i < 200; i++) {
            if (std::memcmp(buf + i, "OpusHead", 8) == 0) {
                return TL_FORMAT_OPUS;
            }
        }
        return TL_FORMAT_OGG;
    }

    // WAV: "RIFF" and "WAVE"
    if (len > 12 && std::memcmp(buf, "RIFF", 4) == 0 &&
        std::memcmp(buf + 8, "WAVE", 4) == 0) {
        return TL_FORMAT_WAV;
    }

    return TL_FORMAT_AUTO;
}

// Create TagLib file from buffer based on format
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
        format = detect_format_from_buffer(buf, len);
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

// Read tags via path using TagLib::FileStream for efficient seek-based I/O.
// FileStream uses fopen/fread/fseek (backed by WASI syscalls), letting TagLib
// read only tag headers/footers instead of loading the entire file.
// Bypasses FileRef to avoid call_indirect type mismatches from virtual dispatch.
static tl_error_code read_from_path(const char* path,
                                    uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::FileStream stream(path, true);
        if (!stream.isOpen()) return TL_ERROR_IO_READ;

        TagLib::ByteVector header = stream.readBlock(200);
        if (header.isEmpty()) return TL_ERROR_IO_READ;

        tl_format format = detect_format_from_buffer(
            reinterpret_cast<const uint8_t*>(header.data()), header.size());
        if (format == TL_FORMAT_AUTO) return TL_ERROR_UNSUPPORTED_FORMAT;

        stream.seek(0);

        std::unique_ptr<TagLib::File> file(
            create_file_from_buffer(&stream, format));
        if (!file || !file->isValid()) return TL_ERROR_PARSE_FAILED;

        TagData tag_data = {0};
        extract_tags(file.get(), &tag_data);
        extract_properties(file.get(), &tag_data);

        return encode_tag_data(&tag_data, out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

// Write tags to file via path using TagLib::FileStream for efficient I/O.
// Bypasses FileRef to avoid call_indirect type mismatches from virtual dispatch.
static tl_error_code write_to_path(const char* path, const TagData* tag_data) {
    try {
        TagLib::FileStream stream(path, false);
        if (!stream.isOpen()) return TL_ERROR_IO_READ;

        TagLib::ByteVector header = stream.readBlock(200);
        if (header.isEmpty()) return TL_ERROR_IO_READ;

        tl_format format = detect_format_from_buffer(
            reinterpret_cast<const uint8_t*>(header.data()), header.size());
        if (format == TL_FORMAT_AUTO) return TL_ERROR_UNSUPPORTED_FORMAT;

        stream.seek(0);

        std::unique_ptr<TagLib::File> file(
            create_file_from_buffer(&stream, format));
        if (!file || !file->isValid() || !file->tag()) return TL_ERROR_PARSE_FAILED;

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
