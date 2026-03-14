/**
 * Convenience constants for common property names.
 * All values are camelCase PropertyKeys backed by PROPERTIES entries.
 * Use toTagLibKey()/fromTagLibKey() to translate to/from TagLib wire names.
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
  RadioStationOwner: "radioStationOwner",
  Producer: "producer",
  Subtitle: "subtitle",
  Label: "label",

  // Sorting Properties
  TitleSort: "titleSort",
  ArtistSort: "artistSort",
  AlbumArtistSort: "albumArtistSort",
  AlbumSort: "albumSort",
  ComposerSort: "composerSort",

  // Identifiers
  Isrc: "isrc",
  Asin: "asin",
  CatalogNumber: "catalogNumber",
  Barcode: "barcode",

  // MusicBrainz Identifiers
  MusicBrainzArtistId: "musicbrainzArtistId",
  MusicBrainzReleaseArtistId: "musicbrainzReleaseArtistId",
  MusicBrainzWorkId: "musicbrainzWorkId",
  MusicBrainzReleaseId: "musicbrainzReleaseId",
  MusicBrainzRecordingId: "musicbrainzTrackId",
  MusicBrainzTrackId: "musicbrainzTrackId",
  MusicBrainzReleaseGroupId: "musicbrainzReleaseGroupId",
  MusicBrainzReleaseTrackId: "musicbrainzReleaseTrackId",

  // AcoustID
  AcoustidFingerprint: "acoustidFingerprint",
  AcoustidId: "acoustidId",

  // Podcast Properties
  PodcastId: "podcastId",
  PodcastUrl: "podcastUrl",

  // Grouping and Work
  Grouping: "grouping",
  Work: "work",

  // Additional Metadata
  Lyrics: "lyrics",
  AlbumGain: "replayGainAlbumGain",
  AlbumPeak: "replayGainAlbumPeak",
  TrackGain: "replayGainTrackGain",
  TrackPeak: "replayGainTrackPeak",

  // Original release
  OriginalArtist: "originalArtist",
  OriginalAlbum: "originalAlbum",
  OriginalDate: "originalDate",

  // Miscellaneous
  Script: "script",
  InvolvedPeople: "involvedPeople",
  Encoding: "encoding",
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
