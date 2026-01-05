// MP3-specific optimized implementation
#include "../taglib_api.h"
#include "../core/taglib_core.h"
#include <mpeg/mpegfile.h>
#include <mpeg/mpegheader.h>
#include <mpeg/xingheader.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v1/id3v1tag.h>
#include <mpeg/id3v2/frames/attachedpictureframe.h>
#include <mpeg/id3v2/frames/textidentificationframe.h>
#include <toolkit/tbytevectorstream.h>
#include <msgpack.hpp>
#include <cstring>
#include <memory>

// External functions
extern void tl_set_error(tl_error_code code, const char* message);

// Pack MP3-specific tags to MessagePack with ID3v2 frame details
static uint8_t* pack_mp3_tags(TagLib::MPEG::File* file, size_t* out_size) {
    msgpack::sbuffer buffer;
    msgpack::packer<msgpack::sbuffer> packer(buffer);
    
    // Start with a larger map for MP3-specific fields
    packer.pack_map(20);
    
    // Get both ID3v1 and ID3v2 tags
    TagLib::ID3v2::Tag* id3v2 = file->ID3v2Tag();
    TagLib::ID3v1::Tag* id3v1 = file->ID3v1Tag();
    
    // Prefer ID3v2 tags, fall back to ID3v1
    TagLib::Tag* tag = id3v2 ? static_cast<TagLib::Tag*>(id3v2) : 
                       id3v1 ? static_cast<TagLib::Tag*>(id3v1) : 
                       file->tag();
    
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
    
    // ID3v2 specific fields
    if (id3v2) {
        // Album Artist (TPE2)
        packer.pack("albumArtist");
        if (id3v2->frameListMap().contains("TPE2") && !id3v2->frameListMap()["TPE2"].isEmpty()) {
            auto frame = dynamic_cast<TagLib::ID3v2::TextIdentificationFrame*>(
                id3v2->frameListMap()["TPE2"].front());
            if (frame) {
                packer.pack(frame->toString().toCString(true));
            } else {
                packer.pack("");
            }
        } else {
            packer.pack("");
        }
        
        // Composer (TCOM)
        packer.pack("composer");
        if (id3v2->frameListMap().contains("TCOM") && !id3v2->frameListMap()["TCOM"].isEmpty()) {
            auto frame = dynamic_cast<TagLib::ID3v2::TextIdentificationFrame*>(
                id3v2->frameListMap()["TCOM"].front());
            if (frame) {
                packer.pack(frame->toString().toCString(true));
            } else {
                packer.pack("");
            }
        } else {
            packer.pack("");
        }
        
        // Disc number (TPOS)
        packer.pack("disc");
        if (id3v2->frameListMap().contains("TPOS") && !id3v2->frameListMap()["TPOS"].isEmpty()) {
            auto frame = dynamic_cast<TagLib::ID3v2::TextIdentificationFrame*>(
                id3v2->frameListMap()["TPOS"].front());
            if (frame) {
                TagLib::String disc = frame->toString();
                // Parse "1/2" format
                int slash = disc.find("/");
                if (slash != -1) {
                    packer.pack(disc.substr(0, slash).toInt());
                } else {
                    packer.pack(disc.toInt());
                }
            } else {
                packer.pack(0);
            }
        } else {
            packer.pack(0);
        }
        
        // BPM (TBPM)
        packer.pack("bpm");
        if (id3v2->frameListMap().contains("TBPM") && !id3v2->frameListMap()["TBPM"].isEmpty()) {
            auto frame = dynamic_cast<TagLib::ID3v2::TextIdentificationFrame*>(
                id3v2->frameListMap()["TBPM"].front());
            if (frame) {
                packer.pack(frame->toString().toInt());
            } else {
                packer.pack(0);
            }
        } else {
            packer.pack(0);
        }
        
        // Has album art
        packer.pack("hasArtwork");
        bool has_artwork = false;
        if (id3v2->frameListMap().contains("APIC")) {
            has_artwork = !id3v2->frameListMap()["APIC"].isEmpty();
        }
        packer.pack(has_artwork);
    } else {
        // No ID3v2, pack empty values
        packer.pack("albumArtist");
        packer.pack("");
        
        packer.pack("composer");
        packer.pack("");
        
        packer.pack("disc");
        packer.pack(0);
        
        packer.pack("bpm");
        packer.pack(0);
        
        packer.pack("hasArtwork");
        packer.pack(false);
    }
    
    // MP3 specific info
    packer.pack("id3v1");
    packer.pack(id3v1 != nullptr);
    
    packer.pack("id3v2");
    packer.pack(id3v2 != nullptr);
    
    if (id3v2) {
        packer.pack("id3v2Version");
        packer.pack(id3v2->header()->majorVersion());
    } else {
        packer.pack("id3v2Version");
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
        
        // MP3 specific properties
        packer.pack("layer");
        packer.pack(props->layer());
        
        packer.pack("isVBR");
        packer.pack(props->xingHeader() && props->xingHeader()->isValid());
    } else {
        packer.pack("bitrate");
        packer.pack(0);
        
        packer.pack("sampleRate");
        packer.pack(0);
        
        packer.pack("channels");
        packer.pack(0);
        
        packer.pack("length");
        packer.pack(0);
        
        packer.pack("layer");
        packer.pack(0);
        
        packer.pack("isVBR");
        packer.pack(false);
    }
    
    // Copy buffer to output
    *out_size = buffer.size();
    uint8_t* result = static_cast<uint8_t*>(tl_malloc(*out_size));
    if (result) {
        memcpy(result, buffer.data(), *out_size);
    }
    
    return result;
}

// Direct MP3 processing - optimized path
uint8_t* tl_read_mp3(const uint8_t* buf, size_t len, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for MP3 reading");
        return nullptr;
    }
    
    *out_size = 0;
    
    // Create stream from buffer
    TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
    auto stream = new TagLib::ByteVectorStream(data);
    
    // Create MP3 file
    auto file = std::make_unique<TagLib::MPEG::File>(
        stream, TagLib::ID3v2::FrameFactory::instance());
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid MP3 file");
        return nullptr;
    }
    
    // Pack tags with MP3-specific information
    uint8_t* result = pack_mp3_tags(file.get(), out_size);
    
    if (!result) {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate memory for MP3 tags");
    }
    
    return result;
}

// Direct MP3 writing - optimized path
int tl_write_mp3(const uint8_t* buf, size_t len, 
                 const uint8_t* tags_data, size_t tags_size,
                 uint8_t** out_buf, size_t* out_size) {
    tl_clear_error();
    
    if (!buf || len == 0 || !tags_data || tags_size == 0) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid input parameters for MP3 writing");
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
    
    // Create MP3 file
    auto file = std::make_unique<TagLib::MPEG::File>(
        stream, TagLib::ID3v2::FrameFactory::instance());
    
    if (!file->isValid()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Invalid MP3 file for writing");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Get or create ID3v2 tag
    TagLib::ID3v2::Tag* id3v2 = file->ID3v2Tag(true);
    if (!id3v2) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "Failed to create ID3v2 tag");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Apply standard tags
    for (const auto& [key, value] : tag_map) {
        if (key == "title" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            id3v2->setTitle(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "artist" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            id3v2->setArtist(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "album" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            id3v2->setAlbum(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "year") {
            uint32_t year = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(year);
            }
            id3v2->setYear(year);
        } else if (key == "track") {
            uint32_t track = 0;
            if (value.type == msgpack::type::POSITIVE_INTEGER) {
                value.convert(track);
            }
            id3v2->setTrack(track);
        } else if (key == "genre" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            id3v2->setGenre(TagLib::String(str, TagLib::String::UTF8));
        } else if (key == "comment" && value.type == msgpack::type::STR) {
            std::string str;
            value.convert(str);
            id3v2->setComment(TagLib::String(str, TagLib::String::UTF8));
        }
        // Add handling for MP3-specific frames (TPE2, TCOM, etc.) as needed
    }
    
    // Save the file
    if (!file->save()) {
        tl_set_error(TL_ERROR_IO_WRITE, "Failed to save MP3 tags");
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