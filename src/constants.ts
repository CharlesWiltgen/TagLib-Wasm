/**
 * Standard tag property names used by TagLib.
 * These constants provide type-safe access to tag properties with IDE autocomplete.
 * 
 * @example
 * ```typescript
 * import { Tags } from 'taglib-wasm';
 * 
 * // Read tags
 * const title = file.tag.properties.get(Tags.Title);
 * const artist = file.tag.properties.get(Tags.Artist);
 * 
 * // Write tags
 * file.tag.properties.set(Tags.Album, "Dark Side of the Moon");
 * file.tag.properties.set(Tags.Year, "1973");
 * ```
 */
export const Tags = {
  // Basic Properties
  /** Track/song title */
  Title: 'TITLE',
  /** Primary performer(s) */
  Artist: 'ARTIST',
  /** Album/collection name */
  Album: 'ALBUM',
  /** Date of recording (year) */
  Date: 'DATE',
  /** Track number on album */
  TrackNumber: 'TRACKNUMBER',
  /** Musical genre */
  Genre: 'GENRE',
  /** Comments/notes */
  Comment: 'COMMENT',
  
  // Extended Properties
  /** Band/orchestra/ensemble */
  AlbumArtist: 'ALBUMARTIST',
  /** Original composer(s) */
  Composer: 'COMPOSER',
  /** Copyright information */
  Copyright: 'COPYRIGHT',
  /** Encoding software/person */
  EncodedBy: 'ENCODEDBY',
  /** Disc number for multi-disc sets */
  DiscNumber: 'DISCNUMBER',
  /** Beats per minute */
  Bpm: 'BPM',
  /** Lyrics/text writer(s) */
  Lyricist: 'LYRICIST',
  /** Conductor */
  Conductor: 'CONDUCTOR',
  /** Person who remixed */
  Remixer: 'REMIXEDBY',
  /** Language of vocals/lyrics */
  Language: 'LANGUAGE',
  /** Publisher */
  Publisher: 'PUBLISHER',
  /** Mood/atmosphere */
  Mood: 'MOOD',
  /** Media type (CD, vinyl, etc.) */
  Media: 'MEDIA',
  /** Radio station owner */
  RadioStationOwner: 'RADIOSTATIONOWNER',
  /** Producer */
  Producer: 'PRODUCER',
  /** Album subtitle */
  Subtitle: 'SUBTITLE',
  /** Release label */
  Label: 'LABEL',
  
  // Sorting Properties
  /** Sort name for title */
  TitleSort: 'TITLESORT',
  /** Sort name for artist */
  ArtistSort: 'ARTISTSORT',
  /** Sort name for album artist */
  AlbumArtistSort: 'ALBUMARTISTSORT',
  /** Sort name for album */
  AlbumSort: 'ALBUMSORT',
  /** Sort name for composer */
  ComposerSort: 'COMPOSERSORT',
  
  // Identifiers
  /** International Standard Recording Code */
  Isrc: 'ISRC',
  /** Amazon Standard Identification Number */
  Asin: 'ASIN',
  /** Catalog number */
  CatalogNumber: 'CATALOGNUMBER',
  /** Barcode (EAN/UPC) */
  Barcode: 'BARCODE',
  
  // MusicBrainz Identifiers
  /** MusicBrainz Artist ID */
  MusicBrainzArtistId: 'MUSICBRAINZ_ARTISTID',
  /** MusicBrainz Release Artist ID */
  MusicBrainzReleaseArtistId: 'MUSICBRAINZ_ALBUMARTISTID',
  /** MusicBrainz Work ID */
  MusicBrainzWorkId: 'MUSICBRAINZ_WORKID',
  /** MusicBrainz Release ID */
  MusicBrainzReleaseId: 'MUSICBRAINZ_ALBUMID',
  /** MusicBrainz Recording ID */
  MusicBrainzRecordingId: 'MUSICBRAINZ_TRACKID',
  /** MusicBrainz Track ID (deprecated, use RecordingId) */
  MusicBrainzTrackId: 'MUSICBRAINZ_TRACKID',
  /** MusicBrainz Release Group ID */
  MusicBrainzReleaseGroupId: 'MUSICBRAINZ_RELEASEGROUPID',
  /** MusicBrainz Release Track ID */
  MusicBrainzReleaseTrackId: 'MUSICBRAINZ_RELEASETRACKID',
  
  // Podcast Properties
  /** Podcast identifier */
  PodcastId: 'PODCASTID',
  /** Podcast URL */
  PodcastUrl: 'PODCASTURL',
  
  // Grouping and Work
  /** Content group/work */
  Grouping: 'GROUPING',
  /** Work name */
  Work: 'WORK',
  
  // Additional Metadata
  /** Lyrics content */
  Lyrics: 'LYRICS',
  /** Album gain (ReplayGain) */
  AlbumGain: 'REPLAYGAIN_ALBUM_GAIN',
  /** Album peak (ReplayGain) */
  AlbumPeak: 'REPLAYGAIN_ALBUM_PEAK',
  /** Track gain (ReplayGain) */
  TrackGain: 'REPLAYGAIN_TRACK_GAIN',
  /** Track peak (ReplayGain) */
  TrackPeak: 'REPLAYGAIN_TRACK_PEAK',
  
  // Special handling
  /** Original artist for covers */
  OriginalArtist: 'ORIGINALARTIST',
  /** Original album */
  OriginalAlbum: 'ORIGINALALBUM',
  /** Original release date */
  OriginalDate: 'ORIGINALDATE',
  /** Script/writing system */
  Script: 'SCRIPT',
  /** Involved people list */
  InvolvedPeopleList: 'INVOLVEDPEOPLELIST',
  
  // Technical Properties
  /** Encoder settings/software */
  EncoderSettings: 'ENCODERSETTINGS',
  /** Source media */
  SourceMedia: 'SOURCEMEDIA',
} as const;

/**
 * Type representing all valid tag property names
 */
export type TagName = typeof Tags[keyof typeof Tags];

/**
 * Type guard to check if a string is a valid tag name
 */
export function isValidTagName(name: string): name is TagName {
  return Object.values(Tags).includes(name as TagName);
}

/**
 * Get all available tag names as an array
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
    id3v2: 'TIT2',
    mp4: '©nam',
    vorbis: 'TITLE',
    ape: 'Title',
    riff: 'INAM'
  },
  Artist: {
    id3v2: 'TPE1',
    mp4: '©ART',
    vorbis: 'ARTIST',
    ape: 'Artist',
    riff: 'IART'
  },
  Album: {
    id3v2: 'TALB',
    mp4: '©alb',
    vorbis: 'ALBUM',
    ape: 'Album',
    riff: 'IPRD'
  },
  Date: {
    id3v2: 'TDRC',
    mp4: '©day',
    vorbis: 'DATE',
    ape: 'Year',
    riff: 'ICRD'
  },
  Genre: {
    id3v2: 'TCON',
    mp4: '©gen',
    vorbis: 'GENRE',
    ape: 'Genre',
    riff: 'IGNR'
  },
  Comment: {
    id3v2: 'COMM',
    mp4: '©cmt',
    vorbis: 'COMMENT',
    ape: 'Comment',
    riff: 'ICMT'
  },
  TrackNumber: {
    id3v2: 'TRCK',
    mp4: 'trkn',
    vorbis: 'TRACKNUMBER',
    ape: 'Track',
    riff: 'ITRK'
  }
} as const;