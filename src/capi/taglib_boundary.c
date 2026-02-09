/**
 * @fileoverview Pure C Boundary - WASI API Exports
 * 
 * Pure C implementation with no exceptions or RTTI.
 * Calls into C++ shim for TagLib operations.
 */

#include "taglib_shim.h"
#include "core/taglib_core.h" 
#include "core/taglib_msgpack.h"
#include <stdlib.h>
#include <string.h>

// Forward declarations
uint8_t* tl_read_tags_ex(const char* path, const uint8_t* buf, size_t len,
                         tl_format format, size_t* out_size);

// External error handling (from taglib_error.cpp, compiled as C++)
extern void tl_set_error(tl_error_code code, const char* message);
extern void tl_clear_error(void);

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
        return NULL;
    }
    
    *out_size = 0;
    
    uint8_t* result = NULL;
    tl_error_code status = taglib_read_shim(path, buf, len, format, &result, out_size);
    
    if (status != TL_SUCCESS) {
        const char* error_msg = "Failed to read tags";
        switch (status) {
            case TL_ERROR_INVALID_INPUT:
                error_msg = "Invalid input parameters";
                break;
            case TL_ERROR_IO_READ:
                error_msg = "Failed to open file for reading";
                break;
            case TL_ERROR_UNSUPPORTED_FORMAT:
                error_msg = "Unsupported audio format";
                break;
            case TL_ERROR_PARSE_FAILED:
                error_msg = "Failed to parse audio file";
                break;
            case TL_ERROR_MEMORY_ALLOCATION:
                error_msg = "Memory allocation failed";
                break;
            case TL_ERROR_SERIALIZE_FAILED:
                error_msg = "Failed to serialize tag data";
                break;
            default:
                error_msg = "Unknown error occurred";
                break;
        }
        tl_set_error(status, error_msg);
        *out_size = 0;
        return NULL;
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
    
    // Decode MessagePack data
    Arena* arena = arena_create(4096);
    if (!arena) {
        tl_set_error(TL_ERROR_MEMORY_ALLOCATION, "Failed to create arena for decoding");
        return TL_ERROR_MEMORY_ALLOCATION;
    }
    
    TagData* decoded_tags = NULL;
    mp_status mp_status = tags_decode(tags_data, tags_size, arena, &decoded_tags);
    if (mp_status != MP_OK || !decoded_tags) {
        arena_destroy(arena);
        tl_set_error(TL_ERROR_PARSE_FAILED, "Failed to decode MessagePack tag data");
        return TL_ERROR_PARSE_FAILED;
    }
    
    // Call shim to write tags
    tl_error_code status = taglib_write_shim(path, buf, len, decoded_tags);
    
    arena_destroy(arena);
    
    if (status != TL_SUCCESS) {
        const char* error_msg = "Failed to write tags";
        switch (status) {
            case TL_ERROR_INVALID_INPUT:
                error_msg = "Invalid input for writing";
                break;
            case TL_ERROR_IO_WRITE:
                error_msg = "Failed to write tags to file";
                break;
            case TL_ERROR_UNSUPPORTED_FORMAT:
                error_msg = "Unsupported format for writing";
                break;
            case TL_ERROR_PARSE_FAILED:
                error_msg = "Failed to access tags for writing";
                break;
            case TL_ERROR_NOT_IMPLEMENTED:
                error_msg = "Buffer-to-buffer writing not supported";
                break;
            case TL_ERROR_MEMORY_ALLOCATION:
                error_msg = "Memory allocation failed during write";
                break;
            default:
                error_msg = "Unknown error during write";
                break;
        }
        tl_set_error(status, error_msg);
        return status;
    }
    
    // For file writes, no output buffer
    if (out_buf) *out_buf = NULL;
    if (out_size) *out_size = 0;
    
    return TL_SUCCESS;
}

// Format detection
tl_format tl_detect_format(const uint8_t* buf, size_t len) {
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
    
    // OGG: "OggS" signature (could be Vorbis or Opus)
    if (memcmp(buf, "OggS", 4) == 0) {
        for (size_t i = 0; i + 8 < len && i < 200; i++) {
            if (memcmp(buf + i, "OpusHead", 8) == 0) {
                return TL_FORMAT_OPUS;
            }
        }
        return TL_FORMAT_OGG;
    }
    
    // WAV: "RIFF" and "WAVE"
    if (len > 12 && memcmp(buf, "RIFF", 4) == 0 && memcmp(buf + 8, "WAVE", 4) == 0) {
        return TL_FORMAT_WAV;
    }
    
    return TL_FORMAT_AUTO;
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

// Simple memory management stubs (no pooling for now)
void* tl_malloc(size_t size) {
    return malloc(size);
}

void tl_free(void* ptr) {
    if (ptr) {
        free(ptr);
    }
}