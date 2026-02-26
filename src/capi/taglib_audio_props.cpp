#include "taglib_audio_props.h"

#include <tfile.h>
#include <audioproperties.h>
#include <mpack/mpack.h>

#include <mpeg/mpegfile.h>
#include <mpeg/mpegproperties.h>
#include <mpeg/mpegheader.h>
#include <flac/flacfile.h>
#include <flac/flacproperties.h>
#include <mp4/mp4file.h>
#include <mp4/mp4properties.h>
#include <ogg/vorbis/vorbisfile.h>
#include <ogg/opus/opusfile.h>
#include <ogg/flac/oggflacfile.h>
#include <ogg/speex/speexfile.h>
#include <riff/wav/wavfile.h>
#include <riff/wav/wavproperties.h>
#include <riff/aiff/aifffile.h>
#include <riff/aiff/aiffproperties.h>
#include <asf/asffile.h>
#include <asf/asfproperties.h>
#include <ape/apefile.h>
#include <ape/apeproperties.h>
#include <dsf/dsffile.h>
#include <dsf/dsfproperties.h>
#include <dsdiff/dsdifffile.h>
#include <dsdiff/dsdiffproperties.h>
#include <wavpack/wavpackfile.h>
#include <wavpack/wavpackproperties.h>
#include <mpc/mpcfile.h>
#include <trueaudio/trueaudiofile.h>
#include <trueaudio/trueaudioproperties.h>
#include <shorten/shortenfile.h>
#include <shorten/shortenproperties.h>
#include <mod/modfile.h>
#include <s3m/s3mfile.h>
#include <it/itfile.h>
#include <xm/xmfile.h>

ExtendedAudioInfo get_extended_audio_info(
    TagLib::File* file, TagLib::AudioProperties* /* audio */)
{
    ExtendedAudioInfo info = {0, "", "", false, 0, 0, 0, false, 0};

    if (auto* f = dynamic_cast<TagLib::MPEG::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.mpegVersion = props->version() == TagLib::MPEG::Header::Version1 ? 1 : 2;
            info.mpegLayer = props->layer();
        }
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
            info.isEncrypted = props->isEncrypted();
            info.mp4Codec = static_cast<int>(props->codec());
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

    if (auto* f = dynamic_cast<TagLib::Ogg::FLAC::File*>(file)) {
        auto* props = dynamic_cast<TagLib::FLAC::Properties*>(f->audioProperties());
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "FLAC";
        info.container = "OGG";
        info.isLossless = true;
        return info;
    }

    if (dynamic_cast<TagLib::Ogg::Speex::File*>(file)) {
        info.codec = "Speex";
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

    if (auto* f = dynamic_cast<TagLib::ASF::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.bitsPerSample = props->bitsPerSample();
            info.isEncrypted = props->isEncrypted();
            if (props->codec() == TagLib::ASF::Properties::WMA9Lossless) {
                info.codec = "WMA Lossless";
                info.isLossless = true;
            } else {
                info.codec = "WMA";
            }
        }
        info.container = "ASF";
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::APE::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.bitsPerSample = props->bitsPerSample();
            info.version = props->version();
        }
        info.codec = "APE";
        info.container = "APE";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::DSF::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "DSD";
        info.container = "DSF";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::DSDIFF::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "DSD";
        info.container = "DSDIFF";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::WavPack::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.bitsPerSample = props->bitsPerSample();
            info.isLossless = props->isLossless();
            info.version = props->version();
        }
        info.codec = "WavPack";
        info.container = "WavPack";
        return info;
    }

    if (dynamic_cast<TagLib::MPC::File*>(file)) {
        info.codec = "MPC";
        info.container = "MPC";
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::TrueAudio::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) {
            info.bitsPerSample = props->bitsPerSample();
            info.version = props->ttaVersion();
        }
        info.codec = "TTA";
        info.container = "TTA";
        info.isLossless = true;
        return info;
    }

    if (auto* f = dynamic_cast<TagLib::Shorten::File*>(file)) {
        auto* props = f->audioProperties();
        if (props) info.bitsPerSample = props->bitsPerSample();
        info.codec = "Shorten";
        info.container = "Shorten";
        info.isLossless = true;
        return info;
    }

    if (dynamic_cast<TagLib::Mod::File*>(file)) {
        info.codec = "MOD";
        info.container = "MOD";
        return info;
    }

    if (dynamic_cast<TagLib::S3M::File*>(file)) {
        info.codec = "S3M";
        info.container = "S3M";
        return info;
    }

    if (dynamic_cast<TagLib::IT::File*>(file)) {
        info.codec = "IT";
        info.container = "IT";
        return info;
    }

    if (dynamic_cast<TagLib::XM::File*>(file)) {
        info.codec = "XM";
        info.container = "XM";
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
    if (info.mpegVersion > 0) count++;
    if (info.mpegLayer > 0) count++;
    if (info.isEncrypted) count++;
    if (info.version > 0) count++;
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

    if (info.mpegVersion > 0) {
        mpack_write_cstr(writer, "mpegVersion");
        mpack_write_uint(writer, static_cast<uint32_t>(info.mpegVersion));
        written++;
    }

    if (info.mpegLayer > 0) {
        mpack_write_cstr(writer, "mpegLayer");
        mpack_write_uint(writer, static_cast<uint32_t>(info.mpegLayer));
        written++;
    }

    if (info.isEncrypted) {
        mpack_write_cstr(writer, "isEncrypted");
        mpack_write_bool(writer, true);
        written++;
    }

    if (info.version > 0) {
        mpack_write_cstr(writer, "formatVersion");
        mpack_write_uint(writer, static_cast<uint32_t>(info.version));
        written++;
    }

    return written;
}
