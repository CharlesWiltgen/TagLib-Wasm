/**
 * @fileoverview C++ Shim Header - Exception Boundary
 * 
 * Declares C functions implemented in C++ with exception handling.
 * This shim catches TagLib exceptions and returns C error codes.
 */

#ifndef TAGLIB_SHIM_H
#define TAGLIB_SHIM_H

#include "core/taglib_core.h"
#include "core/taglib_msgpack.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Read tags through C++ shim with exception handling
 * @param path File path (NULL for buffer mode)
 * @param buf Buffer data (NULL for file mode)
 * @param len Buffer length
 * @param format Format hint
 * @param out_buf Output buffer (caller must free)
 * @param out_size Output buffer size
 * @return Error code
 */
tl_error_code taglib_read_shim(const char* path, const uint8_t* buf, size_t len,
                               tl_format format, uint8_t** out_buf, size_t* out_size);

/**
 * Write tags through C++ shim with exception handling
 * @param path File path (NULL for buffer mode)
 * @param buf Buffer data (NULL for file mode)
 * @param len Buffer length
 * @param tags_msgpack Raw msgpack bytes encoding tag data
 * @param tags_msgpack_len Length of msgpack bytes
 * @param out_buf Output buffer for buffer-to-buffer writes (caller must free)
 * @param out_size Output buffer size
 * @return Error code
 */
tl_error_code taglib_write_shim(const char* path, const uint8_t* buf, size_t len,
                                const uint8_t* tags_msgpack, size_t tags_msgpack_len,
                                uint8_t** out_buf, size_t* out_size);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_SHIM_H