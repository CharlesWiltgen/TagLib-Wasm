// Streaming API for large file processing
#include "../taglib_api.h"
#include "../core/taglib_core.h"
#include <fileref.h>
#include <tag.h>
#include <audioproperties.h>
#include <toolkit/tbytevectorstream.h>
#include <memory>
#include <cstring>

// External error handling
extern "C" void tl_set_error(tl_error_code code, const char* message);

// Forward declaration - defined in taglib_api.cpp
uint8_t* pack_tags_to_msgpack(TagLib::Tag* tag, 
                              TagLib::AudioProperties* props,
                              size_t* out_size);

struct tl_stream {
    std::unique_ptr<TagLib::FileRef> file_ref;
    std::unique_ptr<TagLib::File> file;
    std::unique_ptr<TagLib::ByteVectorStream> stream;
    bool is_file_path;
    size_t total_size;
    size_t current_offset;
};

// Open a stream for progressive tag reading
tl_stream_t tl_stream_open(const char* path, const uint8_t* buf, size_t len) {
    tl_clear_error();
    
    auto stream = new tl_stream;
    stream->is_file_path = (path != nullptr);
    stream->current_offset = 0;
    
    if (path) {
        // File path mode
        stream->file_ref = std::make_unique<TagLib::FileRef>(path);
        if (stream->file_ref->isNull()) {
            tl_set_error(TL_ERROR_IO_READ, "Failed to open file for streaming");
            delete stream;
            return nullptr;
        }
        stream->total_size = 0; // Will be determined from file
    } else if (buf && len > 0) {
        // Buffer mode
        TagLib::ByteVector data(reinterpret_cast<const char*>(buf), len);
        stream->stream = std::make_unique<TagLib::ByteVectorStream>(data);
        stream->total_size = len;
        
        // For now, we'll need to detect and create the appropriate file type
        // This is a simplified implementation - in production, we'd handle all formats
        tl_set_error(TL_ERROR_NOT_IMPLEMENTED, "Buffer streaming not fully implemented");
        delete stream;
        return nullptr;
    } else {
        tl_set_error(TL_ERROR_INVALID_INPUT, "No input provided for streaming");
        delete stream;
        return nullptr;
    }
    
    return stream;
}

// Read metadata without loading entire file
uint8_t* tl_stream_read_metadata(tl_stream_t stream, size_t* out_size) {
    if (!stream || !out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid stream or output parameter");
        return nullptr;
    }
    
    *out_size = 0;
    
    if (!stream->file_ref || !stream->file_ref->tag()) {
        tl_set_error(TL_ERROR_PARSE_FAILED, "No tags available in stream");
        return nullptr;
    }
    
    // Pack tags to MessagePack
    uint8_t* result = pack_tags_to_msgpack(
        stream->file_ref->tag(),
        stream->file_ref->audioProperties(),
        out_size
    );
    
    if (!result) {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to allocate memory for metadata");
    }
    
    return result;
}

// Read album art separately (can be large)
uint8_t* tl_stream_read_artwork(tl_stream_t stream, size_t* out_size) {
    if (!stream || !out_size) {
        tl_set_error(TL_ERROR_INVALID_INPUT, "Invalid stream or output parameter");
        return nullptr;
    }
    
    *out_size = 0;
    
    // This would extract album art from ID3v2, FLAC pictures, etc.
    // For now, returning not implemented
    tl_set_error(TL_ERROR_NOT_IMPLEMENTED, "Album art extraction not yet implemented");
    return nullptr;
}

// Close stream and free resources
void tl_stream_close(tl_stream_t stream) {
    if (stream) {
        // Unique pointers will automatically clean up
        delete stream;
    }
}