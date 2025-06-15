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
 * const file = await taglib.openFile(audioBuffer);
 * const tag = file.tag();
 * console.log(tag.title);
 * file.dispose();
 * ```
 *
 * @example
 * ```typescript
 * // Using the Simple API
 * import { readTags, writeTags } from "taglib-wasm";
 *
 * const tags = await readTags("song.mp3");
 * console.log(tags.artist);
 *
 * const modified = await writeTags("song.mp3", {
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
 * @see {@link writeTags} - Write metadata to audio files
 * @see {@link readProperties} - Read audio properties
 */
export { readProperties, readTags, writeTags } from "./src/simple.ts";

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
 * Type exports for TypeScript users.
 * These types define the structure of metadata, audio properties,
 * and configuration options used throughout the library.
 *
 * @see {@link Tag} - Basic metadata structure
 * @see {@link ExtendedTag} - Extended metadata with advanced fields
 * @see {@link AudioProperties} - Audio technical properties
 * @see {@link TagLibConfig} - Configuration options
 */
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  FileType,
  Picture,
  PictureType,
  PropertyMap,
  Tag,
  TagLibConfig,
  TagName,
} from "./src/types.ts";

/**
 * Wasm module types for advanced usage.
 * @see {@link TagLibModule} - Full TagLib Wasm module interface
 * @see {@link WasmModule} - Base Emscripten module interface
 */
export type { TagLibModule, WasmModule } from "./src/wasm.ts";

// Import the type for use in this file
import type { TagLibModule } from "./src/wasm.ts";

/**
 * Load the TagLib Wasm module.
 * This function initializes the WebAssembly module and returns
 * the loaded module for use with the Core API.
 *
 * @returns Promise resolving to the initialized TagLib module
 *
 * @example
 * ```typescript
 * import { loadTagLibModule, createTagLib } from "taglib-wasm";
 *
 * // Manual module loading for advanced configuration
 * const module = await loadTagLibModule();
 * const taglib = await createTagLib(module);
 * ```
 *
 * @note Most users should use `TagLib.initialize()` instead,
 * which handles module loading automatically.
 */
export async function loadTagLibModule(): Promise<TagLibModule> {
  // Now that we're using ES6 modules, we can use dynamic import directly
  const { default: createTagLibModule } = await import("./build/taglib.js");
  const module = await createTagLibModule();
  return module as TagLibModule;
}
