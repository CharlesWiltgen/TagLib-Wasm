/**
 * @fileoverview Main module exports for taglib-wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling across all JavaScript runtimes.
 *
 * @module taglib-wasm
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
 * import { readTags, applyTags } from "taglib-wasm/simple";
 *
 * const tags = await readTags("song.mp3");
 * console.log(tags.artist);
 *
 * const modified = await applyTags("song.mp3", {
 *   artist: "New Artist",
 *   album: "New Album"
 * });
 * ```
 */

/**
 * Full API exports for advanced usage with full control.
 * @see {@link TagLib} - Main TagLib class
 * @see {@link AudioFile} - Audio file interface
 * @see {@link createTagLib} - Factory function for creating TagLib instances
 */
export {
  AudioFileImpl as AudioFile,
  createTagLib,
  TagLib,
} from "./src/taglib.ts";

/**
 * Error types for proper error handling and debugging.
 * @see {@link TagLibError} - Base error class for all TagLib errors
 * @see {@link TagLibInitializationError} - Wasm initialization failures
 * @see {@link InvalidFormatError} - Invalid or corrupted file format
 * @see {@link UnsupportedFormatError} - Valid but unsupported format
 * @see {@link FileOperationError} - File read/write/save failures
 * @see {@link MetadataError} - Tag reading/writing failures
 * @see {@link MemoryError} - Wasm memory allocation issues
 * @see {@link EnvironmentError} - Runtime/environment issues
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
} from "./src/errors.ts";

/**
 * Simple API exports for easy tag reading and writing.
 * @see {@link readTags} - Read metadata from audio files
 * @see {@link applyTags} - Apply metadata changes and return modified buffer
 * @see {@link updateTags} - Update metadata and save to disk
 * @see {@link writeTags} - Deprecated alias for applyTags
 * @see {@link readProperties} - Read audio properties
 * @see {@link readPictures} - Read cover art/pictures
 * @see {@link applyPictures} - Apply pictures to audio files
 * @see {@link getCoverArt} - Get primary cover art data
 * @see {@link setCoverArt} - Set primary cover art
 * @see {@link readTagsBatch} - Read tags from multiple files efficiently
 * @see {@link readPropertiesBatch} - Read properties from multiple files efficiently
 * @see {@link readMetadataBatch} - Read complete metadata from multiple files efficiently
 * @see {@link setWorkerPoolMode} - Enable/disable worker pool for Simple API
 */
export {
  addPicture,
  applyPictures,
  applyTags,
  type BatchOptions,
  type BatchResult,
  clearPictures,
  clearTags,
  findPictureByType,
  getCoverArt,
  getFormat,
  getPictureMetadata,
  isValidAudioFile,
  readMetadataBatch,
  readPictures,
  readProperties,
  readPropertiesBatch,
  readTags,
  readTagsBatch,
  replacePictureByType,
  setCoverArt,
  setWorkerPoolMode,
  updateTags,
} from "./src/simple.ts";

/**
 * Enhanced property constants and utilities with rich metadata.
 * @see {@link PROPERTIES} - Comprehensive property definitions with metadata
 * @see {@link PropertyKey} - Type-safe property keys
 * @see {@link PropertyValue} - Type-safe property values
 * @see {@link isValidProperty} - Validate property keys
 * @see {@link getPropertyMetadata} - Get property metadata
 * @see {@link getAllPropertyKeys} - Get all valid property keys
 * @see {@link getPropertiesByFormat} - Filter properties by format support
 * @see {@link Tags} - Legacy tag name constants (deprecated)
 * @see {@link FormatMappings} - Format-specific field mappings (deprecated)
 */
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
/**
 * File I/O utilities for cover art operations.
 * @see {@link exportCoverArt} - Export cover art to file
 * @see {@link importCoverArt} - Import cover art from file
 * @see {@link copyCoverArt} - Copy cover art between files
 */
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
} from "./src/file-utils.ts";

/**
 * Folder/batch operations for processing multiple audio files.
 * @see {@link scanFolder} - Scan folder for audio files and read metadata
 * @see {@link updateFolderTags} - Update tags for multiple files
 * @see {@link findDuplicates} - Find duplicate files based on metadata
 * @see {@link exportFolderMetadata} - Export folder metadata to JSON
 */
export {
  type AudioFileMetadata,
  exportFolderMetadata,
  findDuplicates,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
  updateFolderTags,
} from "./src/folder-api.ts";

/**
 * Web browser utilities for cover art operations.
 * @see {@link pictureToDataURL} - Convert picture to data URL
 * @see {@link setCoverArtFromCanvas} - Set cover art from HTML canvas
 * @see {@link displayPicture} - Display picture in HTML img element
 */
export {
  canvasToPicture,
  createPictureDownloadURL,
  createPictureGallery,
  dataURLToPicture,
  displayPicture,
  imageFileToPicture,
  pictureToDataURL,
  setCoverArtFromCanvas,
} from "./src/web-utils.ts";

/**
 * Type exports for TypeScript users.
 * These types define the structure of metadata, audio properties,
 * and configuration options used throughout the library.
 *
 * @see {@link Tag} - Basic metadata structure
 * @see {@link ExtendedTag} - Extended metadata with advanced fields
 * @see {@link AudioProperties} - Audio technical properties
 * @see {@link PropertyKey} - Type-safe property keys with autocomplete
 * @see {@link PropertyValue} - Type-safe property values
 */
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  FileType,
  Picture,
  PropertyMap,
  Tag,
  TagName,
} from "./src/types.ts";

export type { PropertyKey, PropertyValue } from "./src/constants.ts";

/**
 * Type and constant exports
 */
export type { PictureType } from "./src/types.ts";
export { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "./src/types.ts";

/**
 * Complex property types and constants for structured metadata.
 * @see {@link COMPLEX_PROPERTIES} - Rich metadata object with format mappings
 * @see {@link COMPLEX_PROPERTY_KEY} - Simple key map for daily use
 * @see {@link Rating} - Track rating metadata (normalized 0.0-1.0)
 * @see {@link UnsyncedLyrics} - Unsynchronized lyrics text
 * @see {@link ComplexPropertyValueMap} - Type map for generic methods
 */
export {
  COMPLEX_PROPERTIES,
  COMPLEX_PROPERTY_KEY,
} from "./src/constants/complex-properties.ts";
export type {
  ComplexPropertyKey,
  ComplexPropertyValueMap,
  Rating,
  UnsyncedLyrics,
  VariantMap,
} from "./src/constants/complex-properties.ts";

/**
 * Rating conversion utilities for cross-format compatibility.
 * @see {@link RatingUtils} - Namespace with all rating utilities
 * @see {@link toNormalized} - POPM (0-255) to normalized (0.0-1.0)
 * @see {@link fromNormalized} - Normalized to POPM
 * @see {@link toStars} - Normalized to star rating
 * @see {@link fromStars} - Star rating to normalized
 * @see {@link toPopm} - Normalized to standard POPM value
 * @see {@link fromPopm} - Standard POPM to normalized
 */
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

/**
 * Worker pool exports for parallel processing.
 * @see {@link TagLibWorkerPool} - Worker pool for parallel file processing
 * @see {@link createWorkerPool} - Create and initialize a worker pool
 * @see {@link getGlobalWorkerPool} - Get/create global worker pool instance (deprecated)
 * @see {@link terminateGlobalWorkerPool} - Terminate global worker pool
 */
export {
  createWorkerPool,
  getGlobalWorkerPool,
  TagLibWorkerPool,
  terminateGlobalWorkerPool,
} from "./src/worker-pool.ts";
export type {
  BatchOperation,
  WorkerPoolOptions,
  WorkerTask,
} from "./src/worker-pool.ts";

/**
 * Wasm module types for advanced usage.
 * @see {@link TagLibModule} - Full TagLib Wasm module interface
 * @see {@link WasmModule} - Base Emscripten module interface
 */
export type { TagLibModule, WasmModule } from "./src/wasm.ts";

// Import the types for use in this file
import type { TagLibModule } from "./src/wasm.ts";

/**
 * Configuration options for loading the TagLib WASM module
 */
// Re-export LoadTagLibOptions from the new location
export type { LoadTagLibOptions } from "./src/runtime/loader-types.ts";
import type { LoadTagLibOptions } from "./src/runtime/loader-types.ts";

/**
 * Load the TagLib Wasm module.
 * This function initializes the WebAssembly module and returns
 * the loaded module for use with the Full API.
 *
 * Automatically selects the optimal implementation:
 * - WASI for Deno/Node.js (faster filesystem access, MessagePack serialization)
 * - Emscripten for browsers (universal compatibility)
 *
 * @param options - Optional configuration for module initialization
 * @returns Promise resolving to the initialized TagLib module
 *
 * @example
 * ```typescript
 * import { loadTagLibModule, createTagLib } from "taglib-wasm";
 *
 * // Auto-select optimal implementation
 * const module = await loadTagLibModule();
 * const taglib = await createTagLib(module);
 *
 * // Force Emscripten mode
 * const module = await loadTagLibModule({ legacyMode: true });
 *
 * // Force WASI mode (Deno/Node.js only)
 * const module = await loadTagLibModule({ forceWasmType: "wasi" });
 *
 * // With custom WASM binary
 * const wasmData = await fetch("taglib.wasm").then(r => r.arrayBuffer());
 * const module = await loadTagLibModule({ wasmBinary: wasmData });
 * ```
 *
 * @note Most users should use `TagLib.initialize()` instead,
 * which handles module loading automatically.
 */
export async function loadTagLibModule(
  options?: LoadTagLibOptions,
): Promise<TagLibModule> {
  // Use legacy Emscripten-only mode if requested
  if (options?.legacyMode) {
    return loadLegacyTagLibModule(options);
  }

  // Use unified loader for optimal performance
  try {
    const { loadUnifiedTagLibModule } = await import(
      "./src/runtime/unified-loader.ts"
    );
    return await loadUnifiedTagLibModule({
      wasmBinary: options?.wasmBinary,
      wasmUrl: options?.wasmUrl,
      // These options exist in the v2 loader
      debug: false,
      useInlineWasm: false,
    });
  } catch (error) {
    console.warn(
      `[TagLib] Unified loader failed, falling back to legacy mode: ${error}`,
    );
    // Fall back to legacy mode if unified loader fails
    return loadLegacyTagLibModule(options || {});
  }
}

/**
 * Legacy Emscripten-only module loader.
 * Used for fallback compatibility and when legacyMode is explicitly requested.
 *
 * @internal
 */
async function loadLegacyTagLibModule(
  options: LoadTagLibOptions,
): Promise<TagLibModule> {
  // Try different paths for the wrapper module
  let createTagLibModule;
  try {
    // First try the build directory (development)
    // @ts-ignore: Dynamic import handled at runtime
    const module = await import("./build/taglib-wrapper.js");
    createTagLibModule = module.default;
  } catch {
    try {
      // Then try the dist directory (CI/production)
      // @ts-ignore: Dynamic import handled at runtime
      const module = await import("./dist/taglib-wrapper.js");
      createTagLibModule = module.default;
    } catch {
      throw new Error(
        "Could not load taglib-wrapper.js from either ./build or ./dist",
      );
    }
  }

  const moduleConfig: any = {};

  if (options?.wasmBinary) {
    // Use provided binary data directly
    moduleConfig.wasmBinary = options.wasmBinary;
  }

  if (options?.wasmUrl) {
    // Use custom URL for WASM file
    moduleConfig.locateFile = (path: string) => {
      if (path.endsWith(".wasm")) {
        return options.wasmUrl!;
      }
      return path;
    };
  }

  const module = await createTagLibModule(moduleConfig);
  return module as TagLibModule;
}
