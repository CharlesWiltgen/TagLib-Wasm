/**
 * @fileoverview WASI C++ shim - read half.
 *
 * Reads TagLib state into the MessagePack snapshot: properties, derived audio
 * fields, pictures, ratings, chapters, BWF, ID3-strip flags, and numeric
 * mirrors. Split out of taglib_shim.cpp (taglib-1zc.b6d).
 */

#include "taglib_shim.h"
#include "taglib_shim_common.h"
#include "taglib_pictures.h"
#include "taglib_ratings.h"
#include "taglib_chapters.h"
#include "taglib_bwf.h"
#include "taglib_id3_strip.h"
#include "taglib_id3v2_frames.h"
#include "taglib_audio_props.h"
#include "taglib_mp4_atoms.h"
#include "taglib_id3_duplicate.h"
#include "taglib_asf_multi_value.h"
#include "taglib_asf_properties.h"
#include "taglib_mp4_advisory.h"
#include "taglib_mp4_genre.h"
#include "taglib_intpair.h"
#include "core/taglib_msgpack.h"
#include "core/taglib_core.h"

#include <fileref.h>
#include <tag.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <tfilestream.h>
#include <audioproperties.h>
#include <mpegfile.h>
#include <flacfile.h>
#include <mp4file.h>
#include <oggfile.h>
#include <vorbisfile.h>
#include <wavfile.h>
#include <opusfile.h>
#include <aifffile.h>
#include <apefile.h>
#include <wavpackfile.h>
#include <mpcfile.h>
#include <asffile.h>
#include <dsffile.h>
#include <trueaudiofile.h>
#include <oggflacfile.h>
#include <speexfile.h>
#include <dsdifffile.h>
#include <shortenfile.h>
#include <modfile.h>
#include <s3mfile.h>
#include <itfile.h>
#include <xmfile.h>
#include <matroskafile.h>

#include <mpack/mpack.h>

#include <memory>
#include <cstring>
#include <cstdlib>


#include <string>

static void write_mpack_string(mpack_writer_t* w, const TagLib::String& s) {
    std::string utf8 = s.to8Bit(true);
    mpack_write_str(w, utf8.c_str(), static_cast<uint32_t>(utf8.size()));
}

// NOTE: there is deliberately no int-pair SPLIT here any more. (The
// write-side fold lives in taglib_intpair.h and runs before the save.)
//
// The shim used to rewrite an "n/total" TRACKNUMBER into TRACKNUMBER + TRACKTOTAL
// on read for MPEG/MP4 and merge it back on write. Emscripten never did, so the
// SAME FILE reported trackNumber "3" + totalTracks 12 on one backend and "3/12"
// on the other — and once the raw string became a public typed field, the same
// input produced different FILES per backend (taglib-asg, taglib-febo).
//
// The raw string is now canonical everywhere: the PropertyMap crosses this layer
// untouched and TagLib decides how to store it, so both backends agree by
// construction rather than by us keeping two transformations in sync. Narrowing
// a pair into number + total is the typed surface's job and happens in
// src/utils/tag-mapping.ts, where it is additive and cannot destroy the raw value.

static tl_error_code encode_file_to_msgpack(TagLib::File* file,
                                            uint8_t** out_buf, size_t* out_size) {
    TagLib::PropertyMap props = file->properties();
    // TagUnion reports ID3v2's map alone, so an MP3 value living only in ID3v1
    // would be invisible here — and therefore absent from the snapshot the save
    // path writes back, which erased it (taglib-nft5).
    taglib_wasm::merge_id3v1_only_properties(file, props);
    // Untranslated ASF attributes (ReplayGain, ITUNESADVISORY, ...) never
    // crossed the wire before; surface them verbatim (taglib-984r).
    taglib_wasm::merge_asf_unsupported_properties(file, props);
    // MP4 content advisory lives in the rtng item, invisible to the property
    // map; surface it under the ITUNESADVISORY key (native wins) (taglib-an30).
    taglib_wasm::merge_mp4_rtng_advisory(file, props);
    TagLib::AudioProperties* audio = file->audioProperties();

    uint32_t count = 0;
    for (auto it = props.begin(); it != props.end(); ++it) {
        if (!it->second.isEmpty()) count++;
    }
    if (audio) count += 5;

    // Foreign-mean freeform atoms ride the snapshot under their full atom
    // names — the PropertyMap cannot carry them at all (taglib-5ibr).
    const auto foreign_items = collect_mp4_foreign_items(file);
    count += static_cast<uint32_t>(foreign_items.size());

    uint32_t pic_count = count_pictures(file);
    if (pic_count > 0) count++;  // "pictures" key + array

    uint32_t rating_count = count_ratings(file);
    if (rating_count > 0) count++;  // "ratings" key + array


    uint32_t chapter_count = count_chapters(file);
    if (chapter_count > 0) count++;  // "chapters" key + array

    uint32_t bwf_keys = count_bwf_keys(file);
    count += bwf_keys;  // "bextData" and/or "ixml" keys (WAV/FLAC)

    uint32_t id3_strip_keys = count_id3_strip_keys(file);
    count += id3_strip_keys;  // "id3Tags" key (FLAC with ID3 attached)

    // DATE and TRACKNUMBER cross the wire as their raw strings ("1975-10-31",
    // "3/12"). Each also gets a numeric mirror so Tag.year / tag().track and the
    // fast-read path keep getting a number without re-parsing; the leading
    // integer is exactly what those surfaces promise. Guarded on a parseable,
    // non-zero value.
    //
    // Resolved ONCE here and reused when writing below: looking the keys up
    // again in the write phase both repeated the map traversal and let the two
    // phases drift, which would desync mpack_start_map(count) from the keys
    // actually written and corrupt the stream (taglib-iyfr).
    struct NumericMirror {
        const char* prop_key;   // uppercase PropertyMap key holding the raw value
        const char* out_key;    // camelCase mirror key on the wire
        int value;              // narrowed value, only valid when emit is true
        bool emit;
    };
    NumericMirror mirrors[] = {
        {"DATE", "year", 0, false},
        {"TRACKNUMBER", "track", 0, false},
    };
    for (auto& mirror : mirrors) {
        auto it = props.find(mirror.prop_key);
        if (it == props.end() || it->second.isEmpty()) continue;
        const int narrowed = it->second.front().toInt();
        if (narrowed <= 0) continue;
        mirror.value = narrowed;
        mirror.emit = true;
        count++;
    }

    ExtendedAudioInfo ext_info = {0, "", "", false, 0, 0, false, 0, nullptr};
    if (audio) {
        ext_info = get_extended_audio_info(file, audio);
        count += count_extended_audio_fields(ext_info);
    }

    mpack_writer_t writer;
    char* data = nullptr;
    size_t size = 0;
    mpack_writer_init_growable(&writer, &data, &size);
    mpack_start_map(&writer, count);

    for (auto it = props.begin(); it != props.end(); ++it) {
        if (it->second.isEmpty()) continue;

        std::string propKey = it->first.to8Bit(true);
        const FieldMapping* mapping = find_by_prop(propKey.c_str());
        const char* outKey = mapping ? mapping->camel : propKey.c_str();

        mpack_write_cstr(&writer, outKey);

        if (mapping && mapping->type == FIELD_BOOLEAN) {
            // Canonical "1"/"0" strings end to end (taglib-c9b): the raw
            // surface contract is string[] ("1"/"0" — what the write side
            // emits), so a bool here made JS String() it to "true"/"false"
            // and the typed mapper's "1" check read written-true as false.
            // The "true" spelling is accepted for free-text COMPILATION
            // fields written by other tools (TagLib's own MP4 Bool items
            // render as "1"/"0", mp4itemfactory.cpp); normalizing it here
            // keeps WASI's raw surface canonical like Emscripten's.
            TagLib::String raw = it->second.front();
            write_mpack_string(&writer, raw == "1" || raw == "true" ? "1" : "0");
        } else {
            const TagLib::StringList& values = it->second;
            if (values.size() == 1) {
                write_mpack_string(&writer, values.front());
            } else {
                mpack_start_array(&writer, static_cast<uint32_t>(values.size()));
                for (const auto& s : values) {
                    write_mpack_string(&writer, s);
                }
                mpack_finish_array(&writer);
            }
        }
    }

    for (const auto& [name, values] : foreign_items) {
        mpack_write_cstr(&writer, name.c_str());
        if (values.size() == 1) {
            write_mpack_string(&writer, values.front());
        } else {
            mpack_start_array(&writer, static_cast<uint32_t>(values.size()));
            for (const auto& s : values) {
                write_mpack_string(&writer, s);
            }
            mpack_finish_array(&writer);
        }
    }

    for (const auto& mirror : mirrors) {
        if (!mirror.emit) continue;
        mpack_write_cstr(&writer, mirror.out_key);
        mpack_write_uint(&writer, static_cast<uint32_t>(mirror.value));
    }

    if (audio) {
        mpack_write_cstr(&writer, "bitrate");
        mpack_write_uint(&writer, audio->bitrate());
        mpack_write_cstr(&writer, "sampleRate");
        mpack_write_uint(&writer, audio->sampleRate());
        mpack_write_cstr(&writer, "channels");
        mpack_write_uint(&writer, audio->channels());
        mpack_write_cstr(&writer, "length");
        mpack_write_uint(&writer, audio->lengthInSeconds());
        mpack_write_cstr(&writer, "lengthMs");
        mpack_write_uint(&writer, audio->lengthInMilliseconds());

        encode_extended_audio(&writer, ext_info);
    }

    if (pic_count > 0) {
        encode_pictures(&writer, file);
    }

    if (rating_count > 0) {
        encode_ratings(&writer, file);
    }


    if (chapter_count > 0) {
        encode_chapters(&writer, file);
    }

    encode_bwf(&writer, file);  // emits exactly `bwf_keys` keys (self-guards)

    encode_id3_strip(&writer, file);  // emits "id3Tags" if FLAC has any ID3

    mpack_finish_map(&writer);

    if (mpack_writer_error(&writer) != mpack_ok) {
        mpack_writer_destroy(&writer);
        return TL_ERROR_SERIALIZE_FAILED;
    }
    mpack_writer_destroy(&writer);

    *out_buf = reinterpret_cast<uint8_t*>(data);
    *out_size = size;
    return TL_SUCCESS;
}

static tl_error_code read_from_buffer(const uint8_t* buf, size_t len,
                                      tl_format format,
                                      uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::ByteVector bv(reinterpret_cast<const char*>(buf),
                              static_cast<unsigned int>(len));
        TagLib::ByteVectorStream stream(bv);

        if (format == TL_FORMAT_AUTO) {
            format = tl_detect_format(buf, len);
        }

        std::unique_ptr<TagLib::File> file(create_file_for_format(format, &stream));

        if (file && file->isValid()) {
            // MP4 genre precedence: the string ©gen beats a preceding gnre
            // (taglib-lna2). Reads and the write model share this snapshot, so
            // normalizing at open covers both halves.
            taglib_wasm::resolve_mp4_genre_precedence(file.get());
            return encode_file_to_msgpack(file.get(), out_buf, out_size);
        }

        file.reset();
        TagLib::FileRef ref(&stream);
        if (ref.isNull()) return TL_ERROR_PARSE_FAILED;
        taglib_wasm::resolve_mp4_genre_precedence(ref.file());
        return encode_file_to_msgpack(ref.file(), out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

static tl_error_code read_from_path(const char* path,
                                    uint8_t** out_buf, size_t* out_size) {
    try {
        TagLib::FileRef ref(path);
        if (ref.isNull()) return TL_ERROR_IO_READ;

        // Same rule in path mode (no bytes held by the TS layer here, which is
        // why the fix lives in this boundary rather than above it).
        taglib_wasm::resolve_mp4_genre_precedence(ref.file());
        return encode_file_to_msgpack(ref.file(), out_buf, out_size);
    } catch (...) {
        return TL_ERROR_PARSE_FAILED;
    }
}

extern "C" {

tl_error_code taglib_read_shim(const char* path, const uint8_t* buf, size_t len,
                               tl_format format, uint8_t** out_buf, size_t* out_size) {
    if (!out_buf || !out_size) {
        return TL_ERROR_INVALID_INPUT;
    }

    *out_buf = nullptr;
    *out_size = 0;

    if (path && path[0] != '\0') {
        return read_from_path(path, out_buf, out_size);
    } else if (buf && len > 0) {
        return read_from_buffer(buf, len, format, out_buf, out_size);
    } else {
        return TL_ERROR_INVALID_INPUT;
    }
}

} // extern "C"
