import { TagLibError } from "./base.ts";
import {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  MemoryError,
  MetadataError,
  UnsupportedFormatError,
} from "./classes.ts";

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
