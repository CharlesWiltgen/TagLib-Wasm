/**
 * @fileoverview C++ Shim Layer - Minimal stub for WASI binary testing
 * 
 * This version stubs TagLib calls to test the MessagePack + WASI architecture.
 * Once this works, TagLib Wasm EH can be fixed separately.
 */

#include "taglib_shim.h"
#include "core/taglib_msgpack.h"
#include "core/taglib_core.h"

#include <memory>
#include <string>
#include <cstring>

// Minimal stub - all TagLib functionality removed for testing

// C++ Shim Functions (compiled with -fwasm-exceptions)
extern "C" {

tl_error_code taglib_read_shim(const char* path, const uint8_t* buf, size_t len,
                               tl_format format, uint8_t** out_buf, size_t* out_size) {
    // Minimal stub for testing WASI + MessagePack architecture
    
    if (!out_buf || !out_size) {
        return TL_ERROR_INVALID_INPUT;
    }
    
    // Create test TagData
    TagData test_data = {0};
    test_data.title = path ? path : "buffer_test";
    test_data.artist = "Test Artist";
    test_data.album = "Test Album";
    test_data.year = 2024;
    test_data.track = 1;
    test_data.bitrate = 320;
    test_data.sampleRate = 44100;
    test_data.channels = 2;
    test_data.length = 180;
    test_data.lengthMs = 180000;
    
    // Encode to MessagePack
    size_t required_size;
    mp_status status = tags_encode_size(&test_data, &required_size);
    if (status != MP_OK) {
        return TL_ERROR_SERIALIZE_FAILED;
    }
    
    uint8_t* buffer = (uint8_t*)malloc(required_size);
    if (!buffer) {
        return TL_ERROR_MEMORY_ALLOCATION;
    }
    
    size_t actual_size;
    status = tags_encode(&test_data, buffer, required_size, &actual_size);
    if (status != MP_OK) {
        free(buffer);
        return TL_ERROR_SERIALIZE_FAILED;
    }
    
    *out_buf = buffer;
    *out_size = actual_size;
    
    return TL_SUCCESS;
}

tl_error_code taglib_write_shim(const char* path, const uint8_t* buf, size_t len,
                                const TagData* tag_data) {
    // Minimal stub for testing WASI + MessagePack architecture
    
    if (!tag_data) {
        return TL_ERROR_INVALID_INPUT;
    }
    
    // For now, just simulate successful write
    if (path) {
        return TL_SUCCESS; // Simulate file write success
    } else {
        return TL_ERROR_NOT_IMPLEMENTED; // Buffer-to-buffer not supported
    }
}

} // extern "C"