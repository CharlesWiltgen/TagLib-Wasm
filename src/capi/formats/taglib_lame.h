// src/capi/formats/taglib_lame.h
#ifndef TAGLIB_WASM_LAME_H
#define TAGLIB_WASM_LAME_H

#include <cstddef>

namespace taglib_wasm {

// Minimum bytes of the first MPEG frame that `parseLameInfo` may inspect.
// Callers that read the frame from a TagLib stream should pass at least this
// many bytes to keep parser bounds checks satisfied across all magic types
// (VBRI at 0x24, Xing/Info at 0x24/0x15/0x0D, LAME tag through 0xA5 from magic).
inline constexpr size_t kRequiredFirstFrameBytes = 0x100;

enum class BitrateMode {
    Unknown,
    CBR,
    VBR,
    ABR,
};

struct LameInfo {
    BitrateMode mode = BitrateMode::Unknown;
    bool valid = false;
};

// Parses Xing/Info/VBRI + LAME extension from the bytes of the first MPEG frame.
//
// frame:        pointer to the first frame including the 4-byte MPEG header
// frameLen:     length of the buffer in bytes
// mpegVersion:  TagLib MPEG Header version: 0=Version1, 1=Version2, 2=Version2_5, 3=Version4
// channelMode:  TagLib MPEG ChannelMode: 0=Stereo, 1=JointStereo, 2=DualChannel, 3=SingleChannel
//
// Exception-free: returns a result struct, never throws, no allocations.
LameInfo parseLameInfo(const unsigned char* frame, size_t frameLen,
                       int mpegVersion, int channelMode);

// Returns "CBR", "VBR", "ABR", or nullptr (for Unknown).
const char* modeString(BitrateMode mode);

} // namespace taglib_wasm

#endif // TAGLIB_WASM_LAME_H
