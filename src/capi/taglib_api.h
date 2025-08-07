// TagLib-Wasm Public API
// Main entry point for all tag operations
#ifndef TAGLIB_API_H
#define TAGLIB_API_H

#include <stdint.h>
#include <stddef.h>
#include "core/taglib_core.h"

#ifdef __cplusplus
extern "C" {
#endif

// ============================================================================
// Main API Functions - MessagePack Serialization
// ============================================================================

// Read tags from file path (WASI optimized) or buffer
// Returns MessagePack encoded data, caller must free with tl_free()
// out_size receives the size of the returned buffer
uint8_t* tl_read_tags(const char* path, const uint8_t* buf, size_t len, 
                      size_t* out_size);

// Read tags with format hint for optimization
uint8_t* tl_read_tags_ex(const char* path, const uint8_t* buf, size_t len,
                         tl_format format, size_t* out_size);

// Write tags to file or buffer
// tags_data: MessagePack encoded tag data
// Returns 0 on success, error code on failure
// For buffer mode: out_buf and out_size receive the modified data
int tl_write_tags(const char* path, const uint8_t* buf, size_t len,
                  const uint8_t* tags_data, size_t tags_size,
                  uint8_t** out_buf, size_t* out_size);

// ============================================================================
// Streaming API for Large Files
// ============================================================================

// Open a stream for progressive tag reading
tl_stream_t tl_stream_open(const char* path, const uint8_t* buf, size_t len);

// Read metadata without loading entire file
uint8_t* tl_stream_read_metadata(tl_stream_t stream, size_t* out_size);

// Read album art separately (can be large)
uint8_t* tl_stream_read_artwork(tl_stream_t stream, size_t* out_size);

// Close stream and free resources
void tl_stream_close(tl_stream_t stream);

// ============================================================================
// Format-Specific Optimized Paths
// ============================================================================

// Direct MP3 processing (ID3v2/ID3v1)
uint8_t* tl_read_mp3(const uint8_t* buf, size_t len, size_t* out_size);
int tl_write_mp3(const uint8_t* buf, size_t len, 
                 const uint8_t* tags_data, size_t tags_size,
                 uint8_t** out_buf, size_t* out_size);

// Direct FLAC processing (Vorbis Comments)
uint8_t* tl_read_flac(const uint8_t* buf, size_t len, size_t* out_size);
int tl_write_flac(const uint8_t* buf, size_t len,
                  const uint8_t* tags_data, size_t tags_size,
                  uint8_t** out_buf, size_t* out_size);

// Direct M4A/MP4 processing (iTunes metadata)
uint8_t* tl_read_m4a(const uint8_t* buf, size_t len, size_t* out_size);
int tl_write_m4a(const uint8_t* buf, size_t len,
                 const uint8_t* tags_data, size_t tags_size,
                 uint8_t** out_buf, size_t* out_size);

// ============================================================================
// Utility Functions
// ============================================================================

// Detect format from buffer
tl_format tl_detect_format(const uint8_t* buf, size_t len);

// Get human-readable format name
const char* tl_format_name(tl_format format);

// Validate tag data without writing
int tl_validate_tags(const uint8_t* tags_data, size_t tags_size);

// ============================================================================
// Legacy JSON API (for backward compatibility)
// ============================================================================

// Read tags and return as JSON string (deprecated, use MessagePack version)
char* tl_read_tags_json(const char* path, const uint8_t* buf, size_t len);

// Write tags from JSON string (deprecated, use MessagePack version)
int tl_write_tags_json(const char* path, const uint8_t* buf, size_t len,
                       const char* json_tags, uint8_t** out_buf, size_t* out_size);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_API_H