/**
 * Minimal WASI test binary for unified loader demonstration
 * 
 * This is a temporary test binary to validate the Phase 3 unified loader
 * functionality while we work on the full TagLib-WASI integration.
 */

#include <cstdint>
#include <cstring>
#include <cstdlib>

// Export C functions for WASI
extern "C" {

// Basic TagLib API stubs for testing
const char* tl_version() {
    return "3.0.0-wasi-test";
}

int32_t tl_read_tags(
    uint32_t path_ptr,
    uint8_t* buf_ptr,
    uint32_t buf_len,
    uint32_t* out_size_ptr
) {
    // Return test data (MessagePack encoded)
    // This is a simple MessagePack map: {"title": "Test Song", "artist": "Test Artist"}
    static const uint8_t test_data[] = {
        0x82, // fixmap with 2 items
        0xa5, 0x74, 0x69, 0x74, 0x6c, 0x65, // "title"
        0xa9, 0x54, 0x65, 0x73, 0x74, 0x20, 0x53, 0x6f, 0x6e, 0x67, // "Test Song"
        0xa6, 0x61, 0x72, 0x74, 0x69, 0x73, 0x74, // "artist"
        0xab, 0x54, 0x65, 0x73, 0x74, 0x20, 0x41, 0x72, 0x74, 0x69, 0x73, 0x74 // "Test Artist"
    };
    
    const uint32_t test_data_size = sizeof(test_data);
    
    if (buf_ptr && buf_len >= test_data_size) {
        std::memcpy(buf_ptr, test_data, test_data_size);
    }
    
    if (out_size_ptr) {
        *out_size_ptr = test_data_size;
    }
    
    return buf_len >= test_data_size ? 0 : -1; // 0 = success, -1 = buffer too small
}

int32_t tl_write_tags(
    uint32_t path_ptr,
    uint8_t* buf_ptr,
    uint32_t buf_len,
    uint8_t* tags_ptr,
    uint32_t tags_size,
    uint8_t** out_buf_ptr,
    uint32_t* out_size_ptr
) {
    // For testing, just return success
    if (out_size_ptr) {
        *out_size_ptr = buf_len;
    }
    return 0; // Success
}

void tl_free(void* ptr) {
    std::free(ptr);
}

// Error handling
int32_t tl_get_last_error() {
    return 0; // No error
}

int32_t tl_get_last_error_code() {
    return 0; // No error
}

void tl_clear_error() {
    // No-op for test
}

// Format detection
int32_t tl_detect_format(uint8_t* buf_ptr, uint32_t len) {
    // Return MP3 format (1) for testing
    return 1;
}

uint32_t tl_format_name(int32_t format) {
    // Return pointer to static string
    static const char* mp3_name = "MP3";
    return reinterpret_cast<uint32_t>(mp3_name);
}

// Additional test exports
int32_t tl_read_tags_ex(
    uint32_t path_ptr,
    uint8_t* buf_ptr,
    uint32_t buf_len,
    int32_t format,
    uint32_t* out_size_ptr
) {
    // Delegate to basic read_tags for test
    return tl_read_tags(path_ptr, buf_ptr, buf_len, out_size_ptr);
}

} // extern "C"