/**
 * Input types accepted by TagLib-Wasm for audio files
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
