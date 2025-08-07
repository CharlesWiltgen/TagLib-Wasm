// TagLib-Wasm Main API Implementation with MessagePack
#include "taglib_api.h"
#include "core/taglib_core.h"
#include <fileref.h>
#include <tag.h>
#include <toolkit/tpropertymap.h>
#include <toolkit/tbytevectorstream.h>
#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/frames/attachedpictureframe.h>
#include <flac/flacfile.h>
#include <mp4/mp4file.h>
#include <ogg/vorbis/vorbisfile.h>
#include <riff/wav/wavfile.h>
#include <audioproperties.h>
#include <msgpack.hpp>
#include <cstring>
#include <string>
#include <memory>
#include <map>
#include <vector>

// External error handling functions from taglib_error.cpp
extern void tl_set_error(tl_error_code code, const char* message);

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

// Helper to create appropriate TagLib file object
static std::unique_ptr<TagLib::File> create_file_from_buffer(
    const uint8_t* buf, size_t len, tl_format format) {
    
    TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
    
    // Use RAII for stream management - all TagLib file constructors take ownership
    std::unique_ptr<TagLib::ByteVectorStream> stream = 
        std::make_unique<TagLib::ByteVectorStream>(data);
    
    // If no format hint, detect it
    if (format == TL_FORMAT_AUTO) {
        format = detect_format_from_buffer(buf, len);
    }
    
    // TagLib file constructors take ownership of the stream pointer
    // so we need to release() ownership to avoid double-delete
    TagLib::ByteVectorStream* stream_ptr = stream.release();
    
    try {
        switch (format) {
            case TL_FORMAT_MP3:
                return std::make_unique<TagLib::MPEG::File>(
                    stream_ptr, TagLib::ID3v2::FrameFactory::instance());
            
            case TL_FORMAT_FLAC:
                return std::make_unique<TagLib::FLAC::File>(
                    stream_ptr, TagLib::ID3v2::FrameFactory::instance());
            
            case TL_FORMAT_M4A:
                return std::make_unique<TagLib::MP4::File>(stream_ptr);
            
            case TL_FORMAT_OGG:
                return std::make_unique<TagLib::Ogg::Vorbis::File>(stream_ptr);
            
            case TL_FORMAT_WAV:
                return std::make_unique<TagLib::RIFF::WAV::File>(stream_ptr);
            
            default:
                // No format detected - clean up and return nullptr
                delete stream_ptr;
                return nullptr;
        }
    } catch (...) {
        // If file constructor throws, we need to clean up the stream
        delete stream_ptr;
        throw;  // Re-throw the exception
    }
}

// Pack tag data into MessagePack
static uint8_t* pack_tags_to_msgpack(TagLib::Tag* tag, 
                                     TagLib::AudioProperties* props,
                                     size_t* out_size) {
    msgpack::sbuffer buffer;
    msgpack::packer<msgpack::sbuffer> packer(buffer);
    
    // Create a map of tag data
    std::map<std::string, msgpack::object> tag_map;
    
    // Basic tags
    packer.pack_map(16); // Approximate number of fields
    
    packer.pack("title");
    packer.pack(tag->title().toCString(true));
    
    packer.pack("artist");
    packer.pack(tag->artist().toCString(true));
    
    packer.pack("album");
    packer.pack(tag->album().toCString(true));
    
    packer.pack("year");
    packer.pack(static_cast<uint32_t>(tag->year()));
    
    packer.pack("track");
    packer.pack(static_cast<uint32_t>(tag->track()));
    
    packer.pack("genre");
    packer.pack(tag->genre().toCString(true));
    
    packer.pack("comment");
    packer.pack(tag->comment().toCString(true));
    
    // Extended properties if available
    TagLib::PropertyMap properties = tag->properties();
    
    packer.pack("albumArtist");
    if (properties.contains("ALBUMARTIST")) {
        packer.pack(properties["ALBUMARTIST"].front().toCString(true));
    } else {
        packer.pack("");
    }
    
    packer.pack("composer");
    if (properties.contains("COMPOSER")) {
        packer.pack(properties["COMPOSER"].front().toCString(true));
    } else {
        packer.pack("");
    }
    
    packer.pack("disc");
    if (properties.contains("DISCNUMBER")) {
        packer.pack(properties["DISCNUMBER"].front().toInt());
    } else {
        packer.pack(0);
    }
    
    packer.pack("bpm");
    if (properties.contains("BPM")) {
        packer.pack(properties["BPM"].front().toInt());
    } else {
        packer.pack(0);
    }
    
    // Audio properties
    if (props) {
        packer.pack("bitrate");
        packer.pack(props->bitrate());
        
        packer.pack("sampleRate");
        packer.pack(props->sampleRate());
        
        packer.pack("channels");
        packer.pack(props->channels());
        
        packer.pack("length");
        packer.pack(props->lengthInSeconds());
        
        packer.pack("lengthMs");
        packer.pack(props->lengthInMilliseconds());
    } else {
        packer.pack("bitrate");
        packer.pack(0);
        
        packer.pack("sampleRate");
        packer.pack(0);
        
        packer.pack("channels");
        packer.pack(0);
        
        packer.pack("length");
        packer.pack(0);
        
        packer.pack("lengthMs");
        packer.pack(0);
    }
    
    // Copy buffer to output
    *out_size = buffer.size();
    uint8_t* result = static_cast<uint8_t*>(tl_malloc(*out_size));
    if (result) {
        memcpy(result, buffer.data(), *out_size);
    }
    
    return result;
}

// Main read function with MessagePack
uint8_t* tl_read_tags(const char* path, const uint8_t* buf, size_t len, 
                      size_t* out_size) {
    return tl_read_tags_ex(path, buf, len, TL_FORMAT_AUTO, out_size);
}

// Extended read with format hint
uint8_t* tl_read_tags_ex(const char* path, const uint8_t* buf, size_t len,
                         tl_format format, size_t* out_size) {
    tl_clear_error();
    
    if (!out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "out_size cannot be NULL");
        return nullptr;
    }
    
    *out_size = 0;
    
    std::unique_ptr<TagLib::FileRef> file_ref;
    std::unique_ptr<TagLib::File> file;
    
    if (path) {
        // Direct filesystem access (WASI optimized path)
        file_ref = std::make_unique<TagLib::FileRef>(path);
        if (file_ref->isNull()) {
            tl_set_error(TL_ERROR_IO_READ, "Failed to open file");
            return nullptr;
        }
    } else if (buf && len > 0) {
        // Memory buffer access
        file = create_file_from_buffer(buf, len, format);
        if (!file || !file->isValid()) {
            tl_set_error(TL_ERROR_UNSUPPORTED_FORMAT, "Invalid or unsupported audio format");
            return nullptr;
        }
        file_ref = std::make_unique<TagLib::FileRef>(file.get());
    } else {
        tl_set_error(TL_ERROR_INVALID_INPUT, "No input provided");
        return nullptr;
    }
    
    if (!file_ref->tag()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "No tags found in file");
        return nullptr;
    }
    
    // Pack tags to MessagePack
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
    
    // Unpack MessagePack data
    msgpack::object_handle oh = msgpack::unpack(
        reinterpret_cast<const char*>(tags_data), tags_size);
    msgpack::object obj = oh.get();
    
    if (obj.type != msgpack::type::MAP) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid tag data format");
        return TL_ERROR_PARSE_FAILED;
    }
    
    std::map<std::string, msgpack::object> tag_map;
    obj.convert(tag_map);
    
    // Open file for modification
    std::unique_ptr<TagLib::FileRef> file_ref;
    std::unique_ptr<TagLib::File> file;
    
    if (path) {
        file_ref = std::make_unique<TagLib::FileRef>(path);
        if (file_ref->isNull()) {
            tl_set_error(TL_ERROR_IO_READ, "Failed to open file for writing");
            return TL_ERROR_IO_READ;
        }
    } else if (buf && len > 0) {
        // For buffer mode, we need to detect format and create appropriate file
        tl_format format = detect_format_from_buffer(buf, len);
        file = create_file_from_buffer(buf, len, format);
        if (!file || !file->isValid()) {
            tl_set_error(TL_ERROR_UNSUPPORTED_FORMAT, "Invalid audio format for writing");
            return TL_ERROR_UNSUPPORTED_FORMAT;
        }
        file_ref = std::make_unique<TagLib::FileRef>(file.get());
    } else {
        tl_set_error(TL_ERROR_INVALID_INPUT, "No input provided for writing");
        return TL_ERROR_INVALID_INPUT;
    }
    
    TagLib::Tag* tag = file_ref->tag();
    if (!tag) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Cannot access tags for writing");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Apply tags from MessagePack data
    for (const auto& [key, value] : tag_map) {
        if (key == "title" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            tag->setTitle(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "artist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            tag->setArtist(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "album" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            tag->setAlbum(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "year" && value.type == msgpack::type::POSITIVE_INTEGER) {
            uint32_t year;
            value.convert(year);
            tag->setYear(year);
        } else if (key == "track" && value.type == msgpack::type::POSITIVE_INTEGER) {
            uint32_t track;
            value.convert(track);
            tag->setTrack(track);
        } else if (key == "genre" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            tag->setGenre(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "comment" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            tag->setComment(TagLib::String(str, TagLib::String::UTF8));
        }
        // Add more fields as needed
    }
    
    // Save changes
    bool success = false;
    if (path) {
        // Direct file save
        success = file_ref->save();
    } else if (buf && out_buf && out_size) {
        // Save to buffer
        if (file) {
            success = file->save();
            if (success) {
                // Get the modified data
                auto stream = dynamic_cast<TagLib::ByteVectorStream*>(file->stream());
                if (stream) {
                    TagLib::ByteVector data = stream->data();
                    *out_size = data.size();
                    *out_buf = static_cast<uint8_t*>(tl_malloc(*out_size));
                    if (*out_buf) {
                        memcpy(*out_buf, data.data(), *out_size);
                    } else {
                        success = false;
                        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate output buffer");
                    }
                }
            }
        }
    }
    
    if (!success) {
        tl_set_error(TL_ERROR_IO_WRITE, "Failed to save tags");
        return TL_ERROR_IO_WRITE;
    }
    
    return TL_SUCCESS;
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
    
    // Convert MessagePack to JSON
    msgpack::object_handle oh = msgpack::unpack(
        reinterpret_cast<const char*>(msgpack_data), msgpack_size);
    msgpack::object obj = oh.get();
    
    std::ostringstream json;
    json << "{";
    
    if (obj.type == msgpack::type::MAP) {
        std::map<std::string, msgpack::object> tag_map;
        obj.convert(tag_map);
        
        bool first = true;
        for (const auto& [key, value] : tag_map) {
            if (!first) json << ",";
            first = false;
            
            json << "\"" << escape_json_string(key) << "\":";
            
            switch (value.type) {
                case msgpack::type::STR: {
                    std::string str;
                    value.convert(str);
                    json << "\"" << escape_json_string(str) << "\"";
                    break;
                }
                case msgpack::type::POSITIVE_INTEGER: {
                    uint64_t num;
                    value.convert(num);
                    json << num;
                    break;
                }
                case msgpack::type::NEGATIVE_INTEGER: {
                    int64_t num;
                    value.convert(num);
                    json << num;
                    break;
                }
                default:
                    json << "null";
            }
        }
    }
    
    json << "}";
    
    tl_free(msgpack_data);
    
    std::string json_str = json.str();
    char* result = static_cast<char*>(tl_malloc(json_str.length() + 1));
    if (result) {
        strcpy(result, json_str.c_str());
    }
    
    return result;
}