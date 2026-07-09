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
tl_error_code apply_id3v2_frames_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len);

#endif

#endif // TAGLIB_ID3V2_FRAMES_H
