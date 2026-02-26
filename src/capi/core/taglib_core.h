// TagLib-Wasm Core Types and Definitions
// Provides core types, memory management, and error handling
#ifndef TAGLIB_CORE_H
#define TAGLIB_CORE_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Version information
#define TAGLIB_WASM_VERSION "3.0.0"
#define TAGLIB_WASM_API_VERSION 3

// Error codes
typedef enum {
    TL_SUCCESS = 0,
    TL_ERROR_INVALID_INPUT = -1,
    TL_ERROR_UNSUPPORTED_FORMAT = -2,
    TL_ERROR_MEMORY_ALLOCATION = -3,
    TL_ERROR_IO_READ = -4,
    TL_ERROR_IO_WRITE = -5,
    TL_ERROR_PARSE_FAILED = -6,
    TL_ERROR_SERIALIZE_FAILED = -7,
    TL_ERROR_NOT_IMPLEMENTED = -99
} tl_error_code;

// Memory pool handle
typedef struct tl_pool* tl_pool_t;

// Stream handle for large file processing
typedef struct tl_stream* tl_stream_t;

// Format hint for optimized paths
typedef enum {
    TL_FORMAT_AUTO = 0,
    TL_FORMAT_MP3,
    TL_FORMAT_FLAC,
    TL_FORMAT_M4A,
    TL_FORMAT_OGG,
    TL_FORMAT_WAV,
    TL_FORMAT_APE,
    TL_FORMAT_WV,
    TL_FORMAT_OPUS,
    TL_FORMAT_AIFF,
    TL_FORMAT_ASF,
    TL_FORMAT_DSF,
    TL_FORMAT_DSDIFF,
    TL_FORMAT_MPC,
    TL_FORMAT_TTA,
    TL_FORMAT_SHN,
    TL_FORMAT_MOD,
    TL_FORMAT_S3M,
    TL_FORMAT_IT,
    TL_FORMAT_XM,
    TL_FORMAT_OGG_FLAC,
    TL_FORMAT_SPEEX
} tl_format;

// Core memory management functions
tl_pool_t tl_pool_create(size_t initial_size);
void* tl_pool_alloc(tl_pool_t pool, size_t size);
void tl_pool_reset(tl_pool_t pool);
void tl_pool_destroy(tl_pool_t pool);

// Global memory management (for simple cases)
void* tl_malloc(size_t size);
void tl_free(void* ptr);

// Safe memory operations with bounds checking
void* tl_safe_memcpy(void* dest, const void* src, size_t n);
void* tl_safe_memset(void* s, int c, size_t n);

// Error handling
const char* tl_get_last_error(void);
int tl_get_last_error_code(void);
void tl_clear_error(void);

// Version and capability detection
const char* tl_version(void);
int tl_api_version(void);
bool tl_has_capability(const char* capability);

// Format detection from buffer magic bytes
tl_format tl_detect_format(const uint8_t* buf, size_t len);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_CORE_H