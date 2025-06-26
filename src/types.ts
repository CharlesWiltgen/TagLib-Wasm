/**
 * @fileoverview TypeScript type definitions for taglib-wasm
 *
 * This module contains all the type definitions used throughout
 * the taglib-wasm library, including metadata structures,
 * audio properties, and format-specific mappings.
 *
 * @module taglib-wasm/types
 */

// Re-export commonly used classes from other modules
export type { TagLibModule } from "./wasm.ts";
// Note: AudioFile is not needed for JSR exports

/**
 * Input types accepted by taglib-wasm for audio files
 */
export type AudioFileInput = string | Uint8Array | ArrayBuffer | File;

/**
 * Supported file types detected by TagLib.
 * "UNKNOWN" indicates the format could not be determined.
 *
 * @example
 * ```typescript
 * const file = await taglib.open(buffer);
 * const format = file.getFormat();
 * if (format === "MP3") {
 *   // Handle MP3-specific features
 * }
 * ```
 */
export type FileType =
  | "MP3"
  | "MP4"
  | "FLAC"
  | "OGG"
  | "OPUS"
  | "WAV"
  | "AIFF"
  | "UNKNOWN";

/**
 * Container formats for audio files.
 * A container format defines how audio data and metadata are stored in a file.
 * Note that some formats like MP3 and FLAC are both container and codec.
 *
 * @example
 * ```typescript
 * const props = file.audioProperties();
 * console.log(`Container: ${props.containerFormat}`); // "MP4"
 * console.log(`Codec: ${props.codec}`);               // "AAC"
 * ```
 */
export type ContainerFormat =
  | "MP3" // MPEG Layer 3 (container and codec)
  | "MP4" // ISO Base Media File Format (includes .m4a files)
  | "FLAC" // Free Lossless Audio Codec (container and codec)
  | "OGG" // Ogg container (can contain Vorbis, Opus, FLAC, Speex)
  | "WAV" // RIFF WAVE format
  | "AIFF" // Audio Interchange File Format
  | "UNKNOWN";

/**
 * Audio codecs (compression formats) for audio data.
 * A codec defines how audio is encoded/compressed within a container.
 *
 * @example
 * ```typescript
 * // MP4 container can have different codecs:
 * const props1 = file1.audioProperties();
 * console.log(props1.containerFormat); // "MP4"
 * console.log(props1.codec);           // "AAC" (lossy)
 *
 * const props2 = file2.audioProperties();
 * console.log(props2.containerFormat); // "MP4"
 * console.log(props2.codec);           // "ALAC" (lossless)
 * ```
 */
export type AudioCodec =
  | "AAC" // Advanced Audio Coding (lossy)
  | "ALAC" // Apple Lossless Audio Codec
  | "MP3" // MPEG Layer 3 (lossy)
  | "FLAC" // Free Lossless Audio Codec
  | "Vorbis" // Ogg Vorbis (lossy)
  | "Opus" // Opus (lossy)
  | "PCM" // Pulse Code Modulation (uncompressed)
  | "IEEE Float" // IEEE floating-point PCM
  | "WAV" // Generic WAV codec (when specific codec unknown)
  | "Unknown";

/**
 * Audio format types supported by TagLib.
 * More comprehensive than FileType, includes additional formats
 * that TagLib can read but may have limited support.
 */
export type AudioFormat =
  | "MP3"
  | "MP4"
  | "M4A"
  | "FLAC"
  | "OGG"
  | "OPUS"
  | "WAV"
  | "AIFF"
  | "WMA"
  | "APE"
  | "MPC"
  | "TTA"
  | "WV"
  | "MOD"
  | "IT"
  | "S3M"
  | "XM";

/**
 * Audio properties containing technical information about the file.
 * All properties are read-only and represent the actual audio stream data.
 *
 * @example
 * ```typescript
 * const props = file.audioProperties();
 * console.log(`Duration: ${props.length} seconds`);
 * console.log(`Bitrate: ${props.bitrate} kbps`);
 * console.log(`Sample rate: ${props.sampleRate} Hz`);
 * console.log(`Container: ${props.containerFormat}`);
 * console.log(`Codec: ${props.codec}`);
 * console.log(`Is lossless: ${props.isLossless}`);
 * ```
 */
export interface AudioProperties {
  /** Length of the audio in seconds */
  readonly length: number;
  /** Bitrate in kb/s */
  readonly bitrate: number;
  /** Sample rate in Hz */
  readonly sampleRate: number;
  /** Number of audio channels */
  readonly channels: number;
  /** Bits per sample (0 if not applicable or unknown) */
  readonly bitsPerSample: number;
  /** Audio codec (e.g., "AAC", "ALAC", "MP3", "FLAC", "PCM") */
  readonly codec: string;
  /** Container format (e.g., "MP4", "OGG", "MP3", "FLAC") */
  readonly containerFormat: string;
  /** Whether the audio is lossless (uncompressed or losslessly compressed) */
  readonly isLossless: boolean;
}

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
 * Format-specific field mapping for automatic tag mapping.
 * Defines how a metadata field maps to different audio formats.
 * Used internally for format-agnostic metadata operations.
 *
 * @example
 * ```typescript
 * const artistMapping: FieldMapping = {
 *   id3v2: { frame: "TPE1" },
 *   vorbis: "ARTIST",
 *   mp4: "©ART",
 *   wav: "IART"
 * };
 * ```
 */
export interface FieldMapping {
  /** MP3 ID3v2 mapping */
  id3v2?: {
    frame: string;
    description?: string; // For TXXX frames
  };
  /** FLAC/OGG Vorbis Comments mapping */
  vorbis?: string;
  /** MP4/M4A atom mapping */
  mp4?: string;
  /** WAV INFO chunk mapping */
  wav?: string;
}

/**
 * Complete metadata field mappings for all formats.
 * This constant defines how each ExtendedTag field maps to
 * format-specific metadata fields across different audio formats.
 * Used for automatic tag mapping in format-agnostic operations.
 *
 * @example
 * ```typescript
 * // Get the ID3v2 frame for the artist field
 * const artistFrame = METADATA_MAPPINGS.artist.id3v2?.frame; // "TPE1"
 *
 * // Get the Vorbis comment field for album artist
 * const vorbisField = METADATA_MAPPINGS.albumArtist.vorbis; // "ALBUMARTIST"
 * ```
 */
export const METADATA_MAPPINGS: Record<keyof ExtendedTag, FieldMapping> = {
  // Basic fields (already handled by TagLib's standard API)
  title: {
    id3v2: { frame: "TIT2" },
    vorbis: "TITLE",
    mp4: "©nam",
    wav: "INAM",
  },
  artist: {
    id3v2: { frame: "TPE1" },
    vorbis: "ARTIST",
    mp4: "©ART",
    wav: "IART",
  },
  album: {
    id3v2: { frame: "TALB" },
    vorbis: "ALBUM",
    mp4: "©alb",
    wav: "IPRD",
  },
  comment: {
    id3v2: { frame: "COMM" },
    vorbis: "COMMENT",
    mp4: "©cmt",
    wav: "ICMT",
  },
  genre: {
    id3v2: { frame: "TCON" },
    vorbis: "GENRE",
    mp4: "©gen",
    wav: "IGNR",
  },
  year: {
    id3v2: { frame: "TDRC" },
    vorbis: "DATE",
    mp4: "©day",
    wav: "ICRD",
  },
  track: {
    id3v2: { frame: "TRCK" },
    vorbis: "TRACKNUMBER",
    mp4: "trkn",
    wav: "ITRK",
  },

  // Advanced fields requiring format-specific handling
  acoustidFingerprint: {
    id3v2: { frame: "TXXX", description: "Acoustid Fingerprint" },
    vorbis: "ACOUSTID_FINGERPRINT",
    mp4: "----:com.apple.iTunes:Acoustid Fingerprint",
  },
  acoustidId: {
    id3v2: { frame: "TXXX", description: "Acoustid Id" },
    vorbis: "ACOUSTID_ID",
    mp4: "----:com.apple.iTunes:Acoustid Id",
  },
  musicbrainzTrackId: {
    id3v2: { frame: "UFID", description: "http://musicbrainz.org" },
    vorbis: "MUSICBRAINZ_TRACKID",
    mp4: "----:com.apple.iTunes:MusicBrainz Track Id",
  },
  musicbrainzReleaseId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Album Id" },
    vorbis: "MUSICBRAINZ_ALBUMID",
    mp4: "----:com.apple.iTunes:MusicBrainz Album Id",
  },
  musicbrainzArtistId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Artist Id" },
    vorbis: "MUSICBRAINZ_ARTISTID",
    mp4: "----:com.apple.iTunes:MusicBrainz Artist Id",
  },
  musicbrainzReleaseGroupId: {
    id3v2: { frame: "TXXX", description: "MusicBrainz Release Group Id" },
    vorbis: "MUSICBRAINZ_RELEASEGROUPID",
    mp4: "----:com.apple.iTunes:MusicBrainz Release Group Id",
  },
  albumArtist: {
    id3v2: { frame: "TPE2" },
    vorbis: "ALBUMARTIST",
    mp4: "aART",
  },
  composer: {
    id3v2: { frame: "TCOM" },
    vorbis: "COMPOSER",
    mp4: "©wrt",
  },
  discNumber: {
    id3v2: { frame: "TPOS" },
    vorbis: "DISCNUMBER",
    mp4: "disk",
  },
  totalTracks: {
    id3v2: { frame: "TRCK" }, // Part of TRCK frame
    vorbis: "TRACKTOTAL",
    mp4: "trkn", // Part of trkn atom
  },
  totalDiscs: {
    id3v2: { frame: "TPOS" }, // Part of TPOS frame
    vorbis: "DISCTOTAL",
    mp4: "disk", // Part of disk atom
  },
  bpm: {
    id3v2: { frame: "TBPM" },
    vorbis: "BPM",
    mp4: "tmpo",
  },
  compilation: {
    id3v2: { frame: "TCMP" },
    vorbis: "COMPILATION",
    mp4: "cpil",
  },
  titleSort: {
    id3v2: { frame: "TSOT" },
    vorbis: "TITLESORT",
    mp4: "sonm",
  },
  artistSort: {
    id3v2: { frame: "TSOP" },
    vorbis: "ARTISTSORT",
    mp4: "soar",
  },
  albumSort: {
    id3v2: { frame: "TSOA" },
    vorbis: "ALBUMSORT",
    mp4: "soal",
  },

  // ReplayGain mappings
  replayGainTrackGain: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Track_Gain" },
    vorbis: "REPLAYGAIN_TRACK_GAIN",
    mp4: "----:com.apple.iTunes:replaygain_track_gain",
  },
  replayGainTrackPeak: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Track_Peak" },
    vorbis: "REPLAYGAIN_TRACK_PEAK",
    mp4: "----:com.apple.iTunes:replaygain_track_peak",
  },
  replayGainAlbumGain: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Album_Gain" },
    vorbis: "REPLAYGAIN_ALBUM_GAIN",
    mp4: "----:com.apple.iTunes:replaygain_album_gain",
  },
  replayGainAlbumPeak: {
    id3v2: { frame: "TXXX", description: "ReplayGain_Album_Peak" },
    vorbis: "REPLAYGAIN_ALBUM_PEAK",
    mp4: "----:com.apple.iTunes:replaygain_album_peak",
  },

  // Apple Sound Check mapping
  appleSoundCheck: {
    id3v2: { frame: "TXXX", description: "iTunNORM" },
    vorbis: "ITUNNORM", // Some tools store it in Vorbis comments too
    mp4: "----:com.apple.iTunes:iTunNORM",
  },
};

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
export type { TagName } from "./constants.ts";

/**
 * Picture/artwork data embedded in audio files.
 * Represents album art, artist photos, or other images.
 *
 * @example
 * ```typescript
 * const picture: Picture = {
 *   mimeType: "image/jpeg",
 *   data: new Uint8Array(imageBuffer),
 *   type: "FrontCover",
 *   description: "Album cover"
 * };
 * ```
 */
export interface Picture {
  /** MIME type of the image */
  mimeType: string;
  /** Image data */
  data: Uint8Array;
  /** Picture type (front cover, back cover, etc.) */
  type: number;
  /** Description */
  description?: string;
}

/**
 * Picture types as defined by ID3v2 APIC frame.
 * Standard picture type codes used across different formats
 * to categorize embedded images.
 *
 * @example
 * ```typescript
 * // Set front cover art
 * const coverArt = {
 *   type: "FrontCover",
 *   mimeType: "image/jpeg",
 *   data: imageData
 * };
 * ```
 */
export type PictureType =
  | "Other"
  | "FileIcon"
  | "OtherFileIcon"
  | "FrontCover"
  | "BackCover"
  | "LeafletPage"
  | "Media"
  | "LeadArtist"
  | "Artist"
  | "Conductor"
  | "Band"
  | "Composer"
  | "Lyricist"
  | "RecordingLocation"
  | "DuringRecording"
  | "DuringPerformance"
  | "MovieScreenCapture"
  | "ColouredFish"
  | "Illustration"
  | "BandLogo"
  | "PublisherLogo";

/**
 * Map of picture type names to their numeric values.
 * Used for converting between string representations and numeric codes.
 */
export const PICTURE_TYPE_VALUES: Record<PictureType, number> = {
  Other: 0,
  FileIcon: 1,
  OtherFileIcon: 2,
  FrontCover: 3,
  BackCover: 4,
  LeafletPage: 5,
  Media: 6,
  LeadArtist: 7,
  Artist: 8,
  Conductor: 9,
  Band: 10,
  Composer: 11,
  Lyricist: 12,
  RecordingLocation: 13,
  DuringRecording: 14,
  DuringPerformance: 15,
  MovieScreenCapture: 16,
  ColouredFish: 17,
  Illustration: 18,
  BandLogo: 19,
  PublisherLogo: 20,
};

/**
 * Map of numeric values to picture type names.
 * Used for converting numeric codes to string representations.
 */
export const PICTURE_TYPE_NAMES: Record<number, PictureType> = {
  0: "Other",
  1: "FileIcon",
  2: "OtherFileIcon",
  3: "FrontCover",
  4: "BackCover",
  5: "LeafletPage",
  6: "Media",
  7: "LeadArtist",
  8: "Artist",
  9: "Conductor",
  10: "Band",
  11: "Composer",
  12: "Lyricist",
  13: "RecordingLocation",
  14: "DuringRecording",
  15: "DuringPerformance",
  16: "MovieScreenCapture",
  17: "ColouredFish",
  18: "Illustration",
  19: "BandLogo",
  20: "PublisherLogo",
};

/**
 * Bitrate control modes for audio encoding (MP4/M4A specific).
 * Indicates how the audio was encoded in terms of bitrate management.
 *
 * - Constant: Fixed bitrate throughout the file
 * - LongTermAverage: Average bitrate over time
 * - VariableConstrained: Variable within limits
 * - Variable: Fully variable bitrate
 */
export type BitrateControlMode =
  | "Constant"
  | "LongTermAverage"
  | "VariableConstrained"
  | "Variable";

/**
 * Map of bitrate control mode names to their numeric values.
 * Used for converting between string representations and numeric codes
 * stored in MP4/M4A files.
 */
export const BITRATE_CONTROL_MODE_VALUES: Record<BitrateControlMode, number> = {
  Constant: 0,
  LongTermAverage: 1,
  VariableConstrained: 2,
  Variable: 3,
};

/**
 * Map of numeric values to bitrate control mode names.
 * Used for converting numeric codes from MP4/M4A files
 * to human-readable string representations.
 */
export const BITRATE_CONTROL_MODE_NAMES: Record<number, BitrateControlMode> = {
  0: "Constant",
  1: "LongTermAverage",
  2: "VariableConstrained",
  3: "Variable",
};

/**
 * Configuration options for TagLib Workers initialization.
 * Allows customization of memory limits and debug settings.
 *
 * @example
 * ```typescript
 * const config: TagLibWorkersConfig = {
 *   memory: {
 *     initial: 16 * 1024 * 1024,  // 16MB
 *     maximum: 64 * 1024 * 1024   // 64MB
 *   },
 *   debug: true
 * };
 *
 * const taglib = await TagLibWorkers.initialize(wasmBinary, config);
 * ```
 */
export interface TagLibWorkersConfig {
  /** Memory allocation settings */
  memory?: {
    /** Initial memory size in bytes */
    initial?: number;
    /** Maximum memory size in bytes */
    maximum?: number;
  };
  /** Enable debug output */
  debug?: boolean;
}

/**
 * Options for opening audio files with partial loading support.
 *
 * @example
 * ```typescript
 * // Enable partial loading for large files
 * const file = await taglib.open(largeFile, {
 *   partial: true,
 *   maxHeaderSize: 2 * 1024 * 1024, // 2MB
 *   maxFooterSize: 256 * 1024        // 256KB
 * });
 * ```
 */
export interface OpenOptions {
  /**
   * Enable partial file loading for better performance with large files.
   * When enabled, only the header and footer sections are loaded initially.
   * The full file is loaded automatically when save() is called.
   *
   * @default false
   */
  partial?: boolean;

  /**
   * Maximum size of the header section to load (in bytes).
   * This should be large enough to contain all metadata at the beginning of the file.
   *
   * @default 1048576 (1MB)
   */
  maxHeaderSize?: number;

  /**
   * Maximum size of the footer section to load (in bytes).
   * This should be large enough to contain metadata at the end of the file (e.g., ID3v1 tags).
   *
   * @default 131072 (128KB)
   */
  maxFooterSize?: number;
}
