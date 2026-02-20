#ifndef TAGLIB_RATINGS_H
#define TAGLIB_RATINGS_H

#include "core/taglib_core.h"
#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib { class File; }

uint32_t count_ratings(TagLib::File* file);
void encode_ratings(mpack_writer_t* writer, TagLib::File* file);
tl_error_code apply_ratings_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len);

#endif

#endif // TAGLIB_RATINGS_H
