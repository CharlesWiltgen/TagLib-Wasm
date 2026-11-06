/**
 * @fileoverview Shared WASI shim tables: PropertyMap field map + buffer file factory.
 *
 * Split out of taglib_shim.cpp (taglib-1zc.b6d).
 */

#include "taglib_shim_common.h"

#include <cstring>

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

const FieldMapping FIELD_MAP[] = {
    {"ACOUSTID_FINGERPRINT", "acoustidFingerprint", FIELD_STRING},
    {"ACOUSTID_ID",          "acoustidId",          FIELD_STRING},
    {"ALBUM",                "album",               FIELD_STRING},
    {"ALBUMARTIST",          "albumArtist",          FIELD_STRING},
    {"ALBUMSORT",            "albumSort",            FIELD_STRING},
    {"ARTIST",               "artist",              FIELD_STRING},
    {"ARTISTSORT",           "artistSort",           FIELD_STRING},
    {"BPM",                  "bpm",                 FIELD_STRING},
    {"COMMENT",              "comment",             FIELD_STRING},
    {"COMPILATION",          "compilation",          FIELD_BOOLEAN},
    {"COMPOSER",             "composer",            FIELD_STRING},
    {"CONDUCTOR",            "conductor",           FIELD_STRING},
    {"COPYRIGHT",            "copyright",           FIELD_STRING},
    {"DATE",                 "date",                FIELD_STRING},
    {"DISCNUMBER",           "discNumber",          FIELD_STRING},
    {"DISCTOTAL",            "totalDiscs",          FIELD_STRING},
    {"ENCODEDBY",            "encodedBy",           FIELD_STRING},
    {"GENRE",                "genre",               FIELD_STRING},
    {"ISRC",                 "isrc",                FIELD_STRING},
    {"LYRICIST",             "lyricist",            FIELD_STRING},
    {"MUSICBRAINZ_ALBUMID",  "musicbrainzReleaseId",     FIELD_STRING},
    {"MUSICBRAINZ_ARTISTID", "musicbrainzArtistId",      FIELD_STRING},
    {"MUSICBRAINZ_RELEASEGROUPID", "musicbrainzReleaseGroupId", FIELD_STRING},
    {"MUSICBRAINZ_TRACKID",  "musicbrainzTrackId",       FIELD_STRING},
    {"REPLAYGAIN_ALBUM_GAIN", "replayGainAlbumGain",     FIELD_STRING},
    {"REPLAYGAIN_ALBUM_PEAK", "replayGainAlbumPeak",     FIELD_STRING},
    {"REPLAYGAIN_TRACK_GAIN", "replayGainTrackGain",     FIELD_STRING},
    {"REPLAYGAIN_TRACK_PEAK", "replayGainTrackPeak",     FIELD_STRING},
    {"TITLE",                "title",               FIELD_STRING},
    {"TITLESORT",            "titleSort",            FIELD_STRING},
    // camel is "trackNumber", NOT "track": "track" is the numeric tag()-surface
    // mirror emitted separately below, and keeping the names distinct is what
    // lets the raw string and the narrowed int coexist (same shape as
    // DATE/"date" + "year"). It also makes map_camel_to_prop("track") return
    // null, so the mirror is correctly ignored on the write path.
    {"TRACKNUMBER",          "trackNumber",         FIELD_STRING},
    {"TRACKTOTAL",           "totalTracks",         FIELD_STRING},
};

const size_t FIELD_MAP_SIZE = sizeof(FIELD_MAP) / sizeof(FIELD_MAP[0]);

const FieldMapping* find_by_prop(const char* key) {
    int left = 0, right = static_cast<int>(FIELD_MAP_SIZE) - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int cmp = strcmp(key, FIELD_MAP[mid].prop);
        if (cmp == 0) return &FIELD_MAP[mid];
        if (cmp < 0) right = mid - 1;
        else left = mid + 1;
    }
    return nullptr;
}

TagLib::File* create_file_for_format(tl_format format, TagLib::IOStream* stream) {
    switch (format) {
        case TL_FORMAT_MP3:      return new TagLib::MPEG::File(stream);
        case TL_FORMAT_FLAC:     return new TagLib::FLAC::File(stream);
        case TL_FORMAT_M4A:      return new TagLib::MP4::File(stream);
        case TL_FORMAT_OGG:      return new TagLib::Ogg::Vorbis::File(stream);
        case TL_FORMAT_WAV:      return new TagLib::RIFF::WAV::File(stream);
        case TL_FORMAT_OPUS:     return new TagLib::Ogg::Opus::File(stream);
        case TL_FORMAT_AIFF:     return new TagLib::RIFF::AIFF::File(stream);
        case TL_FORMAT_APE:      return new TagLib::APE::File(stream);
        case TL_FORMAT_WV:       return new TagLib::WavPack::File(stream);
        case TL_FORMAT_MPC:      return new TagLib::MPC::File(stream);
        case TL_FORMAT_ASF:      return new TagLib::ASF::File(stream);
        case TL_FORMAT_DSF:      return new TagLib::DSF::File(stream);
        case TL_FORMAT_TTA:      return new TagLib::TrueAudio::File(stream);
        case TL_FORMAT_OGG_FLAC: return new TagLib::Ogg::FLAC::File(stream);
        case TL_FORMAT_SPEEX:    return new TagLib::Ogg::Speex::File(stream);
        case TL_FORMAT_DSDIFF:   return new TagLib::DSDIFF::File(stream);
        case TL_FORMAT_SHN:      return new TagLib::Shorten::File(stream);
        case TL_FORMAT_MOD:      return new TagLib::Mod::File(stream);
        case TL_FORMAT_S3M:      return new TagLib::S3M::File(stream);
        case TL_FORMAT_IT:       return new TagLib::IT::File(stream);
        case TL_FORMAT_XM:       return new TagLib::XM::File(stream);
        case TL_FORMAT_MATROSKA: return new TagLib::Matroska::File(stream);
        default:                 return nullptr;
    }
}

