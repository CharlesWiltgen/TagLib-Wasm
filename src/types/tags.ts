import type { PropertyKey } from "../constants/properties.ts";

/**
 * Basic metadata tags common to all audio formats.
 * String fields always return arrays to support multi-value metadata.
 * All fields are optional as not all formats support all fields.
 *
 * @example
 * ```typescript
 * const tag: Tag = {
 *   title: ["Song Title"],
 *   artist: ["Artist Name"],
 *   album: ["Album Name"],
 *   year: 2025,
 *   track: 5
 * };
 * ```
 */
export interface Tag {
  /** Track title */
  readonly title?: string[];
  /** Artist name */
  readonly artist?: string[];
  /** Album name */
  readonly album?: string[];
  /** Comment */
  readonly comment?: string[];
  /** Genre */
  readonly genre?: string[];
  /** Year */
  readonly year?: number;
  /** Track number */
  readonly track?: number;
}

/**
 * Basic tag data as returned by the internal FileHandle interface.
 * Single string values (not arrays) matching TagLib's C++ Tag accessors.
 * @internal
 */
export interface BasicTagData {
  title: string;
  artist: string;
  album: string;
  comment: string;
  genre: string;
  year: number;
  track: number;
}

/**
 * Input type for writing tags. Accepts both single strings and arrays.
 *
 * @example
 * ```typescript
 * await applyTags(file, {
 *   title: "New Title",
 *   artist: ["Artist One", "Artist Two"],
 *   year: 2025
 * });
 * ```
 */
export interface TagInput {
  /** Track title */
  readonly title?: string | string[];
  /** Artist name */
  readonly artist?: string | string[];
  /** Album name */
  readonly album?: string | string[];
  /** Comment */
  readonly comment?: string | string[];
  /** Genre */
  readonly genre?: string | string[];
  /** Year */
  readonly year?: number;
  /**
   * Full release date (e.g. "1975-10-31" or "1975"). Maps to the same DATE tag
   * as {@link year}; when both are provided, `date` wins (more precise).
   */
  readonly date?: string | string[];
  /** Track number */
  readonly track?: number;
  /**
   * Raw track field (e.g. "03" or "3/12"). Maps to the same TRACKNUMBER tag as
   * {@link track}; when both are provided, `trackNumber` wins (it preserves
   * zero-padding and the "/total" suffix that a number cannot).
   */
  readonly trackNumber?: string | string[];

  // Extended string fields
  readonly appleSoundCheck?: string | string[];
  readonly appleGaplessInfo?: string | string[];
  readonly albumArtist?: string | string[];
  readonly composer?: string | string[];
  readonly conductor?: string | string[];
  readonly copyright?: string | string[];
  readonly encodedBy?: string | string[];
  readonly isrc?: string | string[];
  readonly lyricist?: string | string[];
  readonly titleSort?: string | string[];
  readonly artistSort?: string | string[];
  readonly albumSort?: string | string[];
  readonly albumArtistSort?: string | string[];
  readonly composerSort?: string | string[];
  readonly label?: string | string[];
  readonly subtitle?: string | string[];
  readonly producer?: string | string[];
  readonly originalArtist?: string | string[];
  readonly originalAlbum?: string | string[];
  readonly originalDate?: string | string[];
  readonly acoustidFingerprint?: string | string[];
  readonly acoustidId?: string | string[];
  readonly musicbrainzTrackId?: string | string[];
  readonly musicbrainzReleaseId?: string | string[];
  readonly musicbrainzArtistId?: string | string[];
  readonly musicbrainzReleaseGroupId?: string | string[];
  /** Release type (album, single, EP, compilation, ...); multi-value allowed */
  readonly releaseType?: string | string[];
  /** Content advisory in the ITUNESADVISORY convention ('1' = explicit, '0' = clean) */
  readonly itunesAdvisory?: string | string[];
  /**
   * Content advisory tri-state (taglib-an30): "explicit" | "clean" |
   * "unspecified". Stored as MP4's native rtng atom on MP4, ITUNESADVISORY
   * elsewhere. "unspecified" clears the representation; undefined leaves it
   * unchanged.
   */
  readonly advisory?: "explicit" | "clean" | "unspecified";
  readonly replayGainTrackGain?: string | string[];
  readonly replayGainTrackPeak?: string | string[];
  readonly replayGainAlbumGain?: string | string[];
  readonly replayGainAlbumPeak?: string | string[];
  // EBU R128 loudness gains (RFC 7845): a number is DECIBELS, converted to
  // the signed Q7.8 wire value with round(dB x 256) (e.g. -2.23828125 ->
  // "-573"); a string[] is the raw wire integer, written verbatim.
  readonly r128TrackGain?: number | string[];
  readonly r128AlbumGain?: number | string[];

  // Extended numeric fields
  readonly discNumber?: number;
  readonly totalTracks?: number;
  readonly totalDiscs?: number;
  readonly bpm?: number;

  // Extended boolean fields
  readonly compilation?: boolean;
}

/**
 * Extended metadata with format-agnostic field names.
 * Includes advanced fields like MusicBrainz IDs, ReplayGain values,
 * and other specialized metadata. Field availability depends on
 * the audio format and existing metadata.
 *
 * @example
 * ```typescript
 * const extTag: ExtendedTag = {
 *   ...basicTag,
 *   albumArtist: ["Various Artists"],
 *   musicbrainzTrackId: ["123e4567-e89b-12d3-a456-426614174000"],
 *   replayGainTrackGain: ["-6.54 dB"],
 *   bpm: 120
 * };
 * ```
 */
export interface ExtendedTag extends Tag {
  /**
   * Full release date as stored in the DATE tag (e.g. "1975-10-31" or "1975").
   * Preserves day/month precision that the numeric {@link Tag.year} cannot.
   */
  readonly date?: string | string[];
  /**
   * Raw track field as stored in TRACKNUMBER (e.g. "03" or "3/12"). Preserves
   * the zero-padding and the "/total" suffix that the numeric
   * {@link Tag.track} cannot, so a readTags() -> applyTags() round-trip does
   * not silently drop them (taglib-qpl).
   */
  readonly trackNumber?: string | string[];
  /** AcoustID fingerprint (Chromaprint) */
  readonly acoustidFingerprint?: string[];
  /** AcoustID UUID */
  readonly acoustidId?: string[];
  /** MusicBrainz Track ID */
  readonly musicbrainzTrackId?: string[];
  /** MusicBrainz Release ID */
  readonly musicbrainzReleaseId?: string[];
  /** MusicBrainz Artist ID */
  readonly musicbrainzArtistId?: string[];
  /** MusicBrainz Release Group ID */
  readonly musicbrainzReleaseGroupId?: string[];
  /** Release type (album, single, EP, compilation, ...); multi-value */
  readonly releaseType?: string[];
  /** Content advisory in the ITUNESADVISORY convention ('1' = explicit, '0' = clean) */
  readonly itunesAdvisory?: string[];
  /**
   * Content advisory tri-state (taglib-an30): "explicit" | "clean" |
   * "unspecified" ("0" and absence both read as unspecified; unknown raw
   * values leave it unset while itunesAdvisory keeps the raw string).
   */
  readonly advisory?: "explicit" | "clean" | "unspecified";
  /** Album artist (different from track artist) */
  readonly albumArtist?: string[];
  /** Composer */
  readonly composer?: string[];
  /** Disc number */
  readonly discNumber?: number;
  /** Total tracks on album */
  readonly totalTracks?: number;
  /** Total discs in release */
  readonly totalDiscs?: number;
  /** BPM (beats per minute) */
  readonly bpm?: number;
  /** Compilation flag */
  readonly compilation?: boolean;
  /** Sort title for alphabetization */
  readonly titleSort?: string[];
  /** Sort artist for alphabetization */
  readonly artistSort?: string[];
  /** Sort album for alphabetization */
  readonly albumSort?: string[];
  /** Sort album artist for alphabetization */
  readonly albumArtistSort?: string[];
  /** Sort composer for alphabetization */
  readonly composerSort?: string[];
  /** Conductor */
  readonly conductor?: string[];
  /** Copyright */
  readonly copyright?: string[];
  /** Encoded by */
  readonly encodedBy?: string[];
  /** ISRC (International Standard Recording Code) */
  readonly isrc?: string[];
  /** Lyricist */
  readonly lyricist?: string[];
  /** Record label */
  readonly label?: string[];
  /** Subtitle or description refinement */
  readonly subtitle?: string[];
  /** Producer */
  readonly producer?: string[];
  /** Original artist of a cover or remix */
  readonly originalArtist?: string[];
  /** Original album of a cover or remix */
  readonly originalAlbum?: string[];
  /** Original release date */
  readonly originalDate?: string[];

  // ReplayGain fields
  /** ReplayGain track gain in dB (e.g., "-6.54 dB") */
  readonly replayGainTrackGain?: string[];
  /** ReplayGain track peak value (0.0-1.0) */
  readonly replayGainTrackPeak?: string[];
  /** ReplayGain album gain in dB */
  readonly replayGainAlbumGain?: string[];
  /** ReplayGain album peak value (0.0-1.0) */
  readonly replayGainAlbumPeak?: string[];
  // EBU R128 loudness gains (RFC 7845) as DECIBEL numbers: the wire value is
  // a signed Q7.8 integer (dB x 256, e.g. "-573" = -2.23828125 dB) and the
  // typed surface converts, so readTags() returns -2.23828125. Lossless on
  // readTags() -> applyTags() round-trips (see TagInput.r128TrackGain).
  readonly r128TrackGain?: number;
  readonly r128AlbumGain?: number;

  // Apple Sound Check
  /** Apple Sound Check normalization data (iTunNORM) */
  readonly appleSoundCheck?: string[];
  /** Apple gapless playback data: encoder delay and padding (iTunSMPB) */
  readonly appleGaplessInfo?: string[];
  /** Embedded pictures/artwork */
  readonly pictures?: import("./pictures.ts").Picture[];
  /** Popularity/rating data. Same shape as {@link AudioFile.getRatings}. */
  readonly ratings?: import("../constants/complex-properties.ts").Rating[];
  /** Unsynchronized lyrics. Same shape as {@link AudioFile.getLyrics}. */
  readonly lyrics?:
    import("../constants/complex-properties.ts").UnsyncedLyrics[];
  /**
   * Chapter markers. Populated from ID3v2 CHAP frames (MP3), QuickTime chapter
   * tracks, or Nero `chpl` atoms (MP4). See {@link Chapter}.
   */
  readonly chapters?: import("./chapters.ts").Chapter[];
  /** Parsed BWF `bext` (Broadcast Audio Extension) chunk. WAV and FLAC only. */
  readonly bext?: import("./bwf.ts").BroadcastAudioExtension;
  /** Raw BWF `bext` chunk bytes. WAV and FLAC only. */
  readonly bextData?: Uint8Array;
  /** Raw iXML chunk as a string. WAV and FLAC only. */
  readonly ixml?: string;
  /** Staged raw ID3v2 frame replacements: frame ID → list of body byte arrays. */
  id3v2Frames?: Record<string, Uint8Array[]>;
}

/**
 * Extended metadata properties map with known-key autocomplete.
 * Known keys (from PROPERTIES) are optional and provide IDE autocomplete.
 * Arbitrary string keys are also supported for non-standard fields.
 *
 * @example
 * ```typescript
 * const properties: PropertyMap = {
 *   title: ["Song Title"],
 *   artist: ["Artist Name"],
 *   musicbrainzTrackId: ["123e4567-e89b-12d3-a456-426614174000"]
 * };
 * ```
 */
export type PropertyMap =
  & { [K in PropertyKey]?: string[] }
  & { [key: string]: string[] | undefined };

/**
 * Re-export TagName type from constants
 */
export type { TagName } from "../constants.ts";
