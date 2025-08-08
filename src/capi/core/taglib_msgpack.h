/**
 * @fileoverview Pure C MessagePack API - No exceptions, status codes only
 * 
 * Preserves 10x performance benefit while eliminating C++ exception issues
 * Wire format compatible with JavaScript @msgpack/msgpack library
 */

#pragma once

#include <stddef.h>
#include <stdint.h>
#include "taglib_core.h"

#ifdef __cplusplus
extern "C" {
#endif

// Tag data structure for MessagePack encoding/decoding
typedef struct {
    const char* title;
    const char* artist;
    const char* album;
    const char* genre;
    const char* comment;
    const char* albumArtist;
    const char* composer;
    uint32_t year;
    uint32_t track;
    uint32_t disc;
    uint32_t bpm;
    uint32_t bitrate;
    uint32_t sampleRate;
    uint32_t channels;
    uint32_t length;
    uint32_t lengthMs;
} TagData;

// Status codes - no exceptions ever thrown
typedef enum {
    MP_OK = 0,
    MP_ERR_TRUNCATED,
    MP_ERR_TYPE,
    MP_ERR_RANGE,
    MP_ERR_NOMEM,
    MP_ERR_INTERNAL,
    MP_ERR_INVALID_DATA
} mp_status;

// Convert status to human-readable string
const char* mp_strerror(mp_status status);

// Two-pass encoding: size then encode (eliminates hidden allocations)
mp_status tags_encode_size(const TagData* tags, size_t* out_size);
mp_status tags_encode(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len);

// Decode from buffer (caller manages memory via arena)
typedef struct {
    uint8_t* ptr;
    size_t size;
    size_t used;
} Arena;

Arena* arena_create(size_t initial_size);
void arena_destroy(Arena* arena);
void* arena_alloc(Arena* arena, size_t size);
void arena_reset(Arena* arena);

mp_status tags_decode(const uint8_t* buf, size_t len, Arena* arena, TagData** out);

// Stream variants to avoid large intermediate buffers
typedef size_t (*mp_write_fn)(const uint8_t* data, size_t len, void* ctx);
mp_status tags_encode_stream(const TagData* tags, mp_write_fn write, void* ctx);

// Format-specific optimizations (preserve existing perf)
mp_status encode_mp3_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len);
mp_status encode_flac_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len);
mp_status encode_m4a_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len);

#ifdef __cplusplus
}
#endif