#ifndef TAGLIB_ID3_STRIP_H
#define TAGLIB_ID3_STRIP_H

#include "core/taglib_core.h"
#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib { class File; }

// Returns 1 if the file is a FLAC with any ID3v1/v2 tag attached, else 0.
// Used to size the top-level msgpack map for read output.
uint32_t count_id3_strip_keys(TagLib::File* file);

// Emits "id3Tags": { "v1": bool, "v2": bool } when the file is a FLAC with
// any ID3 tag. No-op otherwise.
void encode_id3_strip(mpack_writer_t* writer, TagLib::File* file);

// Reads the "_stripId3": { "v1": bool, "v2": bool } write-time directive.
// When present and the file is a FLAC, calls strip(mask) with the requested
// tag-type flags. Other keys are discarded. No-op for non-FLAC files.
tl_error_code apply_id3_strip_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len);

#endif

#endif // TAGLIB_ID3_STRIP_H
