/**
 * Convenience constants for common property names.
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
 * Type representing all valid tag property names.
 */
export type TagName = typeof Tags[keyof typeof Tags];

/**
 * Type guard to check if a string is a valid tag name.
 */
export function isValidTagName(name: string): name is TagName {
  return Object.values(Tags).includes(name as TagName);
}

/**
 * Get all available tag names as an array.
 */
export function getAllTagNames(): readonly TagName[] {
  return Object.values(Tags);
}
