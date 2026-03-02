/**
 * Convenience constants for common property names.
 * Values are camelCase PropertyKeys where defined in PROPERTIES.
 * Keys not in PROPERTIES use their TagLib ALL_CAPS wire name (pass-through).
 */
export const Tags = {
  // Basic Properties
  Title: "title",
  Artist: "artist",
  Album: "album",
  Date: "date",
  TrackNumber: "trackNumber",
  Genre: "genre",
  Comment: "comment",

  // Extended Properties
  AlbumArtist: "albumArtist",
  Composer: "composer",
  Copyright: "copyright",
  EncodedBy: "encodedBy",
  DiscNumber: "discNumber",
  TotalTracks: "totalTracks",
  TotalDiscs: "totalDiscs",
  Compilation: "compilation",
  Bpm: "bpm",
  Lyricist: "lyricist",
  Conductor: "conductor",
  Remixer: "remixedBy",
  Language: "language",
  Publisher: "publisher",
  Mood: "mood",
  Media: "media",
  RadioStationOwner: "RADIOSTATIONOWNER",
  Producer: "PRODUCER",
  Subtitle: "SUBTITLE",
  Label: "LABEL",

  // Sorting Properties
  TitleSort: "titleSort",
  ArtistSort: "artistSort",
  AlbumArtistSort: "ALBUMARTISTSORT",
  AlbumSort: "albumSort",
  ComposerSort: "COMPOSERSORT",

  // Identifiers
  Isrc: "isrc",
  Asin: "ASIN",
  CatalogNumber: "catalogNumber",
  Barcode: "barcode",

  // MusicBrainz Identifiers
  MusicBrainzArtistId: "musicbrainzArtistId",
  MusicBrainzReleaseArtistId: "MUSICBRAINZ_ALBUMARTISTID",
  MusicBrainzWorkId: "MUSICBRAINZ_WORKID",
  MusicBrainzReleaseId: "musicbrainzReleaseId",
  MusicBrainzRecordingId: "musicbrainzTrackId",
  MusicBrainzTrackId: "musicbrainzTrackId",
  MusicBrainzReleaseGroupId: "musicbrainzReleaseGroupId",
  MusicBrainzReleaseTrackId: "MUSICBRAINZ_RELEASETRACKID",

  // AcoustID
  AcoustidFingerprint: "acoustidFingerprint",
  AcoustidId: "acoustidId",

  // Podcast Properties
  PodcastId: "PODCASTID",
  PodcastUrl: "PODCASTURL",

  // Grouping and Work
  Grouping: "grouping",
  Work: "work",

  // Additional Metadata
  Lyrics: "lyrics",
  AlbumGain: "replayGainAlbumGain",
  AlbumPeak: "replayGainAlbumPeak",
  TrackGain: "replayGainTrackGain",
  TrackPeak: "replayGainTrackPeak",

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
