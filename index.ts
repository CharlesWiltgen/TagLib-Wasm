/**
 * @fileoverview Main module exports for TagLib-Wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling across all JavaScript runtimes.
 *
 * @module TagLib-Wasm
 *
 * @example
 * ```typescript
 * // Using the Full API
 * import { TagLib } from "taglib-wasm";
 *
 * const taglib = await TagLib.initialize();
 * const file = await taglib.open(audioBuffer);
 * const tag = file.tag();
 * console.log(tag.title);
 * file.dispose();
 * ```
 *
 * @example
 * ```typescript
 * // Using the Simple API
 * import { readTags, applyTagsToBuffer } from "taglib-wasm/simple";
 *
 * const tags = await readTags("song.mp3");
 * console.log(tags.artist);
 *
 * const modified = await applyTagsToBuffer("song.mp3", {
 *   artist: "New Artist",
 *   album: "New Album"
 * });
 * ```
 */

// Full API
export { AudioFileImpl as AudioFile, TagLib } from "./src/taglib.ts";
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

// Deno compile support
export {
  initializeForDenoCompile,
  isDenoCompiled,
  prepareWasmForEmbedding,
} from "./src/deno-compile.ts";

// Simple API
export {
  addPicture,
  applyCoverArt,
  applyPictures,
  applyTagsToBuffer,
  type BatchOptions,
  type BatchResult,
  clearPictures,
  clearTags,
  findPictureByType,
  isValidAudioFile,
  readCoverArt,
  readFormat,
  readMetadataBatch,
  readPictureMetadata,
  readPictures,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  replacePictureByType,
  setBufferMode,
  writeTagsToFile,
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

// File I/O utilities for cover art
export {
  copyCoverArt,
  exportAllPictures,
  exportCoverArt,
  exportPictureByType,
  findCoverArtFiles,
  importCoverArt,
  importPictureWithType,
  loadPictureFromFile,
  savePictureToFile,
} from "./src/file-utils/index.ts";

// Folder/batch operations
export {
  type AudioDynamics,
  type AudioFileMetadata,
  exportFolderMetadata,
  findDuplicates,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
  updateFolderTags,
} from "./src/folder-api/index.ts";

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
  AudioFileInput,
  AudioFormat,
  AudioProperties,
  BitrateControlMode,
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
export {
  clamp as clampRating,
  fromNormalized,
  fromPercent,
  fromPopm,
  fromStars,
  isValid as isValidRating,
  RatingUtils,
  toNormalized,
  toPercent,
  toPopm,
  toStars,
} from "./src/utils/rating.ts";

// Wasm module types and loader
export type { TagLibModule, WasmModule } from "./src/wasm.ts";
export type { LoadTagLibOptions } from "./src/runtime/loader-types.ts";
export { loadTagLibModule } from "./src/runtime/module-loader.ts";
