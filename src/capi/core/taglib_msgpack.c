/**
 * @fileoverview Pure C MessagePack API Implementation - No exceptions
 * 
 * Uses mpack library to provide high-performance MessagePack encoding/decoding
 * Wire format compatible with JavaScript @msgpack/msgpack library
 */

#include "taglib_msgpack.h"
#include <mpack/mpack.h>
#include <string.h>
#include <stdlib.h>

// Status code to human-readable string
const char* mp_strerror(mp_status status) {
    switch (status) {
        case MP_OK: return "Success";
        case MP_ERR_TRUNCATED: return "Buffer truncated";
        case MP_ERR_TYPE: return "Type mismatch";
        case MP_ERR_RANGE: return "Value out of range";
        case MP_ERR_NOMEM: return "Out of memory";
        case MP_ERR_INTERNAL: return "Internal error";
        case MP_ERR_INVALID_DATA: return "Invalid data";
        default: return "Unknown error";
    }
}

// Arena memory management
Arena* arena_create(size_t initial_size) {
    Arena* arena = (Arena*)malloc(sizeof(Arena));
    if (!arena) return NULL;
    
    arena->ptr = (uint8_t*)malloc(initial_size);
    if (!arena->ptr) {
        free(arena);
        return NULL;
    }
    
    arena->size = initial_size;
    arena->used = 0;
    return arena;
}

void arena_destroy(Arena* arena) {
    if (!arena) return;
    free(arena->ptr);
    free(arena);
}

void* arena_alloc(Arena* arena, size_t size) {
    if (!arena) return NULL;
    
    // Align to 8-byte boundaries
    size = (size + 7) & ~7;
    
    if (arena->used + size > arena->size) {
        // Double arena size, ensuring we have enough space
        size_t new_size = arena->size * 2;
        while (new_size < arena->used + size) {
            new_size *= 2;
        }
        
        uint8_t* new_ptr = (uint8_t*)realloc(arena->ptr, new_size);
        if (!new_ptr) return NULL;
        
        arena->ptr = new_ptr;
        arena->size = new_size;
    }
    
    void* result = arena->ptr + arena->used;
    arena->used += size;
    return result;
}

void arena_reset(Arena* arena) {
    if (arena) {
        arena->used = 0;
    }
}

// Two-pass encoding: calculate size first
mp_status tags_encode_size(const TagData* tags, size_t* out_size) {
    if (!tags || !out_size) {
        return MP_ERR_INVALID_DATA;
    }
    
    mpack_writer_t writer;
    mpack_writer_init_growable(&writer, NULL, 0);
    
    // Start map with known field count
    mpack_start_map(&writer, 16);
    
    // Basic tags
    mpack_write_cstr(&writer, "title");
    mpack_write_cstr(&writer, tags->title ? tags->title : "");
    
    mpack_write_cstr(&writer, "artist");
    mpack_write_cstr(&writer, tags->artist ? tags->artist : "");
    
    mpack_write_cstr(&writer, "album");
    mpack_write_cstr(&writer, tags->album ? tags->album : "");
    
    mpack_write_cstr(&writer, "year");
    mpack_write_uint(&writer, tags->year);
    
    mpack_write_cstr(&writer, "track");
    mpack_write_uint(&writer, tags->track);
    
    mpack_write_cstr(&writer, "genre");
    mpack_write_cstr(&writer, tags->genre ? tags->genre : "");
    
    mpack_write_cstr(&writer, "comment");
    mpack_write_cstr(&writer, tags->comment ? tags->comment : "");
    
    // Extended properties
    mpack_write_cstr(&writer, "albumArtist");
    mpack_write_cstr(&writer, tags->albumArtist ? tags->albumArtist : "");
    
    mpack_write_cstr(&writer, "composer");
    mpack_write_cstr(&writer, tags->composer ? tags->composer : "");
    
    mpack_write_cstr(&writer, "disc");
    mpack_write_uint(&writer, tags->disc);
    
    mpack_write_cstr(&writer, "bpm");
    mpack_write_uint(&writer, tags->bpm);
    
    // Audio properties
    mpack_write_cstr(&writer, "bitrate");
    mpack_write_uint(&writer, tags->bitrate);
    
    mpack_write_cstr(&writer, "sampleRate");
    mpack_write_uint(&writer, tags->sampleRate);
    
    mpack_write_cstr(&writer, "channels");
    mpack_write_uint(&writer, tags->channels);
    
    mpack_write_cstr(&writer, "length");
    mpack_write_uint(&writer, tags->length);
    
    mpack_write_cstr(&writer, "lengthMs");
    mpack_write_uint(&writer, tags->lengthMs);
    
    mpack_finish_map(&writer);
    
    // Check for errors
    mpack_error_t error = mpack_writer_error(&writer);
    if (error != mpack_ok) {
        mpack_writer_destroy(&writer);
        return MP_ERR_INTERNAL;
    }
    
    *out_size = mpack_writer_buffer_size(&writer);
    mpack_writer_destroy(&writer);
    return MP_OK;
}

// Encode tags to buffer
mp_status tags_encode(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len) {
    if (!tags || !buf || !out_len) {
        return MP_ERR_INVALID_DATA;
    }
    
    mpack_writer_t writer;
    mpack_writer_init(&writer, (char*)buf, buf_cap);
    
    // Start map with known field count
    mpack_start_map(&writer, 16);
    
    // Basic tags
    mpack_write_cstr(&writer, "title");
    mpack_write_cstr(&writer, tags->title ? tags->title : "");
    
    mpack_write_cstr(&writer, "artist");
    mpack_write_cstr(&writer, tags->artist ? tags->artist : "");
    
    mpack_write_cstr(&writer, "album");
    mpack_write_cstr(&writer, tags->album ? tags->album : "");
    
    mpack_write_cstr(&writer, "year");
    mpack_write_uint(&writer, tags->year);
    
    mpack_write_cstr(&writer, "track");
    mpack_write_uint(&writer, tags->track);
    
    mpack_write_cstr(&writer, "genre");
    mpack_write_cstr(&writer, tags->genre ? tags->genre : "");
    
    mpack_write_cstr(&writer, "comment");
    mpack_write_cstr(&writer, tags->comment ? tags->comment : "");
    
    // Extended properties
    mpack_write_cstr(&writer, "albumArtist");
    mpack_write_cstr(&writer, tags->albumArtist ? tags->albumArtist : "");
    
    mpack_write_cstr(&writer, "composer");
    mpack_write_cstr(&writer, tags->composer ? tags->composer : "");
    
    mpack_write_cstr(&writer, "disc");
    mpack_write_uint(&writer, tags->disc);
    
    mpack_write_cstr(&writer, "bpm");
    mpack_write_uint(&writer, tags->bpm);
    
    // Audio properties
    mpack_write_cstr(&writer, "bitrate");
    mpack_write_uint(&writer, tags->bitrate);
    
    mpack_write_cstr(&writer, "sampleRate");
    mpack_write_uint(&writer, tags->sampleRate);
    
    mpack_write_cstr(&writer, "channels");
    mpack_write_uint(&writer, tags->channels);
    
    mpack_write_cstr(&writer, "length");
    mpack_write_uint(&writer, tags->length);
    
    mpack_write_cstr(&writer, "lengthMs");
    mpack_write_uint(&writer, tags->lengthMs);
    
    mpack_finish_map(&writer);
    
    // Check for errors
    mpack_error_t error = mpack_writer_error(&writer);
    if (error != mpack_ok) {
        mpack_writer_destroy(&writer);
        switch (error) {
            case mpack_error_too_big: return MP_ERR_RANGE;
            case mpack_error_memory: return MP_ERR_NOMEM;
            case mpack_error_io: return MP_ERR_TRUNCATED;
            default: return MP_ERR_INTERNAL;
        }
    }
    
    *out_len = mpack_writer_buffer_used(&writer);
    mpack_writer_destroy(&writer);
    return MP_OK;
}

// Field handler function type
typedef mp_status (*field_handler_t)(TagData* tags, mpack_reader_t* reader, Arena* arena);

// String field decoder - eliminates code duplication
static mp_status decode_string_field(const char** field, mpack_reader_t* reader, Arena* arena) {
    uint32_t str_len = mpack_expect_str(reader);
    if (mpack_reader_error(reader) != mpack_ok) {
        return MP_ERR_TYPE;
    }
    
    const char* str = (const char*)arena_alloc(arena, str_len + 1);
    if (!str) {
        return MP_ERR_NOMEM;
    }
    
    mpack_read_bytes(reader, (char*)str, str_len);
    ((char*)str)[str_len] = '\0';
    
    if (mpack_reader_error(reader) != mpack_ok) {
        return MP_ERR_TRUNCATED;
    }
    
    *field = str;
    return MP_OK;
}

// Individual field handlers
static mp_status handle_title(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->title, reader, arena);
}

static mp_status handle_artist(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->artist, reader, arena);
}

static mp_status handle_album(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->album, reader, arena);
}

static mp_status handle_genre(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->genre, reader, arena);
}

static mp_status handle_comment(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->comment, reader, arena);
}

static mp_status handle_album_artist(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->albumArtist, reader, arena);
}

static mp_status handle_composer(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    return decode_string_field(&tags->composer, reader, arena);
}

static mp_status handle_year(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->year = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_track(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->track = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_disc(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->disc = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_bpm(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->bpm = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_bitrate(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->bitrate = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_sample_rate(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->sampleRate = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_channels(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->channels = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_length(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->length = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

static mp_status handle_length_ms(TagData* tags, mpack_reader_t* reader, Arena* arena) {
    tags->lengthMs = mpack_expect_uint(reader);
    return mpack_reader_error(reader) == mpack_ok ? MP_OK : MP_ERR_TYPE;
}

// Field handler lookup table - O(1) lookup with perfect hash
typedef struct {
    const char* key;
    field_handler_t handler;
} field_map_entry_t;

static const field_map_entry_t FIELD_HANDLERS[] = {
    {"album", handle_album},
    {"albumArtist", handle_album_artist},
    {"artist", handle_artist},
    {"bitrate", handle_bitrate},
    {"bpm", handle_bpm},
    {"channels", handle_channels},
    {"comment", handle_comment},
    {"composer", handle_composer},
    {"disc", handle_disc},
    {"genre", handle_genre},
    {"length", handle_length},
    {"lengthMs", handle_length_ms},
    {"sampleRate", handle_sample_rate},
    {"title", handle_title},
    {"track", handle_track},
    {"year", handle_year},
};

static const size_t FIELD_HANDLER_COUNT = sizeof(FIELD_HANDLERS) / sizeof(FIELD_HANDLERS[0]);

// Find field handler using binary search (keys are sorted)
static field_handler_t find_field_handler(const char* key) {
    // Binary search through sorted handler table
    int left = 0;
    int right = FIELD_HANDLER_COUNT - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int cmp = strcmp(key, FIELD_HANDLERS[mid].key);
        
        if (cmp == 0) {
            return FIELD_HANDLERS[mid].handler;
        } else if (cmp < 0) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    return NULL; // Unknown field
}

// Decode from buffer - refactored with field handlers
mp_status tags_decode(const uint8_t* buf, size_t len, Arena* arena, TagData** out) {
    if (!buf || !arena || !out) {
        return MP_ERR_INVALID_DATA;
    }
    
    mpack_reader_t reader;
    mpack_reader_init_data(&reader, (const char*)buf, len);
    
    // Allocate TagData structure
    TagData* tags = (TagData*)arena_alloc(arena, sizeof(TagData));
    if (!tags) {
        mpack_reader_destroy(&reader);
        return MP_ERR_NOMEM;
    }
    memset(tags, 0, sizeof(TagData));
    
    // Read map
    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return MP_ERR_TYPE;
    }
    
    // Process each key-value pair
    for (uint32_t i = 0; i < map_count; i++) {
        // Read key
        uint32_t key_len = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) {
            mpack_reader_destroy(&reader);
            return MP_ERR_TYPE;
        }
        
        // Allocate key buffer
        char* key = (char*)arena_alloc(arena, key_len + 1);
        if (!key) {
            mpack_reader_destroy(&reader);
            return MP_ERR_NOMEM;
        }
        
        mpack_read_bytes(&reader, key, key_len);
        key[key_len] = '\0';
        
        if (mpack_reader_error(&reader) != mpack_ok) {
            mpack_reader_destroy(&reader);
            return MP_ERR_TRUNCATED;
        }
        
        // Find and invoke field handler
        field_handler_t handler = find_field_handler(key);
        if (handler) {
            mp_status status = handler(tags, &reader, arena);
            if (status != MP_OK) {
                mpack_reader_destroy(&reader);
                return status;
            }
        } else {
            // Unknown field - skip value gracefully
            mpack_discard(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) {
                mpack_reader_destroy(&reader);
                return MP_ERR_TYPE;
            }
        }
    }
    
    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_error(&reader);
    mpack_reader_destroy(&reader);
    
    if (error != mpack_ok) {
        switch (error) {
            case mpack_error_type: return MP_ERR_TYPE;
            case mpack_error_data: return MP_ERR_TRUNCATED;
            default: return MP_ERR_INTERNAL;
        }
    }
    
    *out = tags;
    return MP_OK;
}

// Stream encoding variant
mp_status tags_encode_stream(const TagData* tags, mp_write_fn write, void* ctx) {
    if (!tags || !write) {
        return MP_ERR_INVALID_DATA;
    }
    
    // Use growable buffer first
    mpack_writer_t writer;
    char* data = NULL;
    size_t size = 0;
    mpack_writer_init_growable(&writer, &data, &size);
    
    // Encode as before
    mpack_start_map(&writer, 16);
    
    mpack_write_cstr(&writer, "title");
    mpack_write_cstr(&writer, tags->title ? tags->title : "");
    mpack_write_cstr(&writer, "artist");
    mpack_write_cstr(&writer, tags->artist ? tags->artist : "");
    mpack_write_cstr(&writer, "album");
    mpack_write_cstr(&writer, tags->album ? tags->album : "");
    mpack_write_cstr(&writer, "year");
    mpack_write_uint(&writer, tags->year);
    mpack_write_cstr(&writer, "track");
    mpack_write_uint(&writer, tags->track);
    mpack_write_cstr(&writer, "genre");
    mpack_write_cstr(&writer, tags->genre ? tags->genre : "");
    mpack_write_cstr(&writer, "comment");
    mpack_write_cstr(&writer, tags->comment ? tags->comment : "");
    mpack_write_cstr(&writer, "albumArtist");
    mpack_write_cstr(&writer, tags->albumArtist ? tags->albumArtist : "");
    mpack_write_cstr(&writer, "composer");
    mpack_write_cstr(&writer, tags->composer ? tags->composer : "");
    mpack_write_cstr(&writer, "disc");
    mpack_write_uint(&writer, tags->disc);
    mpack_write_cstr(&writer, "bpm");
    mpack_write_uint(&writer, tags->bpm);
    mpack_write_cstr(&writer, "bitrate");
    mpack_write_uint(&writer, tags->bitrate);
    mpack_write_cstr(&writer, "sampleRate");
    mpack_write_uint(&writer, tags->sampleRate);
    mpack_write_cstr(&writer, "channels");
    mpack_write_uint(&writer, tags->channels);
    mpack_write_cstr(&writer, "length");
    mpack_write_uint(&writer, tags->length);
    mpack_write_cstr(&writer, "lengthMs");
    mpack_write_uint(&writer, tags->lengthMs);
    
    mpack_finish_map(&writer);
    
    mpack_error_t error = mpack_writer_error(&writer);
    if (error != mpack_ok) {
        mpack_writer_destroy(&writer);
        return MP_ERR_INTERNAL;
    }
    
    // Destroy the writer to get the data buffer
    mpack_writer_destroy(&writer);
    
    if (!data || size == 0) {
        return MP_ERR_INTERNAL;
    }
    
    // Stream the data
    size_t written = write((const uint8_t*)data, size, ctx);
    
    // Free the allocated buffer
    free(data);
    
    return (written == size) ? MP_OK : MP_ERR_INTERNAL;
}

// Format-specific optimizations - for now, use same implementation
mp_status encode_mp3_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len) {
    return tags_encode(tags, buf, buf_cap, out_len);
}

mp_status encode_flac_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len) {
    return tags_encode(tags, buf, buf_cap, out_len);
}

mp_status encode_m4a_tags(const TagData* tags, uint8_t* buf, size_t buf_cap, size_t* out_len) {
    return tags_encode(tags, buf, buf_cap, out_len);
}