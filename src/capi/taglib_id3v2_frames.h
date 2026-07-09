#ifndef TAGLIB_ID3V2_FRAMES_H
#define TAGLIB_ID3V2_FRAMES_H

#include "core/taglib_core.h"
#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib { class File; }

// Serialize raw ID3v2 frames to msgpack array [{id, data, flags}].
// id_filter: NULL or "" = all frames; else exact 4-char frame ID match.
// MP3 only: returns TL_ERROR_UNSUPPORTED_FORMAT for other formats.
tl_error_code read_id3v2_frames_to_msgpack(
    TagLib::File* file, const char* id_filter,
    uint8_t** out_buf, size_t* out_size);

// Save-path handler for the declarative "id3v2Frames" tagData key
// ({id: [bin, ...]}): per-ID replace with synthesized UnknownFrames.
// out_needs_no_duplicate (may be NULL): set to true if any NON-EMPTY body
// list was applied to an ID3v1-mapped frame ID (see ID3V1_MAPPED_FRAME_IDS
// in this file and its twin in build/taglib_embind.cpp) — removals/empty
// lists do NOT set it, since after removeFrames no raw frame is at risk and
// normal ID3v1/ID3v2 duplication is desired. The caller must skip the
// default Duplicate save mode when this comes back true (see
// taglib_shim.cpp write_to_path/write_to_buffer).
tl_error_code apply_id3v2_frames_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len,
    bool* out_needs_no_duplicate = nullptr);

#endif

#endif // TAGLIB_ID3V2_FRAMES_H
