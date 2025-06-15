/**
 * Custom error types for taglib-wasm with enhanced context and debugging information
 */

/**
 * List of audio formats supported by taglib-wasm
 */
export const SUPPORTED_FORMATS = ['MP3', 'MP4', 'M4A', 'FLAC', 'OGG', 'WAV'] as const;

/**
 * Error codes for programmatic error handling
 */
export enum TagLibErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_OPERATION_FAILED = 'FILE_OPERATION_FAILED',
  METADATA_ERROR = 'METADATA_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',
}

/**
 * Base error class for all taglib-wasm errors
 */
export class TagLibError extends Error {
  constructor(
    message: string,
    public readonly code: TagLibErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TagLibError';
    Object.setPrototypeOf(this, TagLibError.prototype);
  }
}

/**
 * Error thrown when the Wasm module fails to initialize
 */
export class TagLibInitializationError extends TagLibError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      createErrorMessage('Failed to initialize TagLib Wasm module', message),
      TagLibErrorCode.INITIALIZATION_FAILED,
      context
    );
    this.name = 'TagLibInitializationError';
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
    context?: Record<string, unknown>
  ) {
    const details = [`Invalid audio file format: ${message}`];
    
    if (bufferSize !== undefined) {
      details.push(`Buffer size: ${formatFileSize(bufferSize)}`);
      if (bufferSize < 1024) {
        details.push('Audio files must be at least 1KB to contain valid headers.');
      }
    }
    
    super(
      details.join('. '),
      TagLibErrorCode.INVALID_FORMAT,
      { ...context, bufferSize }
    );
    this.name = 'InvalidFormatError';
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
    context?: Record<string, unknown>
  ) {
    super(
      `Unsupported audio format: ${format}. Supported formats: ${supportedFormats.join(', ')}`,
      TagLibErrorCode.UNSUPPORTED_FORMAT,
      { ...context, format, supportedFormats }
    );
    this.name = 'UnsupportedFormatError';
    Object.setPrototypeOf(this, UnsupportedFormatError.prototype);
  }
}

/**
 * Error thrown during file operations (read, write, save)
 */
export class FileOperationError extends TagLibError {
  constructor(
    public readonly operation: 'read' | 'write' | 'save',
    message: string,
    public readonly path?: string,
    context?: Record<string, unknown>
  ) {
    const details = [`Failed to ${operation} file`];
    if (path) {
      details.push(`Path: ${path}`);
    }
    details.push(message);
    
    super(
      details.join('. '),
      TagLibErrorCode.FILE_OPERATION_FAILED,
      { ...context, operation, path }
    );
    this.name = 'FileOperationError';
    Object.setPrototypeOf(this, FileOperationError.prototype);
  }
}

/**
 * Error thrown when metadata operations fail
 */
export class MetadataError extends TagLibError {
  constructor(
    public readonly operation: 'read' | 'write',
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    const details = [`Failed to ${operation} metadata`];
    if (field) {
      details.push(`Field: ${field}`);
    }
    details.push(message);
    
    super(
      details.join('. '),
      TagLibErrorCode.METADATA_ERROR,
      { ...context, operation, field }
    );
    this.name = 'MetadataError';
    Object.setPrototypeOf(this, MetadataError.prototype);
  }
}

/**
 * Error thrown when Wasm memory operations fail
 */
export class MemoryError extends TagLibError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      createErrorMessage('Memory allocation failed', message),
      TagLibErrorCode.MEMORY_ERROR,
      context
    );
    this.name = 'MemoryError';
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

/**
 * Error thrown when the environment doesn't support required features
 */
export class EnvironmentError extends TagLibError {
  constructor(
    public readonly environment: string,
    message: string,
    public readonly requiredFeature?: string,
    context?: Record<string, unknown>
  ) {
    const details = [`Environment '${environment}' ${message}`];
    if (requiredFeature) {
      details.push(`Required feature: ${requiredFeature}`);
    }
    
    super(
      details.join('. '),
      TagLibErrorCode.ENVIRONMENT_ERROR,
      { ...context, environment, requiredFeature }
    );
    this.name = 'EnvironmentError';
    Object.setPrototypeOf(this, EnvironmentError.prototype);
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

export function isInvalidFormatError(error: unknown): error is InvalidFormatError {
  return error instanceof InvalidFormatError;
}

export function isUnsupportedFormatError(error: unknown): error is UnsupportedFormatError {
  return error instanceof UnsupportedFormatError;
}

export function isFileOperationError(error: unknown): error is FileOperationError {
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