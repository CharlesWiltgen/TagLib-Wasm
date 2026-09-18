/**
 * List of audio formats supported by TagLib-Wasm.
 *
 * The prose source of truth is the README's "Supported Formats" section; this
 * list carries every `FileType` member except `"unknown"` (src/types/audio-
 * formats.ts), plus the extension aliases files actually carry ("M4A", "MKA")
 * — ASF is the container of the WMA flavour the README names.
 *
 * Public contract: the default `supportedFormats` on `UnsupportedFormatError`
 * (src/errors/classes.ts), and part of that error's message.
 *
 * This is the formats the library can read, not a promise that both backends
 * read all of them identically. Measured today (taglib-uat8): on Emscripten the
 * tracker modules (MOD/S3M/IT/XM) throw `InvalidFormatError`, and on WASI
 * `getFormat()` answers `"unknown"` for those four plus APE, DSF, DSDIFF, MPC
 * and SHN, whose tags and properties still load.
 */
export const SUPPORTED_FORMATS = [
  "MP3",
  "AAC",
  "MP4",
  "M4A",
  "FLAC",
  "OGG",
  "OPUS",
  "OggFLAC",
  "SPEEX",
  "WAV",
  "AIFF",
  "ASF",
  "APE",
  "DSF",
  "DSDIFF",
  "WV",
  "MPC",
  "TTA",
  "SHN",
  "MOD",
  "S3M",
  "IT",
  "XM",
  "MATROSKA",
  "MKA",
] as const;

/**
 * Error codes for programmatic error handling
 */
export type TagLibErrorCode =
  | "INITIALIZATION"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_FORMAT"
  | "FILE_OPERATION"
  | "METADATA"
  | "MEMORY"
  | "ENVIRONMENT"
  | "WASM_MEMORY"
  | "MODULE_LOAD"
  | "WASI_HOST";

/**
 * Base error class for all TagLib-Wasm errors
 */
export class TagLibError extends Error {
  /**
   * Creates a new TagLibError
   * @param code - Error code for programmatic handling
   * @param message - Human-readable error message
   * @param details - Additional context about the error
   */
  constructor(
    public readonly code: TagLibErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TagLibError";
    Object.setPrototypeOf(this, TagLibError.prototype);
  }
}
