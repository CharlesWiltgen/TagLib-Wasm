/**
 * @fileoverview Browser entry point for TagLib-Wasm
 *
 * Emscripten-only build with no WASI, Node.js, or Deno dependencies.
 * Excludes server-only exports: folder-api, file-utils, deno-compile.
 *
 * @module TagLib-Wasm/browser
 */

// Full API
export type {
  AudioFile,
  TypedAudioFile,
} from "./src/taglib/audio-file-interface.ts";
export { AudioFileImpl, createTagLib, TagLib } from "./src/taglib.ts";
export type { MutableTag } from "./src/taglib.ts";

// Error types
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
} from "./src/errors.ts";
export type { TagLibErrorCode } from "./src/errors.ts";

// Simple API
export {
  addPicture,
  applyCoverArt,
  applyPictures,
  applyTags,
  applyTagsToFile,
  type BatchItem,
  type BatchOptions,
  type BatchResult,
  clearPictures,
  clearTags,
  type FileMetadata,
  findPictureByType,
  isValidAudioFile,
  readCoverArt,
  readFormat,
  readMetadata,
  readMetadataBatch,
  readPictureMetadata,
  readPictures,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  replacePictureByType,
  setBufferMode,
} from "./src/simple/index.ts";

// Property constants and utilities
export {
  FormatMappings,
  getAllProperties,
  getAllPropertyKeys,
  getAllTagNames,
  getPropertiesByFormat,
  getPropertyMetadata,
  isValidProperty,
  isValidTagName,
  PROPERTIES,
  Tags,
} from "./src/constants.ts";
export type { PropertyMetadata } from "./src/constants/property-types.ts";

// Web browser utilities
export {
  canvasToPicture,
  createPictureDownloadURL,
  createPictureGallery,
  dataURLToPicture,
  displayPicture,
  imageFileToPicture,
  pictureToDataURL,
  setCoverArtFromCanvas,
} from "./src/web-utils/index.ts";

// Core types
export type {
  AudioCodec,
  AudioFileInput,
  AudioProperties,
  BitrateControlMode,
  ContainerFormat,
  ExtendedTag,
  FieldMapping,
  FileType,
  OpenOptions,
  Picture,
  PictureType,
  PropertyMap,
  Tag,
  TagInput,
  TagName,
} from "./src/types.ts";
export {
  BITRATE_CONTROL_MODE_NAMES,
  BITRATE_CONTROL_MODE_VALUES,
  PICTURE_TYPE_NAMES,
  PICTURE_TYPE_VALUES,
} from "./src/types.ts";

export type { PropertyKey, PropertyValue } from "./src/constants.ts";
export type {
  FormatPropertyKey,
  TagFormat,
} from "./src/types/format-property-keys.ts";

// Complex property types and constants
export {
  COMPLEX_PROPERTIES,
  COMPLEX_PROPERTY_KEY,
} from "./src/constants/complex-properties.ts";
export type {
  ComplexPropertyKey,
  ComplexPropertyKeyMap,
  ComplexPropertyValueMap,
  Rating,
  UnsyncedLyrics,
  VariantMap,
} from "./src/constants/complex-properties.ts";

// Rating conversion utilities
export { RatingUtils } from "./src/utils/rating.ts";
export type { NormalizedRating, PopmRating } from "./src/utils/rating.ts";

// Wasm module types and loader
export type { TagLibModule, WasmModule } from "./src/wasm.ts";
export type { LoadTagLibOptions } from "./src/runtime/loader-types.ts";
export { loadTagLibModule } from "./src/runtime/module-loader-browser.ts";
