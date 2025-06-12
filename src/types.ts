/**
 * @fileoverview TypeScript type definitions for taglib-wasm
 */

// Re-export commonly used classes from other modules
export type { TagLibModule } from "./wasm-jsr.ts";
// Note: AudioFile is not needed for JSR exports

/**
 * Audio format types supported by TagLib
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
 * Audio properties containing technical information about the file
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
  /** Audio format */
  readonly format: AudioFormat;
}

/**
 * Basic metadata tags
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
 * Extended metadata with format-agnostic field names
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
 * Format-specific field mapping for automatic tag mapping
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
 * Complete metadata field mappings for all formats
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
 * Extended metadata properties map
 */
export interface PropertyMap {
  [key: string]: string[];
}

/**
 * Picture/artwork data
 */
export interface Picture {
  /** MIME type of the image */
  mimeType: string;
  /** Image data */
  data: Uint8Array;
  /** Picture type (front cover, back cover, etc.) */
  type: PictureType;
  /** Description */
  description?: string;
}

/**
 * Picture types as defined by ID3v2 APIC frame
 */
export enum PictureType {
  Other = 0,
  FileIcon = 1,
  OtherFileIcon = 2,
  FrontCover = 3,
  BackCover = 4,
  LeafletPage = 5,
  Media = 6,
  LeadArtist = 7,
  Artist = 8,
  Conductor = 9,
  Band = 10,
  Composer = 11,
  Lyricist = 12,
  RecordingLocation = 13,
  DuringRecording = 14,
  DuringPerformance = 15,
  MovieScreenCapture = 16,
  ColouredFish = 17,
  Illustration = 18,
  BandLogo = 19,
  PublisherLogo = 20,
}

/**
 * Bitrate control modes for audio encoding (MP4/M4A specific)
 */
export type BitrateControlMode = 
  | "Constant"
  | "LongTermAverage" 
  | "VariableConstrained"
  | "Variable";

/**
 * Map of bitrate control mode names to their numeric values
 */
export const BITRATE_CONTROL_MODE_VALUES: Record<BitrateControlMode, number> = {
  Constant: 0,
  LongTermAverage: 1,
  VariableConstrained: 2,
  Variable: 3,
};

/**
 * Map of numeric values to bitrate control mode names
 */
export const BITRATE_CONTROL_MODE_NAMES: Record<number, BitrateControlMode> = {
  0: "Constant",
  1: "LongTermAverage",
  2: "VariableConstrained",
  3: "Variable",
};

/**
 * Configuration options for TagLib initialization
 */
export interface TagLibConfig {
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
