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
};

ExtendedAudioInfo get_extended_audio_info(TagLib::File* file,
                                          TagLib::AudioProperties* audio);

uint32_t count_extended_audio_fields(const ExtendedAudioInfo& info);

uint32_t encode_extended_audio(mpack_writer_t* writer,
                               const ExtendedAudioInfo& info);

#endif

#endif // TAGLIB_AUDIO_PROPS_H
