// M4A/MP4-specific optimized implementation
#include "../taglib_api.h"
#include "../core/taglib_core.h"
#include <mp4/mp4file.h>
#include <mp4/mp4tag.h>
#include <mp4/mp4item.h>
#include <mp4/mp4coverart.h>
#include <toolkit/tbytevectorstream.h>
// MessagePack removed - using core C API now
#include <cstring>
#include <memory>

// External functions
extern void tl_set_error(tl_error_code code, const char* message);

// Direct M4A/MP4 processing - optimized path
uint8_t* tl_read_m4a(const uint8_t* buf, size_t len, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for M4A reading");
        return nullptr;
    }
    
    *out_size = 0;
    
    // Create stream from buffer
    TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
    auto stream = new TagLib::ByteVectorStream(data);
    
    // Create MP4 file
    auto file = std::make_unique<TagLib::MP4::File>(stream);
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid M4A/MP4 file");
        return nullptr;
    }
    
    // Pack tags
    msgpack::sbuffer buffer;
    msgpack::packer<msgpack::sbuffer> packer(buffer);
    
    packer.pack_map(20); // Number of fields
    
    TagLib::MP4::Tag* tag = file->tag();
    
    if (tag) {
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
        
        // iTunes-specific atoms
        const TagLib::MP4::ItemMap& items = tag->itemMap();
        
        packer.pack("albumArtist");
        if (items.contains("aART")) {
            packer.pack(items["aART"].toStringList().front().toCString(true));
        } else {
            packer.pack("");
        }
        
        packer.pack("composer");
        if (items.contains("\251wrt")) {
            packer.pack(items["\251wrt"].toStringList().front().toCString(true));
        } else {
            packer.pack("");
        }
        
        packer.pack("disc");
        if (items.contains("disk")) {
            auto pair = items["disk"].toIntPair();
            packer.pack(pair.first);
        } else {
            packer.pack(0);
        }
        
        packer.pack("bpm");
        if (items.contains("tmpo")) {
            packer.pack(items["tmpo"].toInt());
        } else {
            packer.pack(0);
        }
        
        packer.pack("compilation");
        if (items.contains("cpil")) {
            packer.pack(items["cpil"].toBool());
        } else {
            packer.pack(false);
        }
        
        packer.pack("hasArtwork");
        if (items.contains("covr")) {
            packer.pack(!items["covr"].toCoverArtList().isEmpty());
        } else {
            packer.pack(false);
        }
        
        packer.pack("artworkCount");
        if (items.contains("covr")) {
            packer.pack(static_cast<uint32_t>(items["covr"].toCoverArtList().size()));
        } else {
            packer.pack(0);
        }
        
        // iTunes metadata
        packer.pack("isITunes");
        packer.pack(true); // M4A is iTunes format
        
        packer.pack("atomCount");
        packer.pack(static_cast<uint32_t>(items.size()));
    } else {
        // No tags
        for (int i = 0; i < 16; i++) {
            if (i == 0) packer.pack("title");
            else if (i == 1) packer.pack("artist");
            else if (i == 2) packer.pack("album");
            else if (i == 3) packer.pack("year");
            else if (i == 4) packer.pack("track");
            else if (i == 5) packer.pack("genre");
            else if (i == 6) packer.pack("comment");
            else if (i == 7) packer.pack("albumArtist");
            else if (i == 8) packer.pack("composer");
            else if (i == 9) packer.pack("disc");
            else if (i == 10) packer.pack("bpm");
            else if (i == 11) packer.pack("compilation");
            else if (i == 12) packer.pack("hasArtwork");
            else if (i == 13) packer.pack("artworkCount");
            else if (i == 14) packer.pack("isITunes");
            else if (i == 15) packer.pack("atomCount");
            
            if (i < 3 || i == 6 || i == 7 || i == 8) {
                packer.pack(""); // String fields
            } else if (i == 11 || i == 12 || i == 14) {
                packer.pack(false); // Boolean fields
            } else {
                packer.pack(0); // Numeric fields
            }
        }
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
    } else {
        packer.pack("bitrate");
        packer.pack(0);
        
        packer.pack("sampleRate");
        packer.pack(0);
        
        packer.pack("channels");
        packer.pack(0);
        
        packer.pack("length");
        packer.pack(0);
    }
    
    // Copy buffer to output
    *out_size = buffer.size();
    uint8_t* result = static_cast<uint8_t*>(tl_malloc(*out_size));
    if (result) {
        memcpy(result, buffer.data(), *out_size);
    } else {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate memory for M4A tags");
    }
    
    return result;
}

// Direct M4A/MP4 writing - optimized path
int tl_write_m4a(const uint8_t* buf, size_t len,
                 const uint8_t* tags_data, size_t tags_size,
                 uint8_t** out_buf, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !tags_data || tags_size == 0) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for M4A writing");
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
    
    // Create MP4 file
    auto file = std::make_unique<TagLib::MP4::File>(stream);
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid M4A/MP4 file for writing");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Get MP4 tag
    TagLib::MP4::Tag* mp4tag = file->tag();
    if (!mp4tag) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Failed to access M4A tags");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Apply tags
    for (const auto& [key, value] : tag_map) {
        if (key == "title" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setTitle(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "artist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setArtist(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "album" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setAlbum(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "year") {
            uint32_t year = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(year);
            }
            mp4tag->setYear(year);
        } else if (key == "track") {
            uint32_t track = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(track);
            }
            mp4tag->setTrack(track);
        } else if (key == "genre" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setGenre(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "comment" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setComment(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "albumArtist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setItem("aART", TagLib::MP4::Item(TagLib::String(str, TagLib::String::UTF8)));
        } else if (key == "composer" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            mp4tag->setItem("\251wrt", TagLib::MP4::Item(TagLib::String(str, TagLib::String::UTF8)));
        } else if (key == "disc") {
            uint32_t disc = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(disc);
                mp4tag->setItem("disk", TagLib::MP4::Item(disc, 0));
            }
        } else if (key == "bpm") {
            uint32_t bpm = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(bpm);
                mp4tag->setItem("tmpo", TagLib::MP4::Item(static_cast<int>(bpm)));
            }
        }
    }
    
    // Save the file
    if (!file->save()) {
        tl_set_error(TL_ERROR_IO_WRITE, "Failed to save M4A tags");
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