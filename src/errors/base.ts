/**
 * List of audio formats supported by taglib-wasm
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
 * Base error class for all taglib-wasm errors
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
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "TagLibError";
    Object.setPrototypeOf(this, TagLibError.prototype);
  }
}

/**
 * Helper function to create consistent error messages
 */
export function createErrorMessage(prefix: string, details: string): string {
  return `${prefix}: ${details}`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
