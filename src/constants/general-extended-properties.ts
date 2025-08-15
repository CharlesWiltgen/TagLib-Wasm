/**
 * General extended audio metadata properties.
 * Includes album artist, composer, disc number, sorting properties, and common extended fields.
 */
export const GENERAL_EXTENDED_PROPERTIES = {
  // Extended Properties
  ALBUMARTIST: {
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
  COMPOSER: {
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
  COPYRIGHT: {
    key: "COPYRIGHT",
    description: "Copyright information",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      vorbis: "COPYRIGHT",
    },
  },
  ENCODEDBY: {
    key: "ENCODEDBY",
    description: "The encoding software or person",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      vorbis: "ENCODEDBY",
    },
  },
  DISCNUMBER: {
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
  BPM: {
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

  // Sorting Properties
  TITLESORT: {
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
  ARTISTSORT: {
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
  ALBUMSORT: {
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
  LYRICIST: {
    key: "LYRICIST",
    description: "The lyrics/text writer(s)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LYRICIST",
    },
  },
  CONDUCTOR: {
    key: "CONDUCTOR",
    description: "The conductor",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "CONDUCTOR",
    },
  },
  REMIXEDBY: {
    key: "REMIXEDBY",
    description: "Person who remixed the track",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "REMIXEDBY",
    },
  },
  LANGUAGE: {
    key: "LANGUAGE",
    description: "Language of vocals/lyrics",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LANGUAGE",
    },
  },
  PUBLISHER: {
    key: "PUBLISHER",
    description: "The publisher",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "PUBLISHER",
    },
  },
  MOOD: {
    key: "MOOD",
    description: "The mood/atmosphere of the track",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "MOOD",
    },
  },
  MEDIA: {
    key: "MEDIA",
    description: "Media type (CD, vinyl, etc.)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "MEDIA",
    },
  },
  GROUPING: {
    key: "GROUPING",
    description: "Content group/work",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "GROUPING",
    },
  },
  WORK: {
    key: "WORK",
    description: "Work name",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "WORK",
    },
  },
  LYRICS: {
    key: "LYRICS",
    description: "Lyrics content",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "LYRICS",
    },
  },
  ISRC: {
    key: "ISRC",
    description: "International Standard Recording Code",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "ISRC",
    },
  },
  CATALOGNUMBER: {
    key: "CATALOGNUMBER",
    description: "Catalog number",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "CATALOGNUMBER",
    },
  },
  BARCODE: {
    key: "BARCODE",
    description: "Barcode (EAN/UPC)",
    type: "string" as const,
    supportedFormats: ["Vorbis"] as const,
    mappings: {
      vorbis: "BARCODE",
    },
  },
} as const;
