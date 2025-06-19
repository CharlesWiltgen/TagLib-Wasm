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
 * // Using the Core API
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
 * Core API exports for advanced usage with full control.
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
 */
export {
  addPicture,
  applyPictures,
  applyTags,
  clearPictures,
  clearTags,
  findPictureByType,
  getCoverArt,
  getFormat,
  getPictureMetadata,
  isValidAudioFile,
  readPictures,
  readProperties,
  readTags,
  replacePictureByType,
  setCoverArt,
  updateTags,
} from "./src/simple.ts";

/**
 * Constants and utilities for tag name validation.
 * @see {@link Tags} - Standard tag name constants
 * @see {@link FormatMappings} - Format-specific field mappings
 * @see {@link isValidTagName} - Validate tag names
 * @see {@link getAllTagNames} - Get all valid tag names
 */
export {
  FormatMappings,
  getAllTagNames,
  isValidTagName,
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

/**
 * Enum exports
 */
export { PictureType } from "./src/types.ts";

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
export interface LoadTagLibOptions {
  /**
   * Optional pre-loaded WASM binary data.
   * If provided, this will be used instead of fetching from network.
   */
  wasmBinary?: ArrayBuffer | Uint8Array;

  /**
   * Optional custom URL or path for the WASM file.
   * This is passed to the locateFile function.
   */
  wasmUrl?: string;
}

/**
 * Load the TagLib Wasm module.
 * This function initializes the WebAssembly module and returns
 * the loaded module for use with the Core API.
 *
 * @param config - Optional configuration for module initialization
 * @returns Promise resolving to the initialized TagLib module
 *
 * @example
 * ```typescript
 * import { loadTagLibModule, createTagLib } from "taglib-wasm";
 *
 * // Manual module loading for advanced configuration
 * const module = await loadTagLibModule();
 * const taglib = await createTagLib(module);
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
  // Now that we're using ES6 modules, we can use dynamic import directly
  // Note: For Deno compile, provide wasmBinary option to avoid dynamic loading
  const { default: createTagLibModule } = await import(
    "./build/taglib-wrapper.js"
  );

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
