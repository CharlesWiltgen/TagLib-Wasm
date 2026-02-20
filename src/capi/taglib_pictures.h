#ifndef TAGLIB_PICTURES_H
#define TAGLIB_PICTURES_H

#include "core/taglib_core.h"
#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib { class File; }

uint32_t count_pictures(TagLib::File* file);
void encode_pictures(mpack_writer_t* writer, TagLib::File* file);
tl_error_code apply_pictures_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len);

#endif

#endif // TAGLIB_PICTURES_H
