import { SUPPORTED_FORMATS, TagLibError } from "./base.ts";

function createErrorMessage(prefix: string, details: string): string {
  return `${prefix}: ${details}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Error thrown when the Wasm module fails to initialize
 */
export class TagLibInitializationError extends TagLibError {
  /**
   * Creates a new TagLibInitializationError
   * @param message - Description of the initialization failure
   * @param details - Additional context about the error
   */
  constructor(message: string, details?: Record<string, unknown>) {
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
  /**
   * Creates a new InvalidFormatError
   * @param message - Description of the format error
   * @param bufferSize - Size of the audio buffer in bytes
   * @param details - Additional context about the error
   */
  constructor(
    message: string,
    public readonly bufferSize?: number,
    details?: Record<string, unknown>,
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
  /**
   * Creates a new UnsupportedFormatError
   * @param format - The unsupported format that was encountered
   * @param supportedFormats - List of formats that are supported
   * @param details - Additional context about the error
   */
  constructor(
    public readonly format: string,
    public readonly supportedFormats: readonly string[] = SUPPORTED_FORMATS,
    details?: Record<string, unknown>,
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
  /**
   * Creates a new FileOperationError
   * @param operation - The file operation that failed
   * @param message - Description of the failure
   * @param path - File path involved in the operation
   * @param details - Additional context about the error
   */
  constructor(
    public readonly operation: "read" | "write" | "save" | "stat",
    message: string,
    public readonly path?: string,
    details?: Record<string, unknown>,
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
  /**
   * Creates a new MetadataError
   * @param operation - The metadata operation that failed
   * @param message - Description of the failure
   * @param field - The metadata field involved
   * @param details - Additional context about the error
   */
  constructor(
    public readonly operation: "read" | "write",
    message: string,
    public readonly field?: string,
    details?: Record<string, unknown>,
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
  /**
   * Creates a new MemoryError
   * @param message - Description of the memory failure
   * @param details - Additional context about the error
   */
  constructor(message: string, details?: Record<string, unknown>) {
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
  /**
   * Creates a new EnvironmentError
   * @param environment - The runtime environment name
   * @param reason - Why the environment is incompatible
   * @param requiredFeature - The feature that is missing
   */
  constructor(
    public readonly environment: string,
    public readonly reason: string,
    public readonly requiredFeature?: string,
  ) {
    const message = requiredFeature
      ? `Environment '${environment}' ${reason}. Required feature: ${requiredFeature}.`
      : `Environment '${environment}' ${reason}.`;
    super("ENVIRONMENT", message);
    this.name = "EnvironmentError";
    Object.setPrototypeOf(this, EnvironmentError.prototype);
  }
}

/**
 * Error thrown when sidecar process operations fail
 */
export class SidecarError extends TagLibError {
  /**
   * Creates a new SidecarError
   * @param message - Description of the sidecar failure
   * @param details - Additional context about the error
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super("SIDECAR", message, details);
    this.name = "SidecarError";
    Object.setPrototypeOf(this, SidecarError.prototype);
  }
}
