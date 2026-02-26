// Error handling for TagLib-Wasm - Pure C to avoid std::string EH symbols
#include "taglib_core.h"
#include <string.h>
#include <stdlib.h>

// Simple C error state (no thread_local, no std::string)
static char g_last_error_message[256] = {0};
static tl_error_code g_last_error_code = TL_SUCCESS;

extern "C" {

// Set error with message
void tl_set_error(tl_error_code code, const char* message) {
    g_last_error_code = code;
    if (message) {
        strncpy(g_last_error_message, message, sizeof(g_last_error_message) - 1);
        g_last_error_message[sizeof(g_last_error_message) - 1] = '\0';
    } else {
        // Default messages for error codes
        const char* default_msg = "Unknown error";
        switch (code) {
            case TL_SUCCESS:
                default_msg = "Success";
                break;
            case TL_ERROR_INVALID_INPUT:
                default_msg = "Invalid input: Null pointer or zero size";
                break;
            case TL_ERROR_UNSUPPORTED_FORMAT:
                default_msg = "Unsupported audio format";
                break;
            case TL_ERROR_MEMORY_ALLOCATION:
                default_msg = "Memory allocation failed";
                break;
            case TL_ERROR_IO_READ:
                default_msg = "Failed to read file";
                break;
            case TL_ERROR_IO_WRITE:
                default_msg = "Failed to write file";
                break;
            case TL_ERROR_PARSE_FAILED:
                default_msg = "Failed to parse audio file";
                break;
            case TL_ERROR_SERIALIZE_FAILED:
                default_msg = "Failed to serialize tag data";
                break;
            case TL_ERROR_NOT_IMPLEMENTED:
                default_msg = "Feature not yet implemented";
                break;
        }
        strncpy(g_last_error_message, default_msg, sizeof(g_last_error_message) - 1);
        g_last_error_message[sizeof(g_last_error_message) - 1] = '\0';
    }
}

// Get last error message
const char* tl_get_last_error(void) {
    return g_last_error_message[0] ? g_last_error_message : nullptr;
}

// Get last error code
int tl_get_last_error_code(void) {
    return g_last_error_code;
}

// Clear error state
void tl_clear_error(void) {
    g_last_error_code = TL_SUCCESS;
    g_last_error_message[0] = '\0';
}

// Version information
const char* tl_version(void) {
    #ifdef TAGLIB_VERSION
        return TAGLIB_WASM_VERSION " (TagLib " TAGLIB_VERSION ")";
    #else
        return TAGLIB_WASM_VERSION " (TagLib Unknown)";
    #endif
}

// API version
int tl_api_version(void) {
    return TAGLIB_WASM_API_VERSION;
}

// Capability detection - Pure C implementation
bool tl_has_capability(const char* capability) {
    if (!capability) return false;
    
    // List of supported capabilities - using strcmp instead of std::string
    if (strcmp(capability, "msgpack") == 0) return true;
    if (strcmp(capability, "json") == 0) return true;  // Legacy support
    if (strcmp(capability, "streaming") == 0) return true;
    if (strcmp(capability, "memory-pool") == 0) return true;
    if (strcmp(capability, "format-mp3") == 0) return true;
    if (strcmp(capability, "format-flac") == 0) return true;
    if (strcmp(capability, "format-m4a") == 0) return true;
    if (strcmp(capability, "format-ogg") == 0) return true;
    if (strcmp(capability, "format-wav") == 0) return true;
    if (strcmp(capability, "format-ape") == 0) return true;
    if (strcmp(capability, "format-wavpack") == 0) return true;
    if (strcmp(capability, "format-opus") == 0) return true;
    if (strcmp(capability, "format-aiff") == 0) return true;
    if (strcmp(capability, "format-asf") == 0) return true;
    if (strcmp(capability, "format-dsf") == 0) return true;
    if (strcmp(capability, "format-dsdiff") == 0) return true;
    if (strcmp(capability, "format-mpc") == 0) return true;
    if (strcmp(capability, "format-tta") == 0) return true;
    if (strcmp(capability, "format-shorten") == 0) return true;
    if (strcmp(capability, "format-mod") == 0) return true;
    if (strcmp(capability, "format-s3m") == 0) return true;
    if (strcmp(capability, "format-it") == 0) return true;
    if (strcmp(capability, "format-xm") == 0) return true;
    if (strcmp(capability, "format-speex") == 0) return true;
    if (strcmp(capability, "format-ogg-flac") == 0) return true;
    if (strcmp(capability, "wasi") == 0) {
        #ifdef __wasi__
        return true;
        #else
        return false;
        #endif
    }
    
    return false;
}

} // extern "C"