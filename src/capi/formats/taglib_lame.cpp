// src/capi/formats/taglib_lame.cpp
#include "taglib_lame.h"

namespace taglib_wasm {

LameInfo parseLameInfo(const unsigned char* frame, size_t frameLen,
                       int mpegVersion, int channelMode) {
    (void)frame;
    (void)frameLen;
    (void)mpegVersion;
    (void)channelMode;
    return LameInfo{}; // {mode=Unknown, valid=false}
}

const char* modeString(BitrateMode mode) {
    switch (mode) {
        case BitrateMode::CBR: return "CBR";
        case BitrateMode::VBR: return "VBR";
        case BitrateMode::ABR: return "ABR";
        case BitrateMode::Unknown: return nullptr;
    }
    return nullptr;
}

} // namespace taglib_wasm
