/**
 * @fileoverview Shared declarations for the WASI C++ shim.
 *
 * Split out of taglib_shim.cpp (taglib-1zc.b6d): the PropertyMap field table,
 * its binary-search lookup, and the buffer-mode file factory are used by both
 * the read and write halves.
 */
#ifndef TAGLIB_SHIM_COMMON_H
#define TAGLIB_SHIM_COMMON_H

#include <cstddef>
#include <cstdint>

#include <tfile.h>
#include <tiostream.h>
#include <tpropertymap.h>

#include "core/taglib_core.h"

// The PropertyMap surface is the RAW text surface: every text property crosses
// the wire as the string TagLib holds, so "03" and "3/12" survive intact
// (taglib-qpl). Numeric narrowing belongs to the typed surfaces and happens in
// JS — `mapPropertiesToExtendedTag` (src/utils/tag-mapping.ts) for readTags(),
// and the `track`/`year` mirrors below for tag(). There is deliberately NO
// numeric field type here: encoding a track as an int discards the original
// string irrecoverably, and on formats with no int-pair split (FLAC/Ogg/WAV)
// that silently destroyed the total on a read-modify-write.
enum FieldType : uint8_t {
    FIELD_STRING  = 0,
    FIELD_BOOLEAN = 1,
};

struct FieldMapping {
    const char* prop;   // UPPERCASE TagLib property key (sorted for binary search)
    const char* camel;  // camelCase JS key
    FieldType type;     // how to encode/decode the value
};


extern const FieldMapping FIELD_MAP[];
extern const size_t FIELD_MAP_SIZE;

/** Binary-search the sorted FIELD_MAP; nullptr when the key is not a modeled property. */
const FieldMapping* find_by_prop(const char* key);

/** Construct the TagLib file class for a detected format over a stream. */
TagLib::File* create_file_for_format(tl_format format, TagLib::IOStream* stream);

#endif // TAGLIB_SHIM_COMMON_H
