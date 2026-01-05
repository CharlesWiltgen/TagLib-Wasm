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
#include <fileref.h>
#include <tag.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
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

extern "C" {

tl_error_code taglib_read_shim(const char* path, const uint8_t* buf, size_t len,
                               tl_format format, uint8_t** out_buf, size_t* out_size) {
    if (!out_buf || !out_size) {
        return TL_ERROR_INVALID_INPUT;
    }

    *out_buf = nullptr;
    *out_size = 0;

    // Must have buffer data
    if (!buf || len == 0) {
        return TL_ERROR_INVALID_INPUT;
    }

    // Auto-detect format if not specified
    if (format == TL_FORMAT_AUTO) {
        format = detect_format_from_buffer(buf, len);
        if (format == TL_FORMAT_AUTO) {
            return TL_ERROR_UNSUPPORTED_FORMAT;
        }
    }

    try {
        // Create byte vector from input buffer
        TagLib::ByteVector byteVector(reinterpret_cast<const char*>(buf),
                                      static_cast<unsigned int>(len));

        // Create stream from byte vector (read-only)
        TagLib::ByteVectorStream stream(byteVector);

        // Create format-specific file
        std::unique_ptr<TagLib::File> file(create_file_from_buffer(&stream, format));
        if (!file || !file->isValid()) {
            return TL_ERROR_PARSE_FAILED;
        }

        // Extract data
        TagData tag_data = {0};
        extract_tags(file.get(), &tag_data);
        extract_properties(file.get(), &tag_data);

        // Encode to MessagePack
        size_t required_size;
        mp_status status = tags_encode_size(&tag_data, &required_size);
        if (status != MP_OK) {
            free_tag_data_strings(&tag_data);
            return TL_ERROR_SERIALIZE_FAILED;
        }

        uint8_t* buffer = (uint8_t*)malloc(required_size);
        if (!buffer) {
            free_tag_data_strings(&tag_data);
            return TL_ERROR_MEMORY_ALLOCATION;
        }

        size_t actual_size;
        status = tags_encode(&tag_data, buffer, required_size, &actual_size);
        free_tag_data_strings(&tag_data);

        if (status != MP_OK) {
            free(buffer);
            return TL_ERROR_SERIALIZE_FAILED;
        }

        *out_buf = buffer;
        *out_size = actual_size;

        return TL_SUCCESS;

    } catch (...) {
        // Catch any TagLib exceptions
        return TL_ERROR_PARSE_FAILED;
    }
}

tl_error_code taglib_write_shim(const char* path, const uint8_t* buf, size_t len,
                                const TagData* tag_data) {
    if (!tag_data) {
        return TL_ERROR_INVALID_INPUT;
    }

    // For now, buffer-to-buffer write is not supported
    // File-based writes would use TagLib::FileRef with path
    return TL_ERROR_NOT_IMPLEMENTED;
}

} // extern "C"
