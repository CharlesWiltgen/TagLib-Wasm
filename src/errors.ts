/**
 * Custom error types for taglib-wasm with enhanced context and debugging information
 */

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
export enum TagLibErrorCode {
  INITIALIZATION_FAILED = "INITIALIZATION_FAILED",
  INVALID_FORMAT = "INVALID_FORMAT",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  FILE_OPERATION_FAILED = "FILE_OPERATION_FAILED",
  METADATA_ERROR = "METADATA_ERROR",
  MEMORY_ERROR = "MEMORY_ERROR",
  ENVIRONMENT_ERROR = "ENVIRONMENT_ERROR",
}

/**
 * Base error class for all taglib-wasm errors
 */
export class TagLibError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "TagLibError";
    Object.setPrototypeOf(this, TagLibError.prototype);
  }
}

/**
 * Error thrown when the Wasm module fails to initialize
 */
export class TagLibInitializationError extends TagLibError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      "INITIALIZATION",
      createErrorMessage("Failed to initialize TagLib Wasm module", message),
      details,
    );
    this.name = "TagLibInitializationError";
    Object.setPrototypeOf(this, TagLibInitializationError.prototype);
  }
}

/**
 * Error thrown when an audio file format is invalid or corrupted
 */
export class InvalidFormatError extends TagLibError {
  constructor(
    message: string,
    public readonly bufferSize?: number,
    details?: Record<string, any>,
  ) {
    const errorDetails = [`Invalid audio file format: ${message}`];

    if (bufferSize !== undefined) {
      errorDetails.push(`Buffer size: ${formatFileSize(bufferSize)}`);
      if (bufferSize < 1024) {
        errorDetails.push(
          "Audio files must be at least 1KB to contain valid headers.",
        );
      }
    }

    super(
      "INVALID_FORMAT",
      errorDetails.join(". "),
      { ...details, bufferSize },
    );
    this.name = "InvalidFormatError";
    Object.setPrototypeOf(this, InvalidFormatError.prototype);
  }
}

/**
 * Error thrown when an audio format is recognized but not supported
 */
export class UnsupportedFormatError extends TagLibError {
  constructor(
    public readonly format: string,
    public readonly supportedFormats: readonly string[] = SUPPORTED_FORMATS,
    details?: Record<string, any>,
  ) {
    super(
      "UNSUPPORTED_FORMAT",
      `Unsupported audio format: ${format}. Supported formats: ${
        supportedFormats.join(", ")
      }`,
      { ...details, format, supportedFormats },
    );
    this.name = "UnsupportedFormatError";
    Object.setPrototypeOf(this, UnsupportedFormatError.prototype);
  }
}

/**
 * Error thrown during file operations (read, write, save)
 */
export class FileOperationError extends TagLibError {
  constructor(
    public readonly operation: "read" | "write" | "save" | "stat",
    message: string,
    public readonly path?: string,
    details?: Record<string, any>,
  ) {
    const errorDetails = [`Failed to ${operation} file`];
    if (path) {
      errorDetails.push(`Path: ${path}`);
    }
    errorDetails.push(message);

    super(
      "FILE_OPERATION",
      errorDetails.join(". "),
      { ...details, operation, path },
    );
    this.name = "FileOperationError";
    Object.setPrototypeOf(this, FileOperationError.prototype);
  }
}

/**
 * Error thrown when metadata operations fail
 */
export class MetadataError extends TagLibError {
  constructor(
    public readonly operation: "read" | "write",
    message: string,
    public readonly field?: string,
    details?: Record<string, any>,
  ) {
    const errorDetails = [`Failed to ${operation} metadata`];
    if (field) {
      errorDetails.push(`Field: ${field}`);
    }
    errorDetails.push(message);

    super(
      "METADATA",
      errorDetails.join(". "),
      { ...details, operation, field },
    );
    this.name = "MetadataError";
    Object.setPrototypeOf(this, MetadataError.prototype);
  }
}

/**
 * Error thrown when Wasm memory operations fail
 */
export class MemoryError extends TagLibError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      "MEMORY",
      createErrorMessage("Memory allocation failed", message),
      details,
    );
    this.name = "MemoryError";
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

/**
 * Error thrown when the environment doesn't support required features
 */
export class EnvironmentError extends TagLibError {
  constructor(
    public readonly environment: string,
    public readonly reason: string,
    public readonly requiredFeature?: string,
  ) {
    const message = requiredFeature
      ? `Environment '${environment}' ${reason}. Required feature: ${requiredFeature}.`
      : `Environment '${environment}' ${reason}.`;
    super("ENVIRONMENT", message);
  }
}

/**
 * Error thrown when worker pool operations fail
 *
 * @example
 * ```typescript
 * throw new WorkerError("Worker initialization timed out");
 * ```
 */
export class WorkerError extends TagLibError {
  constructor(message: string, details?: Record<string, any>) {
    super("WORKER", message, details);
    this.name = "WorkerError";
    Object.setPrototypeOf(this, WorkerError.prototype);
  }
}

/**
 * Helper function to create consistent error messages
 */
function createErrorMessage(prefix: string, details: string): string {
  return `${prefix}: ${details}`;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Type guards for error handling
 */
export function isTagLibError(error: unknown): error is TagLibError {
  return error instanceof TagLibError;
}

export function isInvalidFormatError(
  error: unknown,
): error is InvalidFormatError {
  return error instanceof InvalidFormatError;
}

export function isUnsupportedFormatError(
  error: unknown,
): error is UnsupportedFormatError {
  return error instanceof UnsupportedFormatError;
}

export function isFileOperationError(
  error: unknown,
): error is FileOperationError {
  return error instanceof FileOperationError;
}

export function isMetadataError(error: unknown): error is MetadataError {
  return error instanceof MetadataError;
}

export function isMemoryError(error: unknown): error is MemoryError {
  return error instanceof MemoryError;
}

export function isEnvironmentError(error: unknown): error is EnvironmentError {
  return error instanceof EnvironmentError;
}
