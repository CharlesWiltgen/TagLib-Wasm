// Minimal C API for TagLib-Wasm
// Phase 0 Proof-of-Concept
// This replaces Embind with a simple C interface that works for both WASI and Emscripten

#ifndef TAGLIB_API_H
#define TAGLIB_API_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// Read tags from either a file path or buffer
// If path is non-NULL, use the host filesystem; otherwise read from buffer
// Returns malloc'd UTF-8 JSON string; caller must free with tl_free()
char* tl_read_tags(const char* path, const uint8_t* buf, size_t len);

// Write tags to either a file path or buffer
// Returns 0 on success, -1 on error
// If path is NULL and buf is non-NULL, returns modified buffer size in *out_len
int tl_write_tags(const char* path, const uint8_t* buf, size_t len, 
                  const char* json_tags, uint8_t** out_buf, size_t* out_len);

// Memory management
void tl_free(void* ptr);

// Version info
const char* tl_version(void);

// Error handling
const char* tl_get_last_error(void);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_API_H