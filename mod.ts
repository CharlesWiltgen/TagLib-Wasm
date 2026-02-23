/**
 * @module TagLib-Wasm
 *
 * TagLib-Wasm - WebAssembly port of TagLib v2.1 with TypeScript bindings.
 * Universal audio metadata reading and writing for the web and JavaScript runtimes.
 *
 * @example
 * ```typescript
 * // Simple API - Read tags
 * import { readTags } from "@charlesw/taglib-wasm/simple";
 * const tags = await readTags("song.mp3");
 * console.log(tags.title, tags.artist);
 *
 * // Full API - Full control
 * import { TagLib } from "@charlesw/taglib-wasm";
 * const taglib = await TagLib.initialize();
 * const file = await taglib.open("song.mp3");
 * const tag = file.tag();
 * console.log(tag.title, tag.artist);
 * file.dispose();
 * ```
 */

// Export Full API
export { TagLib } from "./src/taglib.ts";
export type { AudioFile, MutableTag } from "./src/taglib.ts";
export type { AudioProperties } from "./src/types.ts";

// Export Simple API
export * from "./src/simple/index.ts";

// Export error types
export {
  EnvironmentError,
  FileOperationError,
  InvalidFormatError,
  MemoryError,
  MetadataError,
  TagLibError,
  TagLibInitializationError,
  UnsupportedFormatError,
} from "./src/errors.ts";

// Export type utilities
export {
  isEnvironmentError,
  isFileOperationError,
  isInvalidFormatError,
  isMemoryError,
  isMetadataError,
  isTagLibError,
  isUnsupportedFormatError,
} from "./src/errors.ts";

// Export Workers API for Cloudflare Workers
export { AudioFileWorkers, TagLibWorkers } from "./src/workers/index.ts";

// Export additional types
export type { PictureType } from "./src/types.ts";
export type { ExtendedTag, Picture, PropertyMap } from "./src/types.ts";

// Export constants
export { SUPPORTED_FORMATS } from "./src/errors.ts";

// Export Deno compile utilities
export {
  initializeForDenoCompile,
  isDenoCompiled,
  prepareWasmForEmbedding,
} from "./src/deno-compile.ts";

// Export Folder API
export {
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "./src/folder-api/index.ts";
export type {
  AudioFileMetadata,
  FolderScanOptions,
  FolderScanResult,
} from "./src/folder-api/index.ts";
