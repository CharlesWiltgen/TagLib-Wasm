/**
 * List of audio formats supported by TagLib-Wasm
 */
export const SUPPORTED_FORMATS = [
  "MP3",
  "MP4",
  "M4A",
  "FLAC",
  "OGG",
  "WAV",
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
  | "WORKER"
  | "SIDECAR";

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
