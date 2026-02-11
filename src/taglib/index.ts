/**
 * @fileoverview Main export barrel for taglib module
 */

export type { MutableTag } from "./mutable-tag.ts";
export type { AudioFile } from "./audio-file-interface.ts";
export { AudioFileImpl } from "./audio-file-impl.ts";
export { createTagLib, TagLib } from "./taglib-class.ts";

/**
 * Re-export error types for convenient error handling
 */
export {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
  MemoryError,
  MetadataError,
  SUPPORTED_FORMATS,
  TagLibError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "../errors.ts";
export type { TagLibErrorCode } from "../errors.ts";
