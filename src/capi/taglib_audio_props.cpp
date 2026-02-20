#include "taglib_audio_props.h"

#include <tfile.h>
#include <audioproperties.h>
#include <mpack/mpack.h>

#include <mpeg/mpegfile.h>
#include <flac/flacfile.h>
#include <flac/flacproperties.h>
#include <mp4/mp4file.h>
#include <mp4/mp4properties.h>
#include <ogg/vorbis/vorbisfile.h>
#include <ogg/opus/opusfile.h>
#include <riff/wav/wavfile.h>
#include <riff/wav/wavproperties.h>
#include <riff/aiff/aifffile.h>
#include <riff/aiff/aiffproperties.h>

ExtendedAudioInfo get_extended_audio_info(
    TagLib::File* file, TagLib::AudioProperties* /* audio */)
{
    ExtendedAudioInfo info = {0, "", "", false};

    if (dynamic_cast<TagLib::MPEG::File*>(file)) {
        info.codec = "MP3";
        info.container = "MP3";
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::FLAC::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "FLAC";
        info.container = "FLAC";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::MP4::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.bitsPerSample = props->bitsPerSample();
            if (props->codec() == TagLib::MP4::Properties::ALAC) {
                info.codec = "ALAC";
                info.isLossless = true;
            } else {
                info.codec = "AAC";
            }
        }
        info.container = "MP4";
        return info;
    }

    if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(file)) {
        info.codec = "Vorbis";
        info.container = "OGG";
        return info;
    }

    if (dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
        info.codec = "Opus";
        info.container = "OGG";
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "PCM";
        info.container = "WAV";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::RIFF::AIFF::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "PCM";
        info.container = "AIFF";
        info.isLossless = true;
        return info;
    }

    return info;
}

uint32_t count_extended_audio_fields(const ExtendedAudioInfo& info) {
    uint32_t count = 0;
    if (info.bitsPerSample > 0) count++;
    if (info.codec[0] != '\0') count++;
    if (info.container[0] != '\0') count++;
    count++; // isLossless always written
    return count;
}

uint32_t encode_extended_audio(
    mpack_writer_t* writer, const ExtendedAudioInfo& info)
{
    uint32_t written = 0;

    if (info.bitsPerSample > 0) {
        mpack_write_cstr(writer, "bitsPerSample");
        mpack_write_uint(writer, static_cast<uint32_t>(info.bitsPerSample));
        written++;
    }

    if (info.codec[0] != '\0') {
        mpack_write_cstr(writer, "codec");
        mpack_write_cstr(writer, info.codec);
        written++;
    }

    if (info.container[0] != '\0') {
        mpack_write_cstr(writer, "containerFormat");
        mpack_write_cstr(writer, info.container);
        written++;
    }

    mpack_write_cstr(writer, "isLossless");
    mpack_write_bool(writer, info.isLossless);
    written++;

    return written;
}
