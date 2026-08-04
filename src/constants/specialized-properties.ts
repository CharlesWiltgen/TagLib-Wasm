/**
 * Specialized audio metadata properties.
 * Includes MusicBrainz IDs, ReplayGain values, AcoustID fingerprints, and Apple Sound Check.
 */
export const SPECIALIZED_PROPERTIES = {
  // MusicBrainz Identifiers
  musicbrainzArtistId: {
    key: "MUSICBRAINZ_ARTISTID",
    description: "MusicBrainz Artist ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "MusicBrainz Artist Id" },
      vorbis: "MUSICBRAINZ_ARTISTID",
      mp4: "----:com.apple.iTunes:MusicBrainz Artist Id",
    },
  },
  musicbrainzReleaseId: {
    key: "MUSICBRAINZ_ALBUMID",
    description: "MusicBrainz Release ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "MusicBrainz Album Id" },
      vorbis: "MUSICBRAINZ_ALBUMID",
      mp4: "----:com.apple.iTunes:MusicBrainz Album Id",
    },
  },
  musicbrainzTrackId: {
    key: "MUSICBRAINZ_TRACKID",
    description: "MusicBrainz Recording ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "UFID", description: "http://musicbrainz.org" },
      vorbis: "MUSICBRAINZ_TRACKID",
      mp4: "----:com.apple.iTunes:MusicBrainz Track Id",
    },
  },
  musicbrainzReleaseGroupId: {
    key: "MUSICBRAINZ_RELEASEGROUPID",
    description: "MusicBrainz Release Group ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "MusicBrainz Release Group Id" },
      vorbis: "MUSICBRAINZ_RELEASEGROUPID",
      mp4: "----:com.apple.iTunes:MusicBrainz Release Group Id",
    },
  },
  releaseType: {
    key: "RELEASETYPE",
    description:
      "Release type (album, single, EP, compilation, ...). Multi-value (e.g. 'album' + 'EP'). TagLib 2.3.1 translates the RELEASETYPE key per format: ID3v2 TXXX 'MusicBrainz Album Type', MP4 freeform atom, APEv2 MUSICBRAINZ_ALBUMTYPE, ASF 'MusicBrainz/Album Type', Vorbis/Matroska raw RELEASETYPE",
    type: "string" as const,
    supportedFormats: [
      "ID3v2",
      "MP4",
      "Vorbis",
      "APE",
      "ASF",
      "Matroska",
    ] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "MusicBrainz Album Type" },
      vorbis: "RELEASETYPE",
      mp4: "----:com.apple.iTunes:MusicBrainz Album Type",
    },
  },

  // ReplayGain Properties
  replayGainTrackGain: {
    key: "REPLAYGAIN_TRACK_GAIN",
    description: "ReplayGain track gain in dB (e.g., '-6.54 dB')",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "ReplayGain_Track_Gain" },
      vorbis: "REPLAYGAIN_TRACK_GAIN",
      mp4: "----:com.apple.iTunes:replaygain_track_gain",
    },
  },
  replayGainTrackPeak: {
    key: "REPLAYGAIN_TRACK_PEAK",
    description: "ReplayGain track peak value (0.0-1.0)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "ReplayGain_Track_Peak" },
      vorbis: "REPLAYGAIN_TRACK_PEAK",
      mp4: "----:com.apple.iTunes:replaygain_track_peak",
    },
  },
  replayGainAlbumGain: {
    key: "REPLAYGAIN_ALBUM_GAIN",
    description: "ReplayGain album gain in dB",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "ReplayGain_Album_Gain" },
      vorbis: "REPLAYGAIN_ALBUM_GAIN",
      mp4: "----:com.apple.iTunes:replaygain_album_gain",
    },
  },
  replayGainAlbumPeak: {
    key: "REPLAYGAIN_ALBUM_PEAK",
    description: "ReplayGain album peak value (0.0-1.0)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "ReplayGain_Album_Peak" },
      vorbis: "REPLAYGAIN_ALBUM_PEAK",
      mp4: "----:com.apple.iTunes:replaygain_album_peak",
    },
  },
  r128TrackGain: {
    key: "R128_TRACK_GAIN",
    description:
      "EBU R128 track loudness gain (RFC 7845), raw wire value: signed Q7.8 integer (dB x 256, e.g. '-573' = -2.23828125 dB). readTags() converts to a decibel number (see ExtendedTag.r128TrackGain)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "ASF"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "R128_TRACK_GAIN" },
      vorbis: "R128_TRACK_GAIN",
      mp4: "----:com.apple.iTunes:R128_TRACK_GAIN",
    },
  },
  r128AlbumGain: {
    key: "R128_ALBUM_GAIN",
    description:
      "EBU R128 album loudness gain (RFC 7845), raw wire value: signed Q7.8 integer (dB x 256). readTags() converts to a decibel number",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "ASF"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "R128_ALBUM_GAIN" },
      vorbis: "R128_ALBUM_GAIN",
      mp4: "----:com.apple.iTunes:R128_ALBUM_GAIN",
    },
  },

  // AcoustID Properties
  acoustidFingerprint: {
    key: "ACOUSTID_FINGERPRINT",
    description: "AcoustID fingerprint (Chromaprint)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "Acoustid Fingerprint" },
      vorbis: "ACOUSTID_FINGERPRINT",
      mp4: "----:com.apple.iTunes:Acoustid Fingerprint",
    },
  },
  acoustidId: {
    key: "ACOUSTID_ID",
    description: "AcoustID UUID",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "Acoustid Id" },
      vorbis: "ACOUSTID_ID",
      mp4: "----:com.apple.iTunes:Acoustid Id",
    },
  },

  // Apple Sound Check
  appleSoundCheck: {
    key: "ITUNNORM",
    description: "Apple Sound Check normalization data",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "iTunNORM" },
      vorbis: "ITUNNORM",
      mp4: "----:com.apple.iTunes:iTunNORM",
    },
  },
  /**
   * Apple gapless-playback data (encoder delay, padding, original sample count).
   *
   * Exists so the two Apple freeform atoms are presented consistently: without
   * it, `properties()` answered `appleSoundCheck` for iTunNORM but the raw
   * uppercased `ITUNSMPB` for its sibling, because only one had an alias. The
   * name mirrors `appleSoundCheck` — vendor-prefixed, feature-named rather than
   * atom-named (tuneup-ibo).
   */
  appleGaplessInfo: {
    key: "ITUNSMPB",
    description: "Apple gapless playback data (encoder delay and padding)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "iTunSMPB" },
      vorbis: "ITUNSMPB",
      mp4: "----:com.apple.iTunes:iTunSMPB",
    },
  },
} as const;
