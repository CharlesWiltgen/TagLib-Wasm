#ifndef TAGLIB_BWF_H
#define TAGLIB_BWF_H

#include "core/taglib_core.h"
#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib { class File; }

// Number of top-level msgpack keys to add for this file: 0, 1, or 2 (one for a
// present bext chunk, one for a present iXML chunk). NOTE: unlike
// count_chapters (which returns an element count for array sizing) this is a
// *key* count for top-level map sizing.
uint32_t count_bwf_keys(TagLib::File* file);

// Emits "bextData" (msgpack bin) and/or "ixml" (msgpack str) when present.
// No-op for non-WAV/FLAC files.
void encode_bwf(mpack_writer_t* writer, TagLib::File* file);

// Reads "bextData" (bin => set; nil => remove) and "ixml" (str => set;
// nil => remove) from the tag blob; other keys discarded. No-op for
// non-WAV/FLAC files.
tl_error_code apply_bwf_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len);

#endif

#endif // TAGLIB_BWF_H
