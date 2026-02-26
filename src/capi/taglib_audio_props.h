#ifndef TAGLIB_AUDIO_PROPS_H
#define TAGLIB_AUDIO_PROPS_H

#include <mpack/mpack.h>

#ifdef __cplusplus

namespace TagLib {
  class File;
  class AudioProperties;
}

struct ExtendedAudioInfo {
    int bitsPerSample;
    const char* codec;
    const char* container;
    bool isLossless;
    // Format-specific extended fields (0/"" = not set)
    int mpegVersion;     // MPEG::Properties: 1 or 2
    int mpegLayer;       // MPEG::Properties: 1, 2, or 3
    bool isEncrypted;    // MP4, ASF
    int version;         // APE, WavPack, MPC, TTA, Shorten version
};

ExtendedAudioInfo get_extended_audio_info(TagLib::File* file,
                                          TagLib::AudioProperties* audio);

uint32_t count_extended_audio_fields(const ExtendedAudioInfo& info);

uint32_t encode_extended_audio(mpack_writer_t* writer,
                               const ExtendedAudioInfo& info);

#endif

#endif // TAGLIB_AUDIO_PROPS_H
