/**
 * Comprehensive property definitions with metadata for all supported audio metadata fields.
 * This is the single source of truth for all property information including descriptions,
 * types, format support, and format-specific mappings.
 *
 * @example
 * ```typescript
 * import { PROPERTIES, PropertyKey } from 'taglib-wasm/constants';
 *
 * // Type-safe property access with rich metadata
 * const titleProp = PROPERTIES.TITLE;
 * console.log(titleProp.description); // "The title of the track"
 * console.log(titleProp.type);        // "string"
 * console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]
 *
 * // Use with typed methods
 * const title = file.getProperty('TITLE'); // TypeScript knows this returns string | undefined
 * file.setProperty('TRACK_NUMBER', 5);     // TypeScript knows this expects number
 * ```
 */
export const PROPERTIES = {
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

  // MusicBrainz Identifiers
  MUSICBRAINZ_ARTISTID: {
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
  MUSICBRAINZ_ALBUMID: {
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
  MUSICBRAINZ_TRACKID: {
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
  MUSICBRAINZ_RELEASEGROUPID: {
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
  REPLAYGAIN_TRACK_GAIN: {
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
  REPLAYGAIN_TRACK_PEAK: {
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
  REPLAYGAIN_ALBUM_GAIN: {
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
  REPLAYGAIN_ALBUM_PEAK: {
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
  ACOUSTID_FINGERPRINT: {
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
  ACOUSTID_ID: {
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
  ITUNNORM: {
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

  // Additional common properties from existing Tags
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

/**
 * Legacy Tags constant for backward compatibility.
 * @deprecated Use PROPERTIES instead for enhanced functionality.
 */
export const Tags = {
  // Basic Properties
  Title: "TITLE",
  Artist: "ARTIST",
  Album: "ALBUM",
  Date: "DATE",
  TrackNumber: "TRACKNUMBER",
  Genre: "GENRE",
  Comment: "COMMENT",

  // Extended Properties
  AlbumArtist: "ALBUMARTIST",
  Composer: "COMPOSER",
  Copyright: "COPYRIGHT",
  EncodedBy: "ENCODEDBY",
  DiscNumber: "DISCNUMBER",
  Bpm: "BPM",
  Lyricist: "LYRICIST",
  Conductor: "CONDUCTOR",
  Remixer: "REMIXEDBY",
  Language: "LANGUAGE",
  Publisher: "PUBLISHER",
  Mood: "MOOD",
  Media: "MEDIA",
  RadioStationOwner: "RADIOSTATIONOWNER",
  Producer: "PRODUCER",
  Subtitle: "SUBTITLE",
  Label: "LABEL",

  // Sorting Properties
  TitleSort: "TITLESORT",
  ArtistSort: "ARTISTSORT",
  AlbumArtistSort: "ALBUMARTISTSORT",
  AlbumSort: "ALBUMSORT",
  ComposerSort: "COMPOSERSORT",

  // Identifiers
  Isrc: "ISRC",
  Asin: "ASIN",
  CatalogNumber: "CATALOGNUMBER",
  Barcode: "BARCODE",

  // MusicBrainz Identifiers
  MusicBrainzArtistId: "MUSICBRAINZ_ARTISTID",
  MusicBrainzReleaseArtistId: "MUSICBRAINZ_ALBUMARTISTID",
  MusicBrainzWorkId: "MUSICBRAINZ_WORKID",
  MusicBrainzReleaseId: "MUSICBRAINZ_ALBUMID",
  MusicBrainzRecordingId: "MUSICBRAINZ_TRACKID",
  MusicBrainzTrackId: "MUSICBRAINZ_TRACKID",
  MusicBrainzReleaseGroupId: "MUSICBRAINZ_RELEASEGROUPID",
  MusicBrainzReleaseTrackId: "MUSICBRAINZ_RELEASETRACKID",

  // Podcast Properties
  PodcastId: "PODCASTID",
  PodcastUrl: "PODCASTURL",

  // Grouping and Work
  Grouping: "GROUPING",
  Work: "WORK",

  // Additional Metadata
  Lyrics: "LYRICS",
  AlbumGain: "REPLAYGAIN_ALBUM_GAIN",
  AlbumPeak: "REPLAYGAIN_ALBUM_PEAK",
  TrackGain: "REPLAYGAIN_TRACK_GAIN",
  TrackPeak: "REPLAYGAIN_TRACK_PEAK",

  // Special handling
  OriginalArtist: "ORIGINALARTIST",
  OriginalAlbum: "ORIGINALALBUM",
  OriginalDate: "ORIGINALDATE",
  Script: "SCRIPT",
  InvolvedPeopleList: "INVOLVEDPEOPLELIST",

  // Technical Properties
  EncoderSettings: "ENCODERSETTINGS",
  SourceMedia: "SOURCEMEDIA",
} as const;

/**
 * Type representing all valid property keys from the PROPERTIES object.
 * This provides TypeScript autocomplete and type safety.
 */
export type PropertyKey = keyof typeof PROPERTIES;

/**
 * Type representing the property value type based on the property definition.
 * Currently all properties are strings, but this allows for future expansion.
 */
export type PropertyValue<K extends PropertyKey> =
  typeof PROPERTIES[K]["type"] extends "string" ? string
    : typeof PROPERTIES[K]["type"] extends "number" ? number
    : typeof PROPERTIES[K]["type"] extends "boolean" ? boolean
    : string;

/**
 * Type representing all valid tag property names (legacy)
 * @deprecated Use PropertyKey instead
 */
export type TagName = typeof Tags[keyof typeof Tags];

/**
 * Type guard to check if a string is a valid property key
 */
export function isValidProperty(key: string): key is PropertyKey {
  return key in PROPERTIES;
}

/**
 * Get property metadata for a given property key
 */
export function getPropertyMetadata<K extends PropertyKey>(key: K) {
  return PROPERTIES[key];
}

/**
 * Get all available property keys as an array
 */
export function getAllPropertyKeys(): readonly PropertyKey[] {
  return Object.keys(PROPERTIES) as PropertyKey[];
}

/**
 * Get all available property definitions as an array of [key, metadata] pairs
 */
export function getAllProperties(): readonly [
  PropertyKey,
  typeof PROPERTIES[PropertyKey],
][] {
  return Object.entries(PROPERTIES) as [
    PropertyKey,
    typeof PROPERTIES[PropertyKey],
  ][];
}

/**
 * Filter properties by supported format
 */
export function getPropertiesByFormat(format: string): PropertyKey[] {
  return getAllPropertyKeys().filter((key) =>
    PROPERTIES[key].supportedFormats.includes(format as any)
  );
}

/**
 * Type guard to check if a string is a valid tag name (legacy)
 * @deprecated Use isValidProperty instead
 */
export function isValidTagName(name: string): name is TagName {
  return Object.values(Tags).includes(name as TagName);
}

/**
 * Get all available tag names as an array (legacy)
 * @deprecated Use getAllPropertyKeys instead
 */
export function getAllTagNames(): readonly TagName[] {
  return Object.values(Tags);
}

/**
 * Format-specific tag mappings (for reference only - TagLib handles these automatically)
 * This shows how standard property names map to format-specific identifiers.
 */
export const FormatMappings = {
  Title: {
    id3v2: "TIT2",
    mp4: "©nam",
    vorbis: "TITLE",
    ape: "Title",
    riff: "INAM",
  },
  Artist: {
    id3v2: "TPE1",
    mp4: "©ART",
    vorbis: "ARTIST",
    ape: "Artist",
    riff: "IART",
  },
  Album: {
    id3v2: "TALB",
    mp4: "©alb",
    vorbis: "ALBUM",
    ape: "Album",
    riff: "IPRD",
  },
  Date: {
    id3v2: "TDRC",
    mp4: "©day",
    vorbis: "DATE",
    ape: "Year",
    riff: "ICRD",
  },
  Genre: {
    id3v2: "TCON",
    mp4: "©gen",
    vorbis: "GENRE",
    ape: "Genre",
    riff: "IGNR",
  },
  Comment: {
    id3v2: "COMM",
    mp4: "©cmt",
    vorbis: "COMMENT",
    ape: "Comment",
    riff: "ICMT",
  },
  TrackNumber: {
    id3v2: "TRCK",
    mp4: "trkn",
    vorbis: "TRACKNUMBER",
    ape: "Track",
    riff: "ITRK",
  },
} as const;
