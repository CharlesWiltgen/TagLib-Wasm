// Minimal C API implementation for TagLib-Wasm
// Phase 0 Proof-of-Concept

#include "taglib_api.h"
#include <fileref.h>
#include <tag.h>
#include <toolkit/tpropertymap.h>
#include <toolkit/tbytevectorstream.h>
#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/frames/attachedpictureframe.h>
#include <audioproperties.h>
#include <cstring>
#include <string>
#include <sstream>
#include <memory>

// Thread-local error message
static thread_local std::string g_last_error;

// Simple JSON serialization (minimal implementation for POC)
// In production, we'll use nlohmann/json
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
                    // Skip non-printable characters for now
                }
        }
    }
    return ss.str();
}

extern "C" {

char* tl_read_tags(const char* path, const uint8_t* buf, size_t len) {
    g_last_error.clear();
        
        std::unique_ptr<TagLib::FileRef> file;
        std::unique_ptr<TagLib::ByteVectorStream> stream;
        
        if (path) {
            // Direct filesystem access (WASI optimized path)
            file = std::make_unique<TagLib::FileRef>(path);
            if (file->isNull()) {
                g_last_error = "Failed to open file: ";
                g_last_error += path;
                return nullptr;
            }
        } else if (buf && len > 0) {
            // Memory buffer access
            TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
            stream = std::make_unique<TagLib::ByteVectorStream>(data);
            
            // Detect format and create appropriate file object
            // For POC, we'll just support MP3
            auto mpeg = std::make_unique<TagLib::MPEG::File>(
                stream.get(),
                TagLib::ID3v2::FrameFactory::instance()
            );
            
            if (!mpeg->isValid()) {
                g_last_error = "Invalid audio file format: Buffer size: " + std::to_string(len);
                return nullptr;
            }
            
            file = std::make_unique<TagLib::FileRef>(mpeg.release());
        } else {
            g_last_error = "No input provided";
            return nullptr;
        }
        
        if (!file->tag()) {
            g_last_error = "No tags found in file";
            return nullptr;
        }
        
        // Build JSON response
        std::ostringstream json;
        json << "{";
        
        // Basic tags
        auto tag = file->tag();
        json << "\"title\":\"" << escape_json_string(tag->title().toCString(true)) << "\",";
        json << "\"artist\":\"" << escape_json_string(tag->artist().toCString(true)) << "\",";
        json << "\"album\":\"" << escape_json_string(tag->album().toCString(true)) << "\",";
        json << "\"year\":" << tag->year() << ",";
        json << "\"track\":" << tag->track() << ",";
        json << "\"genre\":\"" << escape_json_string(tag->genre().toCString(true)) << "\",";
        json << "\"comment\":\"" << escape_json_string(tag->comment().toCString(true)) << "\"";
        
        // Audio properties
        if (file->audioProperties()) {
            auto props = file->audioProperties();
            json << ",\"bitrate\":" << props->bitrate();
            json << ",\"sampleRate\":" << props->sampleRate();
            json << ",\"channels\":" << props->channels();
            json << ",\"length\":" << props->lengthInSeconds();
        }
        
        json << "}";
        
        // Allocate and return JSON string
        std::string json_str = json.str();
        char* result = static_cast<char*>(malloc(json_str.length() + 1));
        if (!result) {
            g_last_error = "Memory allocation failed";
            return nullptr;
        }
        strcpy(result, json_str.c_str());
        return result;
}

int tl_write_tags(const char* path, const uint8_t* buf, size_t len, 
                  const char* json_tags, uint8_t** out_buf, size_t* out_len) {
    g_last_error.clear();
        
        // For POC, we'll implement a simple version
        // Full implementation would parse JSON and update tags
        
        if (!json_tags) {
            g_last_error = "No tags provided";
            return -1;
        }
        
        // TODO: Parse JSON and apply tags
        // For now, just return success
        
        if (out_buf && out_len) {
            // Return modified buffer
            *out_buf = nullptr;
            *out_len = 0;
        }
        
        return 0;
}

void tl_free(void* ptr) {
    free(ptr);
}

const char* tl_version(void) {
    return "TagLib-Wasm POC v0.0.1 (TagLib " TAGLIB_VERSION ")";
}

const char* tl_get_last_error(void) {
    return g_last_error.empty() ? nullptr : g_last_error.c_str();
}

} // extern "C"