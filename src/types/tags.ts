/**
 * Basic metadata tags common to all audio formats.
 * These are the standard fields supported by most audio files.
 * All fields are optional as not all formats support all fields.
 *
 * @example
 * ```typescript
 * const tag: Tag = {
 *   title: "Song Title",
 *   artist: "Artist Name",
 *   album: "Album Name",
 *   year: 2025,
 *   track: 5
 * };
 * ```
 */
export interface Tag {
  /** Track title */
  title?: string;
  /** Artist name */
  artist?: string;
  /** Album name */
  album?: string;
  /** Comment */
  comment?: string;
  /** Genre */
  genre?: string;
  /** Year */
  year?: number;
  /** Track number */
  track?: number;
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
 *   albumArtist: "Various Artists",
 *   musicbrainzTrackId: "123e4567-e89b-12d3-a456-426614174000",
 *   replayGainTrackGain: "-6.54 dB",
 *   bpm: 120
 * };
 * ```
 */
export interface ExtendedTag extends Tag {
  /** AcoustID fingerprint (Chromaprint) */
  acoustidFingerprint?: string;
  /** AcoustID UUID */
  acoustidId?: string;
  /** MusicBrainz Track ID */
  musicbrainzTrackId?: string;
  /** MusicBrainz Release ID */
  musicbrainzReleaseId?: string;
  /** MusicBrainz Artist ID */
  musicbrainzArtistId?: string;
  /** MusicBrainz Release Group ID */
  musicbrainzReleaseGroupId?: string;
  /** Album artist (different from track artist) */
  albumArtist?: string;
  /** Composer */
  composer?: string;
  /** Disc number */
  discNumber?: number;
  /** Total tracks on album */
  totalTracks?: number;
  /** Total discs in release */
  totalDiscs?: number;
  /** BPM (beats per minute) */
  bpm?: number;
  /** Compilation flag */
  compilation?: boolean;
  /** Sort title for alphabetization */
  titleSort?: string;
  /** Sort artist for alphabetization */
  artistSort?: string;
  /** Sort album for alphabetization */
  albumSort?: string;

  // ReplayGain fields
  /** ReplayGain track gain in dB (e.g., "-6.54 dB") */
  replayGainTrackGain?: string;
  /** ReplayGain track peak value (0.0-1.0) */
  replayGainTrackPeak?: string;
  /** ReplayGain album gain in dB */
  replayGainAlbumGain?: string;
  /** ReplayGain album peak value (0.0-1.0) */
  replayGainAlbumPeak?: string;

  // Apple Sound Check
  /** Apple Sound Check normalization data (iTunNORM) */
  appleSoundCheck?: string;
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
