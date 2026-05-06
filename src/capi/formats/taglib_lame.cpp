// src/capi/formats/taglib_lame.cpp
#include "taglib_lame.h"
#include <cstring>

namespace taglib_wasm {

namespace {

// Returns the offset within the MPEG frame where the Xing/Info magic should appear.
// Anchored to the start of the side-info area, which depends on MPEG version + channel mode.
//   MPEG-1 stereo:        0x24 (36)
//   MPEG-1 mono:          0x15 (21)
//   MPEG-2/2.5 stereo:    0x15 (21)
//   MPEG-2/2.5 mono:      0x0D (13)
size_t sideInfoOffset(int mpegVersion, int channelMode) {
    bool isMono = (channelMode == 3); // SingleChannel
    bool isV1 = (mpegVersion == 0);   // Version1
    if (isV1) {
        return isMono ? 0x15 : 0x24;
    }
    return isMono ? 0x0D : 0x15;
}

bool magicAt(const unsigned char* p, size_t available, const char* magic) {
    if (available < 4) return false;
    return p[0] == static_cast<unsigned char>(magic[0])
        && p[1] == static_cast<unsigned char>(magic[1])
        && p[2] == static_cast<unsigned char>(magic[2])
        && p[3] == static_cast<unsigned char>(magic[3]);
}

} // anonymous namespace

LameInfo parseLameInfo(const unsigned char* frame, size_t frameLen,
                       int mpegVersion, int channelMode) {
    LameInfo result;
    if (!frame || frameLen == 0) return result;

    // VBRI magic is at fixed offset 0x24 regardless of channel mode.
    // Fraunhofer encoders write VBRI and never include a LAME tag.
    if (frameLen >= 0x28 && magicAt(frame + 0x24, frameLen - 0x24, "VBRI")) {
        result.mode = BitrateMode::VBR;
        result.valid = true;
        return result;
    }

    size_t magicOffset = sideInfoOffset(mpegVersion, channelMode);
    if (frameLen < magicOffset + 4) return result;

    BitrateMode preliminary;
    if (magicAt(frame + magicOffset, frameLen - magicOffset, "Info")) {
        preliminary = BitrateMode::CBR;
    } else if (magicAt(frame + magicOffset, frameLen - magicOffset, "Xing")) {
        preliminary = BitrateMode::VBR;
    } else {
        return result; // no recognized magic
    }

    result.mode = preliminary;
    result.valid = true;

    // LAME magic at offset 0x78 from Xing/Info magic.
    // VBR method byte at offset 0x81 from Xing/Info magic.
    // Need at least magicOffset + 0x82 bytes to safely read the method byte.
    size_t lameMagicOffset = magicOffset + 0x78;
    size_t methodByteOffset = magicOffset + 0x81;
    if (frameLen < methodByteOffset + 1) return result;
    if (!magicAt(frame + lameMagicOffset, frameLen - lameMagicOffset, "LAME")) return result;

    unsigned char methodByte = frame[methodByteOffset];
    unsigned char vbrMethod = methodByte & 0x0F;
    switch (vbrMethod) {
        case 1: case 8: result.mode = BitrateMode::CBR; break;
        case 2: case 9: result.mode = BitrateMode::ABR; break;
        case 3: case 4: case 5: case 6: result.mode = BitrateMode::VBR; break;
        default: break; // 0 or unknown: keep preliminary
    }
    return result;
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
