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
} as const;
