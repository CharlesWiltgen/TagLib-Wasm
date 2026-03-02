export { SUPPORTED_FORMATS, TagLibError } from "./base.ts";
export type { TagLibErrorCode } from "./base.ts";
export {
  EnvironmentError,
  errorMessage,
  FileOperationError,
  InvalidFormatError,
  MemoryError,
  MetadataError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "./classes.ts";
export {
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
} from "./guards.ts";
