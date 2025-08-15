/**
 * Basic audio metadata properties supported across all common formats.
 * These are the core tags that most audio files should have.
 */
export const BASIC_PROPERTIES = {
  // Basic Properties
  TITLE: {
    key: "TITLE",
    description: "The title of the track",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TIT2" },
      vorbis: "TITLE",
      mp4: "©nam",
      wav: "INAM",
    },
  },
  ARTIST: {
    key: "ARTIST",
    description: "The primary performer(s) of the track",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TPE1" },
      vorbis: "ARTIST",
      mp4: "©ART",
      wav: "IART",
    },
  },
  ALBUM: {
    key: "ALBUM",
    description: "The album/collection name",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TALB" },
      vorbis: "ALBUM",
      mp4: "©alb",
      wav: "IPRD",
    },
  },
  DATE: {
    key: "DATE",
    description: "The date of recording (typically year)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TDRC" },
      vorbis: "DATE",
      mp4: "©day",
      wav: "ICRD",
    },
  },
  TRACKNUMBER: {
    key: "TRACKNUMBER",
    description: "The track number within the album",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TRCK" },
      vorbis: "TRACKNUMBER",
      mp4: "trkn",
      wav: "ITRK",
    },
  },
  GENRE: {
    key: "GENRE",
    description: "The musical genre",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TCON" },
      vorbis: "GENRE",
      mp4: "©gen",
      wav: "IGNR",
    },
  },
  COMMENT: {
    key: "COMMENT",
    description: "Comments or notes about the track",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "COMM" },
      vorbis: "COMMENT",
      mp4: "©cmt",
      wav: "ICMT",
    },
  },
} as const;
