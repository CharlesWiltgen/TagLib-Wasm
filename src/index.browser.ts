/**
 * @fileoverview Browser entry point for TagLib-Wasm
 *
 * Emscripten-only build with no WASI, Node.js, or Deno dependencies.
 *
 * The surface is the Node barrel's minus what cannot run in a browser, and the
 * `browser` `exports` condition resolves both the runtime and (via
 * `dist/index.browser.d.ts`) the types to this file, so importing an omitted
 * name is a compile error naming it rather than a bundler error. Two kinds of
 * omission, each marked where it applies below:
 *
 *  - the filesystem-bound halves of `file-utils` and `folder-api` — a function
 *    that writes to a path or walks a directory has no browser implementation;
 *  - nothing else. Types are not omitted: a type describes data, and data
 *    crosses networks, so the type surface here matches `index.ts` exactly.
 *
 * `tests/browser-entry-surface.test.ts` is the enforcement.
 *
 * @module TagLib-Wasm/browser
 */

// Full API
export type {
  AudioFile,
  TypedAudioFile,
} from "./taglib/audio-file-interface.ts";
export { AudioFileImpl, createTagLib, TagLib } from "./taglib.ts";
export type { MutableTag } from "./taglib.ts";
export { isNamedAudioInput } from "./types/audio-formats.ts";

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
} from "./errors.ts";
export type { TagLibErrorCode } from "./errors.ts";

// Deno compile support. The embedding helpers (initializeForDenoCompile,
// prepareWasmForEmbedding) resolve Deno.mainModule and file URLs to embed a Wasm
// binary in a compiled binary — no browser analogue. `isDenoCompiled` is the
// probe under them: it reads `typeof Deno` and nothing else, so in a browser it
// answers `false` without touching Deno, and modules that branch on it must be
// able to import it here.
export { isDenoCompiled } from "./runtime/deno-detect.ts";

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
  readMediaChecksum,
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
} from "./simple/index.ts";
export type {
  ChecksumAlgorithm,
  ChecksumSource,
  MediaChecksum,
  MediaChecksumOptions,
} from "./taglib/audio-file-checksum.ts";

// Property constants and utilities
export {
  FormatMappings,
  getAllProperties,
  getAllPropertyKeys,
  getPropertiesByFormat,
  getPropertyMetadata,
  isValidProperty,
  PROPERTIES,
  propertyValue,
  propertyValues,
} from "./constants.ts";
export type { PropertyMetadata } from "./constants/property-types.ts";

// File I/O utilities for cover art (copyCoverArt, exportAllPictures,
// exportCoverArt, exportPictureByType, findCoverArtFiles, importCoverArt,
// importPictureWithType, loadPictureFromFile, savePictureToFile) are
// Node/Deno-only: every one of them reads or writes a path through the platform
// filesystem layer. The browser equivalents are the byte-level helpers in
// `src/web-utils` (exported below) and `applyPictures`.

// Folder/batch operations: the browser-safe subset is the pure grammar and the
// pure grouping core. The scan itself (scanFolder, scanForAlbums,
// findDuplicates, exportFolderMetadata) walks a directory and stays Node-only.
// `groupAlbums` takes a FolderScanResult — data a browser can receive from a
// server and group client-side, which is why the pure half ships here and not
// only on the `taglib-wasm/disc-folder` subpath (that subpath remains the right
// import when you want these without loading the engine at all).
export { discFolderInfo } from "./folder-api/folder-disc.ts";
export { groupAlbums } from "./folder-api/album-grouping.ts";
export type {
  AlbumDisc,
  AlbumGroup,
  AlbumGroupingResult,
  AlbumGroupItem,
  AlbumGroupKey,
  AudioDynamics,
  AudioFileMetadata,
  DiscConfidence,
  DiscFolderInfo,
  DuplicateGroup,
  FolderScanItem,
  FolderScanOptions,
  FolderScanResult,
  GroupAlbumsOptions,
  ScanForAlbumsOptions,
} from "./folder-api/index.ts";

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
} from "./web-utils/index.ts";

// Core types
export type {
  AudioCodec,
  AudioFileInput,
  AudioProperties,
  BitrateControlMode,
  BroadcastAudioExtension,
  Chapter,
  ContainerFormat,
  ExtendedTag,
  FieldMapping,
  FileType,
  MP4FreeformItem,
  MP4FreeformType,
  NamedAudioInput,
  OpenOptions,
  Picture,
  PictureType,
  PropertyMap,
  SetChaptersOptions,
  Tag,
  TagInput,
} from "./types.ts";
export {
  BITRATE_CONTROL_MODE_NAMES,
  BITRATE_CONTROL_MODE_VALUES,
  PICTURE_TYPE_NAMES,
  PICTURE_TYPE_VALUES,
} from "./types.ts";

export type { PropertyKey, PropertyValue } from "./constants.ts";
export type {
  FormatPropertyKey,
  TagFormat,
} from "./types/format-property-keys.ts";
export type { TypedAudioProperties } from "./types/audio-formats.ts";

// Complex property TYPES (value exports removed in 2.0.0, taglib-ivq)
export type {
  Id3v2Frame,
  Rating,
  UnsyncedLyrics,
  VariantMap,
} from "./constants/complex-properties.ts";

// BWF `bext` chunk codec — for working with raw bext bytes without a file
// handle. Pure: bext.ts imports a type and nothing else at runtime.
export * as bwf from "./bwf/bext.ts";

// Rating conversion utilities
export { RatingUtils } from "./utils/rating.ts";
export type { NormalizedRating, PopmRating } from "./utils/rating.ts";

// Wasm module types and loader
export type { TagLibModule, WasmModule } from "./wasm.ts";
export type { LoadTagLibOptions } from "./runtime/loader-types.ts";
export { loadTagLibModule } from "./runtime/module-loader-browser.ts";
