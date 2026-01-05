// FLAC-specific optimized implementation
#include "../taglib_api.h"
#include "../core/taglib_core.h"
#include <flac/flacfile.h>
#include <flac/flacpicture.h>
#include <ogg/xiphcomment.h>
#include <mpeg/id3v2/id3v2framefactory.h>
#include <toolkit/tbytevectorstream.h>
#include <msgpack.hpp>
#include <cstring>
#include <memory>

// External functions
extern "C" void tl_set_error(tl_error_code code, const char* message);

// Direct FLAC processing - optimized path
uint8_t* tl_read_flac(const uint8_t* buf, size_t len, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for FLAC reading");
        return nullptr;
    }
    
    *out_size = 0;
    
    // Create stream from buffer
    TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
    auto stream = new TagLib::ByteVectorStream(data);
    
    // Create FLAC file
    auto file = std::make_unique<TagLib::FLAC::File>(
        stream, TagLib::ID3v2::FrameFactory::instance());
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid FLAC file");
        return nullptr;
    }
    
    // Pack tags - for now using generic packer, could optimize for FLAC
    msgpack::sbuffer buffer;
    msgpack::packer<msgpack::sbuffer> packer(buffer);
    
    packer.pack_map(18); // Number of fields
    
    TagLib::Tag* tag = file->tag();
    
    // Basic tags
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
    
    // Vorbis comment specific fields
    if (file->xiphComment()) {
        auto xiph = file->xiphComment();
        
        packer.pack("albumArtist");
        if (xiph->contains("ALBUMARTIST")) {
            packer.pack(xiph->fieldListMap()["ALBUMARTIST"].front().toCString(true));
        } else {
            packer.pack("");
        }
        
        packer.pack("composer");
        if (xiph->contains("COMPOSER")) {
            packer.pack(xiph->fieldListMap()["COMPOSER"].front().toCString(true));
        } else {
            packer.pack("");
        }
        
        packer.pack("disc");
        if (xiph->contains("DISCNUMBER")) {
            packer.pack(xiph->fieldListMap()["DISCNUMBER"].front().toInt());
        } else {
            packer.pack(0);
        }
        
        // Check for embedded pictures
        packer.pack("hasArtwork");
        packer.pack(!file->pictureList().isEmpty());
        
        packer.pack("pictureCount");
        packer.pack(static_cast<uint32_t>(file->pictureList().size()));
    } else {
        packer.pack("albumArtist");
        packer.pack("");
        
        packer.pack("composer");
        packer.pack("");
        
        packer.pack("disc");
        packer.pack(0);
        
        packer.pack("hasArtwork");
        packer.pack(false);
        
        packer.pack("pictureCount");
        packer.pack(0);
    }
    
    // Audio properties
    auto props = file->audioProperties();
    if (props) {
        packer.pack("bitrate");
        packer.pack(props->bitrate());
        
        packer.pack("sampleRate");
        packer.pack(props->sampleRate());
        
        packer.pack("channels");
        packer.pack(props->channels());
        
        packer.pack("length");
        packer.pack(props->lengthInSeconds());
        
        // FLAC specific
        packer.pack("bitsPerSample");
        packer.pack(props->bitsPerSample());
        
        packer.pack("sampleFrames");
        packer.pack(static_cast<uint64_t>(props->sampleFrames()));
    } else {
        packer.pack("bitrate");
        packer.pack(0);
        
        packer.pack("sampleRate");
        packer.pack(0);
        
        packer.pack("channels");
        packer.pack(0);
        
        packer.pack("length");
        packer.pack(0);
        
        packer.pack("bitsPerSample");
        packer.pack(0);
        
        packer.pack("sampleFrames");
        packer.pack(0);
    }
    
    // Copy buffer to output
    *out_size = buffer.size();
    uint8_t* result = static_cast<uint8_t*>(tl_malloc(*out_size));
    if (result) {
        memcpy(result, buffer.data(), *out_size);
    } else {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate memory for FLAC tags");
    }
    
    return result;
}

// Direct FLAC writing - optimized path
int tl_write_flac(const uint8_t* buf, size_t len,
                  const uint8_t* tags_data, size_t tags_size,
                  uint8_t** out_buf, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !tags_data || tags_size == 0) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for FLAC writing");
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
    
    // Create stream from buffer
    TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
    auto stream = new TagLib::ByteVectorStream(data);
    
    // Create FLAC file
    auto file = std::make_unique<TagLib::FLAC::File>(
        stream, TagLib::ID3v2::FrameFactory::instance());
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid FLAC file for writing");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Get Xiph comment
    auto xiph = file->xiphComment(true);
    if (!xiph) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Failed to create Vorbis comment");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Apply tags
    for (const auto& [key, value] : tag_map) {
        if (key == "title" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->setTitle(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "artist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->setArtist(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "album" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->setAlbum(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "year") {
            uint32_t year = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(year);
            }
            xiph->setYear(year);
        } else if (key == "track") {
            uint32_t track = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(track);
            }
            xiph->setTrack(track);
        } else if (key == "genre" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->setGenre(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "comment" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->setComment(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "albumArtist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->addField("ALBUMARTIST", TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "composer" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            xiph->addField("COMPOSER", TagLib::String(str, TagLib::String::UTF8));
        }
    }
    
    // Save the file
    if (!file->save()) {
        tl_set_error(TL_ERROR_IO_WRITE, "Failed to save FLAC tags");
        return TL_ERROR_IO_WRITE;
    }
    
    // Get the modified data
    if (out_buf && out_size) {
        TagLib::ByteVector modified = *stream->data();
        *out_size = modified.size();
        *out_buf = static_cast<uint8_t*>(tl_malloc(*out_size));
        if (*out_buf) {
            memcpy(*out_buf, modified.data(), *out_size);
        } else {
            tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate output buffer");
            return TL_ERROR_MEMORY_ALLOCATION;
        }
    }
    
    return TL_SUCCESS;
}