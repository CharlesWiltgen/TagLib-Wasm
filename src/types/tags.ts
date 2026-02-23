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
 * Input type for writing tags. Accepts both single strings and arrays.
 *
 * @example
 * ```typescript
 * await applyTagsToBuffer(file, {
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
  /** Track number */
  readonly track?: number;
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

  // ReplayGain fields
  /** ReplayGain track gain in dB (e.g., "-6.54 dB") */
  readonly replayGainTrackGain?: string[];
  /** ReplayGain track peak value (0.0-1.0) */
  readonly replayGainTrackPeak?: string[];
  /** ReplayGain album gain in dB */
  readonly replayGainAlbumGain?: string[];
  /** ReplayGain album peak value (0.0-1.0) */
  readonly replayGainAlbumPeak?: string[];

  // Apple Sound Check
  /** Apple Sound Check normalization data (iTunNORM) */
  readonly appleSoundCheck?: string[];
  /** Embedded pictures/artwork */
  readonly pictures?: import("./pictures.ts").Picture[];
  /** Popularity/rating data */
  readonly ratings?: Array<{ rating: number; email: string; counter: number }>;
}

/**
 * Extended metadata properties map.
 * A flexible key-value structure where each key can have multiple values.
 * Used for accessing all metadata in a file, including non-standard fields.
 *
 * @example
 * ```typescript
 * const properties: PropertyMap = {
 *   "ARTIST": ["Artist Name"],
 *   "ALBUMARTIST": ["Album Artist"],
 *   "MUSICBRAINZ_TRACKID": ["123e4567-e89b-12d3-a456-426614174000"]
 * };
 * ```
 */
export interface PropertyMap {
  [key: string]: string[];
}

/**
 * Re-export TagName type from constants
 */
export type { TagName } from "../constants.ts";
