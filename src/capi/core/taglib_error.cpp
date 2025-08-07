// Error handling for TagLib-Wasm
#include "taglib_core.h"
#include <string>
#include <cstring>

// Thread-local error state
static thread_local std::string g_last_error_message;
static thread_local tl_error_code g_last_error_code = TL_SUCCESS;

// Set error with message
void tl_set_error(tl_error_code code, const char* message) {
    g_last_error_code = code;
    if (message) {
        g_last_error_message = message;
    } else {
        // Default messages for error codes
        switch (code) {
            case TL_SUCCESS:
                g_last_error_message = "Success";
                break;
            case TL_ERROR_INVALID_INPUT:
                g_last_error_message = "Invalid input: Null pointer or zero size";
                break;
            case TL_ERROR_UNSUPPORTED_FORMAT:
                g_last_error_message = "Unsupported audio format";
                break;
            case TL_ERROR_MEMORY_ALLOCATION:
                g_last_error_message = "Memory allocation failed";
                break;
            case TL_ERROR_IO_READ:
                g_last_error_message = "Failed to read file";
                break;
            case TL_ERROR_IO_WRITE:
                g_last_error_message = "Failed to write file";
                break;
            case TL_ERROR_PARSE_FAILED:
                g_last_error_message = "Failed to parse audio file";
                break;
            case TL_ERROR_SERIALIZE_FAILED:
                g_last_error_message = "Failed to serialize tag data";
                break;
            case TL_ERROR_NOT_IMPLEMENTED:
                g_last_error_message = "Feature not yet implemented";
                break;
            default:
                g_last_error_message = "Unknown error";
                break;
        }
    }
}

// Get last error message
const char* tl_get_last_error(void) {
    return g_last_error_message.empty() ? nullptr : g_last_error_message.c_str();
}

// Get last error code
int tl_get_last_error_code(void) {
    return g_last_error_code;
}

// Clear error state
void tl_clear_error(void) {
    g_last_error_code = TL_SUCCESS;
    g_last_error_message.clear();
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

// Capability detection
bool tl_has_capability(const char* capability) {
    if (!capability) return false;
    
    std::string cap(capability);
    
    // List of supported capabilities
    if (cap == "msgpack") return true;
    if (cap == "json") return true;  // Legacy support
    if (cap == "streaming") return true;
    if (cap == "memory-pool") return true;
    if (cap == "format-mp3") return true;
    if (cap == "format-flac") return true;
    if (cap == "format-m4a") return true;
    if (cap == "format-ogg") return true;
    if (cap == "format-wav") return true;
    if (cap == "format-ape") return true;
    if (cap == "format-wavpack") return true;
    if (cap == "format-opus") return true;
    if (cap == "wasi") {
        #ifdef __wasi__
        return true;
        #else
        return false;
        #endif
    }
    
    return false;
}