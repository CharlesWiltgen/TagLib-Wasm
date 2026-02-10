// TagLib-Wasm Main API Implementation with MessagePack
#include "taglib_api.h"
#include "core/taglib_core.h"
#include <fileref.h>
#include <tag.h>
#include <toolkit/tpropertymap.h>
#include <toolkit/tbytevectorstream.h>
#include <audioproperties.h>
#include "core/taglib_msgpack.h"
#include <cstring>
#include <string>
#include <memory>
#include <map>
#include <vector>

// External error handling functions from taglib_error.cpp
extern "C" void tl_set_error(tl_error_code code, const char* message);

// Helper to detect format from buffer
static tl_format detect_format_from_buffer(const uint8_t* buf, size_t len) {
    if (len < 12) return TL_FORMAT_AUTO;
    
    // MP3: ID3 tag or MPEG sync
    if ((buf[0] == 'I' && buf[1] == 'D' && buf[2] == '3') ||
        (buf[0] == 0xFF && (buf[1] & 0xE0) == 0xE0)) {
        return TL_FORMAT_MP3;
    }
    
    // FLAC: "fLaC" signature
    if (memcmp(buf, "fLaC", 4) == 0) {
        return TL_FORMAT_FLAC;
    }
    
    // M4A/MP4: "ftyp" at offset 4
    if (len > 8 && memcmp(buf + 4, "ftyp", 4) == 0) {
        return TL_FORMAT_M4A;
    }
    
    // OGG: "OggS" signature
    if (memcmp(buf, "OggS", 4) == 0) {
        return TL_FORMAT_OGG;
    }
    
    // WAV: "RIFF" and "WAVE"
    if (len > 12 && memcmp(buf, "RIFF", 4) == 0 && memcmp(buf + 8, "WAVE", 4) == 0) {
        return TL_FORMAT_WAV;
    }
    
    return TL_FORMAT_AUTO;
}

// Pack tag data into MessagePack using pure C API
uint8_t* pack_tags_to_msgpack(TagLib::Tag* tag, 
                              TagLib::AudioProperties* props,
                              size_t* out_size) {
    // Convert TagLib data to C structure
    TagData tag_data = {0};
    
    // Basic tags - safely convert strings
    std::string title_str = tag->title().toCString(true);
    std::string artist_str = tag->artist().toCString(true);
    std::string album_str = tag->album().toCString(true);
    std::string genre_str = tag->genre().toCString(true);
    std::string comment_str = tag->comment().toCString(true);
    
    tag_data.title = title_str.c_str();
    tag_data.artist = artist_str.c_str();
    tag_data.album = album_str.c_str();
    tag_data.genre = genre_str.c_str();
    tag_data.comment = comment_str.c_str();
    tag_data.year = static_cast<uint32_t>(tag->year());
    tag_data.track = static_cast<uint32_t>(tag->track());
    
    // Extended properties
    TagLib::PropertyMap properties = tag->properties();
    std::string album_artist_str, composer_str;
    
    if (properties.contains("ALBUMARTIST")) {
        album_artist_str = properties["ALBUMARTIST"].front().toCString(true);
        tag_data.albumArtist = album_artist_str.c_str();
    }
    
    if (properties.contains("COMPOSER")) {
        composer_str = properties["COMPOSER"].front().toCString(true);
        tag_data.composer = composer_str.c_str();
    }
    
    if (properties.contains("DISCNUMBER")) {
        tag_data.disc = static_cast<uint32_t>(properties["DISCNUMBER"].front().toInt());
    }
    
    if (properties.contains("BPM")) {
        tag_data.bpm = static_cast<uint32_t>(properties["BPM"].front().toInt());
    }
    
    // Audio properties
    if (props) {
        tag_data.bitrate = static_cast<uint32_t>(props->bitrate());
        tag_data.sampleRate = static_cast<uint32_t>(props->sampleRate());
        tag_data.channels = static_cast<uint32_t>(props->channels());
        tag_data.length = static_cast<uint32_t>(props->lengthInSeconds());
        tag_data.lengthMs = static_cast<uint32_t>(props->lengthInMilliseconds());
    }
    
    // Two-pass encoding: get size first
    size_t required_size;
    mp_status status = tags_encode_size(&tag_data, &required_size);
    if (status != MP_OK) {
        return nullptr;
    }
    
    // Allocate buffer and encode
    uint8_t* result = static_cast<uint8_t*>(tl_malloc(required_size));
    if (!result) {
        return nullptr;
    }
    
    size_t actual_size;
    status = tags_encode(&tag_data, result, required_size, &actual_size);
    if (status != MP_OK) {
        tl_free(result);
        return nullptr;
    }
    
    *out_size = actual_size;
    return result;
}

// Main read function with MessagePack
uint8_t* tl_read_tags(const char* path, const uint8_t* buf, size_t len, 
                      size_t* out_size) {
    return tl_read_tags_ex(path, buf, len, TL_FORMAT_AUTO, out_size);
}

// Extended read with format hint - Exception boundary for TagLib calls
uint8_t* tl_read_tags_ex(const char* path, const uint8_t* buf, size_t len,
                         tl_format format, size_t* out_size) {
    tl_clear_error();
    
    if (!out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "out_size cannot be NULL");
        return nullptr;
    }
    
    *out_size = 0;
    
    try {
        std::unique_ptr<TagLib::FileRef> file_ref;
        TagLib::ByteVector bv;
        std::unique_ptr<TagLib::ByteVectorStream> stream;

        if (path) {
            file_ref = std::make_unique<TagLib::FileRef>(path);
            if (file_ref->isNull()) {
                tl_set_error(TL_ERROR_IO_READ, "Failed to open file");
                return nullptr;
            }
        } else if (buf && len > 0) {
            bv = TagLib::ByteVector(reinterpret_cast<const char*>(buf),
                                    static_cast<unsigned int>(len));
            stream = std::make_unique<TagLib::ByteVectorStream>(bv);
            file_ref = std::make_unique<TagLib::FileRef>(stream.get());
            if (file_ref->isNull()) {
                tl_set_error(TL_ERROR_UNSUPPORTED_FORMAT, "Invalid or unsupported audio format");
                return nullptr;
            }
        } else {
            tl_set_error(TL_ERROR_INVALID_INPUT, "No input provided");
            return nullptr;
        }

        if (!file_ref->tag()) {
            tl_set_error(TL_ERROR_PARSE_FAILED, "No tags found in file");
            return nullptr;
        }

        uint8_t* result = pack_tags_to_msgpack(
            file_ref->tag(),
            file_ref->audioProperties(),
            out_size
        );

        if (!result) {
            tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate memory for result");
            return nullptr;
        }

        return result;

    } catch (const std::bad_alloc&) {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Memory allocation failed in TagLib");
        *out_size = 0;
        return nullptr;
    } catch (const std::exception&) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "TagLib exception occurred");
        *out_size = 0;
        return nullptr;
    } catch (...) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Unknown TagLib exception");
        *out_size = 0;
        return nullptr;
    }
}

// Write tags implementation
int tl_write_tags(const char* path, const uint8_t* buf, size_t len,
                  const uint8_t* tags_data, size_t tags_size,
                  uint8_t** out_buf, size_t* out_size) {
    tl_clear_error();
    
    if (!tags_data || tags_size == 0) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "No tag data provided");
        return TL_ERROR_INVALID_INPUT;
    }
    
    // Unpack MessagePack data using arena
    Arena* arena = arena_create(4096);  // 4KB initial size
    if (!arena) {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to create arena for MessagePack decoding");
        return TL_ERROR_MEMORY_ALLOCATION;
    }
    
    TagData* decoded_tags = nullptr;
    mp_status status = tags_decode(tags_data, tags_size, arena, &decoded_tags);
    if (status != MP_OK || !decoded_tags) {
        arena_destroy(arena);
        tl_set_error(TL_ERROR_PARSE_FAILED, "Failed to decode MessagePack tag data");
        return TL_ERROR_PARSE_FAILED;
    }
    
    try {
        std::unique_ptr<TagLib::FileRef> file_ref;
        TagLib::ByteVector bv;
        std::unique_ptr<TagLib::ByteVectorStream> stream;

        if (path) {
            file_ref = std::make_unique<TagLib::FileRef>(path);
            if (file_ref->isNull()) {
                arena_destroy(arena);
                tl_set_error(TL_ERROR_IO_READ, "Failed to open file for writing");
                return TL_ERROR_IO_READ;
            }
        } else if (buf && len > 0) {
            bv = TagLib::ByteVector(reinterpret_cast<const char*>(buf),
                                    static_cast<unsigned int>(len));
            stream = std::make_unique<TagLib::ByteVectorStream>(bv);
            file_ref = std::make_unique<TagLib::FileRef>(stream.get());
            if (file_ref->isNull()) {
                arena_destroy(arena);
                tl_set_error(TL_ERROR_UNSUPPORTED_FORMAT, "Invalid audio format for writing");
                return TL_ERROR_UNSUPPORTED_FORMAT;
            }
        } else {
            arena_destroy(arena);
            tl_set_error(TL_ERROR_INVALID_INPUT, "No input provided for writing");
            return TL_ERROR_INVALID_INPUT;
        }

        TagLib::Tag* tag = file_ref->tag();
        if (!tag) {
            arena_destroy(arena);
            tl_set_error(TL_ERROR_PARSE_FAILED, "Cannot access tags for writing");
            return TL_ERROR_PARSE_FAILED;
        }

        if (decoded_tags->title) {
            tag->setTitle(TagLib::String(decoded_tags->title, TagLib::String::UTF8));
        }
        if (decoded_tags->artist) {
            tag->setArtist(TagLib::String(decoded_tags->artist, TagLib::String::UTF8));
        }
        if (decoded_tags->album) {
            tag->setAlbum(TagLib::String(decoded_tags->album, TagLib::String::UTF8));
        }
        if (decoded_tags->genre) {
            tag->setGenre(TagLib::String(decoded_tags->genre, TagLib::String::UTF8));
        }
        if (decoded_tags->comment) {
            tag->setComment(TagLib::String(decoded_tags->comment, TagLib::String::UTF8));
        }
        if (decoded_tags->year > 0) {
            tag->setYear(decoded_tags->year);
        }
        if (decoded_tags->track > 0) {
            tag->setTrack(decoded_tags->track);
        }

        bool success = false;
        if (path) {
            success = file_ref->save();
        } else if (buf && out_buf && out_size) {
            arena_destroy(arena);
            tl_set_error(TL_ERROR_NOT_IMPLEMENTED, "Buffer-to-buffer save not supported");
            return TL_ERROR_NOT_IMPLEMENTED;
        }

        if (!success) {
            arena_destroy(arena);
            tl_set_error(TL_ERROR_IO_WRITE, "Failed to save tags");
            return TL_ERROR_IO_WRITE;
        }

        arena_destroy(arena);
        return TL_SUCCESS;

    } catch (const std::bad_alloc&) {
        arena_destroy(arena);
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Memory allocation failed in TagLib");
        return TL_ERROR_MEMORY_ALLOCATION;
    } catch (const std::exception&) {
        arena_destroy(arena);
        tl_set_error(TL_ERROR_PARSE_FAILED, "TagLib exception occurred during write");
        return TL_ERROR_PARSE_FAILED;
    } catch (...) {
        arena_destroy(arena);
        tl_set_error(TL_ERROR_PARSE_FAILED, "Unknown TagLib exception during write");
        return TL_ERROR_PARSE_FAILED;
    }
}

// Format detection
tl_format tl_detect_format(const uint8_t* buf, size_t len) {
    return detect_format_from_buffer(buf, len);
}

// Format name
const char* tl_format_name(tl_format format) {
    switch (format) {
        case TL_FORMAT_MP3: return "MP3";
        case TL_FORMAT_FLAC: return "FLAC";
        case TL_FORMAT_M4A: return "M4A/MP4";
        case TL_FORMAT_OGG: return "Ogg Vorbis";
        case TL_FORMAT_WAV: return "WAV";
        case TL_FORMAT_APE: return "Monkey's Audio";
        case TL_FORMAT_WV: return "WavPack";
        case TL_FORMAT_OPUS: return "Opus";
        case TL_FORMAT_AUTO: return "Auto-detect";
        default: return "Unknown";
    }
}

// Legacy JSON API for backward compatibility
#include <sstream>
#include <iomanip>

static std::string escape_json_string(const std::string& input) {
    std::ostringstream ss;
    for (auto c : input) {
        switch (c) {
            case '"': ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if (c >= 0x20 && c <= 0x7E) {
                    ss << c;
                } else {
                    // Unicode escape
                    ss << "\\u" << std::hex << std::setfill('0') << std::setw(4) 
                       << static_cast<int>(static_cast<unsigned char>(c));
                }
        }
    }
    return ss.str();
}

char* tl_read_tags_json(const char* path, const uint8_t* buf, size_t len) {
    size_t msgpack_size;
    uint8_t* msgpack_data = tl_read_tags(path, buf, len, &msgpack_size);
    
    if (!msgpack_data) {
        return nullptr;
    }
    
    // Convert MessagePack to JSON using C API
    Arena* arena = arena_create(4096);
    if (!arena) {
        tl_free(msgpack_data);
        return nullptr;
    }
    
    TagData* decoded_tags = nullptr;
    mp_status status = tags_decode(msgpack_data, msgpack_size, arena, &decoded_tags);
    if (status != MP_OK || !decoded_tags) {
        arena_destroy(arena);
        tl_free(msgpack_data);
        return nullptr;
    }
    
    // Build JSON manually
    std::ostringstream json;
    json << "{";
    
    bool first = true;
    
    if (decoded_tags->title) {
        if (!first) json << ","; first = false;
        json << "\"title\":\"" << escape_json_string(decoded_tags->title) << "\"";
    }
    if (decoded_tags->artist) {
        if (!first) json << ","; first = false;
        json << "\"artist\":\"" << escape_json_string(decoded_tags->artist) << "\"";
    }
    if (decoded_tags->album) {
        if (!first) json << ","; first = false;
        json << "\"album\":\"" << escape_json_string(decoded_tags->album) << "\"";
    }
    if (decoded_tags->genre) {
        if (!first) json << ","; first = false;
        json << "\"genre\":\"" << escape_json_string(decoded_tags->genre) << "\"";
    }
    if (decoded_tags->comment) {
        if (!first) json << ","; first = false;
        json << "\"comment\":\"" << escape_json_string(decoded_tags->comment) << "\"";
    }
    if (decoded_tags->albumArtist) {
        if (!first) json << ","; first = false;
        json << "\"albumArtist\":\"" << escape_json_string(decoded_tags->albumArtist) << "\"";
    }
    if (decoded_tags->composer) {
        if (!first) json << ","; first = false;
        json << "\"composer\":\"" << escape_json_string(decoded_tags->composer) << "\"";
    }
    
    // Numeric fields
    if (!first) json << ","; first = false;
    json << "\"year\":" << decoded_tags->year;
    json << ",\"track\":" << decoded_tags->track;
    json << ",\"disc\":" << decoded_tags->disc;
    json << ",\"bpm\":" << decoded_tags->bpm;
    json << ",\"bitrate\":" << decoded_tags->bitrate;
    json << ",\"sampleRate\":" << decoded_tags->sampleRate;
    json << ",\"channels\":" << decoded_tags->channels;
    json << ",\"length\":" << decoded_tags->length;
    json << ",\"lengthMs\":" << decoded_tags->lengthMs;
    
    json << "}";
    
    arena_destroy(arena);
    tl_free(msgpack_data);
    
    std::string json_str = json.str();
    char* result = static_cast<char*>(tl_malloc(json_str.length() + 1));
    if (result) {
        strcpy(result, json_str.c_str());
    }
    
    return result;
}