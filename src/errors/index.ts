export { SUPPORTED_FORMATS, TagLibError } from "./base.ts";
export type { TagLibErrorCode } from "./base.ts";
export {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  MemoryError,
  MetadataError,
  SidecarError,
  TagLibInitializationError,
  UnsupportedFormatError,
  WorkerError,
} from "./classes.ts";
export {
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isSidecarError,
  isTagLibError,
  isUnsupportedFormatError,
  isWorkerError,
} from "./guards.ts";
