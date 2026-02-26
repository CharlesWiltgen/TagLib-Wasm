import type { ExtendedTag } from "./tags.ts";

/**
 * Format-specific field mapping for automatic tag mapping.
 * Defines how a metadata field maps to different audio formats.
 * Used internally for format-agnostic metadata operations.
 *
 * @example
 * ```typescript
 * const artistMapping: FieldMapping = {
 *   id3v2: { frame: "TPE1" },
 *   vorbis: "ARTIST",
 *   mp4: "©ART",
 *   wav: "IART"
 * };
 * ```
 */
export interface FieldMapping {
  /** MP3 ID3v2 mapping */
  id3v2?: {
    frame: string;
    description?: string; // For TXXX frames
  };
  /** FLAC/OGG Vorbis Comments mapping */
  vorbis?: string;
  /** MP4/M4A atom mapping */
  mp4?: string;
  /** WAV INFO chunk mapping */
  wav?: string;
}

/**
 * Complete metadata field mappings for all formats.
 * This constant defines how each ExtendedTag field maps to
 * format-specific metadata fields across different audio formats.
 * Used for automatic tag mapping in format-agnostic operations.
 *
 * @example
 * ```typescript
 * // Get the ID3v2 frame for the artist field
 * const artistFrame = METADATA_MAPPINGS.artist.id3v2?.frame; // "TPE1"
 *
 * // Get the Vorbis comment field for album artist
 * const vorbisField = METADATA_MAPPINGS.albumArtist.vorbis; // "ALBUMARTIST"
 * ```
 */
export const METADATA_MAPPINGS: Record<
  Exclude<keyof ExtendedTag, "pictures" | "ratings" | "lyrics" | "chapters">,
  FieldMapping
> = {
  // Basic fields (already handled by TagLib's standard API)
  title: {
    id3v2: { frame: "TIT2" },
    vorbis: "TITLE",
    mp4: "©nam",
    wav: "INAM",
  },
  artist: {
    id3v2: { frame: "TPE1" },
    vorbis: "ARTIST",
    mp4: "©ART",
    wav: "IART",
  },
  album: {
    id3v2: { frame: "TALB" },
    vorbis: "ALBUM",
    mp4: "©alb",
    wav: "IPRD",
  },
  comment: {
    id3v2: { frame: "COMM" },
    vorbis: "COMMENT",
    mp4: "©cmt",
    wav: "ICMT",
  },
  genre: {
    id3v2: { frame: "TCON" },
    vorbis: "GENRE",
    mp4: "©gen",
    wav: "IGNR",
  },
  year: {
    id3v2: { frame: "TDRC" },
    vorbis: "DATE",
    mp4: "©day",
    wav: "ICRD",
  },
  track: {
    id3v2: { frame: "TRCK" },
    vorbis: "TRACKNUMBER",
    mp4: "trkn",
    wav: "ITRK",
  },

  // Advanced fields requiring format-specific handling
  acoustidFingerprint: {
    id3v2: { frame: "TXXX", description: "Acoustid Fingerprint" },
    vorbis: "ACOUSTID_FINGERPRINT",
    mp4: "----:com.apple.iTunes:Acoustid Fingerprint",
  },
  acoustidId: {
    id3v2: { frame: "TXXX", description: "Acoustid Id" },
    vorbis: "ACOUSTID_ID",
    mp4: "----:com.apple.iTunes:Acoustid Id",
  },
  musicbrainzTrackId: {
    id3v2: { frame: "UFID", description: "http://musicbrainz.org" },
    vorbis: "MUSICBRAINZ_TRACKID",
    mp4: "----:com.apple.iTunes:MusicBrainz Track Id",
  },
  musicbrainzReleaseId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Album Id" },
    vorbis: "MUSICBRAINZ_ALBUMID",
    mp4: "----:com.apple.iTunes:MusicBrainz Album Id",
  },
  musicbrainzArtistId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Artist Id" },
    vorbis: "MUSICBRAINZ_ARTISTID",
    mp4: "----:com.apple.iTunes:MusicBrainz Artist Id",
  },
  musicbrainzReleaseGroupId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Release Group Id" },
    vorbis: "MUSICBRAINZ_RELEASEGROUPID",
    mp4: "----:com.apple.iTunes:MusicBrainz Release Group Id",
  },
  albumArtist: {
    id3v2: { frame: "TPE2" },
    vorbis: "ALBUMARTIST",
    mp4: "aART",
  },
  composer: {
    id3v2: { frame: "TCOM" },
    vorbis: "COMPOSER",
    mp4: "©wrt",
  },
  discNumber: {
    id3v2: { frame: "TPOS" },
    vorbis: "DISCNUMBER",
    mp4: "disk",
  },
  totalTracks: {
    id3v2: { frame: "TRCK" }, // Part of TRCK frame
    vorbis: "TRACKTOTAL",
    mp4: "trkn", // Part of trkn atom
  },
  totalDiscs: {
    id3v2: { frame: "TPOS" }, // Part of TPOS frame
    vorbis: "DISCTOTAL",
    mp4: "disk", // Part of disk atom
  },
  bpm: {
    id3v2: { frame: "TBPM" },
    vorbis: "BPM",
    mp4: "tmpo",
  },
  compilation: {
    id3v2: { frame: "TCMP" },
    vorbis: "COMPILATION",
    mp4: "cpil",
  },
  titleSort: {
    id3v2: { frame: "TSOT" },
    vorbis: "TITLESORT",
    mp4: "sonm",
  },
  artistSort: {
    id3v2: { frame: "TSOP" },
    vorbis: "ARTISTSORT",
    mp4: "soar",
  },
  albumSort: {
    id3v2: { frame: "TSOA" },
    vorbis: "ALBUMSORT",
    mp4: "soal",
  },
  conductor: {
    id3v2: { frame: "TPE3" },
    vorbis: "CONDUCTOR",
    mp4: "----:com.apple.iTunes:CONDUCTOR",
  },
  copyright: {
    id3v2: { frame: "TCOP" },
    vorbis: "COPYRIGHT",
    mp4: "cprt",
  },
  encodedBy: {
    id3v2: { frame: "TENC" },
    vorbis: "ENCODEDBY",
    mp4: "©too",
  },
  isrc: {
    id3v2: { frame: "TSRC" },
    vorbis: "ISRC",
    mp4: "----:com.apple.iTunes:ISRC",
  },
  lyricist: {
    id3v2: { frame: "TEXT" },
    vorbis: "LYRICIST",
    mp4: "----:com.apple.iTunes:LYRICIST",
  },

  // ReplayGain mappings
  replayGainTrackGain: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Track_Gain" },
    vorbis: "REPLAYGAIN_TRACK_GAIN",
    mp4: "----:com.apple.iTunes:replaygain_track_gain",
  },
  replayGainTrackPeak: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Track_Peak" },
    vorbis: "REPLAYGAIN_TRACK_PEAK",
    mp4: "----:com.apple.iTunes:replaygain_track_peak",
  },
  replayGainAlbumGain: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Album_Gain" },
    vorbis: "REPLAYGAIN_ALBUM_GAIN",
    mp4: "----:com.apple.iTunes:replaygain_album_gain",
  },
  replayGainAlbumPeak: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Album_Peak" },
    vorbis: "REPLAYGAIN_ALBUM_PEAK",
    mp4: "----:com.apple.iTunes:replaygain_album_peak",
  },

  // Apple Sound Check mapping
  appleSoundCheck: {
    id3v2: { frame: "TXXX", description: "iTunNORM" },
    vorbis: "ITUNNORM", // Some tools store it in Vorbis comments too
    mp4: "----:com.apple.iTunes:iTunNORM",
  },
};

/** UPPERCASE PropertyMap key → camelCase ExtendedTag key */
export const VORBIS_TO_CAMEL: Record<string, string> = {};
/** camelCase ExtendedTag key → UPPERCASE PropertyMap key */
export const CAMEL_TO_VORBIS: Record<string, string> = {};
for (
  const [camel, mapping] of Object.entries(METADATA_MAPPINGS) as [
    string,
    { vorbis?: string },
  ][]
) {
  if (mapping.vorbis) {
    VORBIS_TO_CAMEL[mapping.vorbis] = camel;
    CAMEL_TO_VORBIS[camel] = mapping.vorbis;
  }
}
// C++ FIELD_MAP now sends DISCNUMBER as "discNumber" directly.
// Keep legacy "disc" → "discNumber" mapping for backwards compatibility with older binaries.
VORBIS_TO_CAMEL["disc"] = "discNumber";
