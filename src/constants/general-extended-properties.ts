/**
 * General extended audio metadata properties.
 * Includes album artist, composer, disc number, sorting properties, and common extended fields.
 */
export const GENERAL_EXTENDED_PROPERTIES = {
  albumArtist: {
    key: "ALBUMARTIST",
    description: "The album artist (band/orchestra/ensemble)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TPE2" },
      vorbis: "ALBUMARTIST",
      mp4: "aART",
    },
  },
  composer: {
    key: "COMPOSER",
    description: "The original composer(s) of the track",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TCOM" },
      vorbis: "COMPOSER",
      mp4: "©wrt",
    },
  },
  copyright: {
    key: "COPYRIGHT",
    description: "Copyright information",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      vorbis: "COPYRIGHT",
    },
  },
  encodedBy: {
    key: "ENCODEDBY",
    description: "The encoding software or person",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      vorbis: "ENCODEDBY",
    },
  },
  discNumber: {
    key: "DISCNUMBER",
    description: "The disc number for multi-disc sets",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TPOS" },
      vorbis: "DISCNUMBER",
      mp4: "disk",
    },
  },
  bpm: {
    key: "BPM",
    description: "Beats per minute",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TBPM" },
      vorbis: "BPM",
      mp4: "tmpo",
    },
  },
  totalTracks: {
    key: "TRACKTOTAL",
    description: "Total number of tracks on the album",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TRCK" },
      vorbis: "TRACKTOTAL",
      mp4: "trkn",
    },
  },
  totalDiscs: {
    key: "DISCTOTAL",
    description: "Total number of discs in the set",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TPOS" },
      vorbis: "DISCTOTAL",
      mp4: "disk",
    },
  },
  compilation: {
    key: "COMPILATION",
    description: "Whether the album is a compilation (various artists)",
    type: "boolean" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TCMP" },
      vorbis: "COMPILATION",
      mp4: "cpil",
    },
  },

  // Sorting Properties
  titleSort: {
    key: "TITLESORT",
    description: "Sort name for title (for alphabetization)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TSOT" },
      vorbis: "TITLESORT",
      mp4: "sonm",
    },
  },
  artistSort: {
    key: "ARTISTSORT",
    description: "Sort name for artist (for alphabetization)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TSOP" },
      vorbis: "ARTISTSORT",
      mp4: "soar",
    },
  },
  albumSort: {
    key: "ALBUMSORT",
    description: "Sort name for album (for alphabetization)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TSOA" },
      vorbis: "ALBUMSORT",
      mp4: "soal",
    },
  },

  // Additional common properties
  lyricist: {
    key: "LYRICIST",
    description: "The lyrics/text writer(s)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LYRICIST",
    },
  },
  conductor: {
    key: "CONDUCTOR",
    description: "The conductor",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "CONDUCTOR",
    },
  },
  remixedBy: {
    key: "REMIXEDBY",
    description: "Person who remixed the track",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "REMIXEDBY",
    },
  },
  language: {
    key: "LANGUAGE",
    description: "Language of vocals/lyrics",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LANGUAGE",
    },
  },
  publisher: {
    key: "PUBLISHER",
    description: "The publisher",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "PUBLISHER",
    },
  },
  mood: {
    key: "MOOD",
    description: "The mood/atmosphere of the track",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "MOOD",
    },
  },
  media: {
    key: "MEDIA",
    description: "Media type (CD, vinyl, etc.)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "MEDIA",
    },
  },
  grouping: {
    key: "GROUPING",
    description: "Content group/work",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "GROUPING",
    },
  },
  work: {
    key: "WORK",
    description: "Work name",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "WORK",
    },
  },
  lyrics: {
    key: "LYRICS",
    description: "Lyrics content",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LYRICS",
    },
  },
  isrc: {
    key: "ISRC",
    description: "International Standard Recording Code",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "ISRC",
    },
  },
  catalogNumber: {
    key: "CATALOGNUMBER",
    description: "Catalog number",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "CATALOGNUMBER",
    },
  },
  barcode: {
    key: "BARCODE",
    description: "Barcode (EAN/UPC)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "BARCODE",
    },
  },
} as const;
