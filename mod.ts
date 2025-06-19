/**
 * @module taglib-wasm
 *
 * taglib-wasm - WebAssembly port of TagLib v2.1 with TypeScript bindings.
 * Universal audio metadata reading and writing for the web and JavaScript runtimes.
 *
 * @example
 * ```typescript
 * // Simple API - Read tags
 * import { readTags } from "@charlesw/taglib-wasm/simple";
 * const tags = await readTags("song.mp3");
 * console.log(tags.title, tags.artist);
 *
 * // Core API - Full control
 * import { TagLib } from "@charlesw/taglib-wasm";
 * const taglib = await TagLib.initialize();
 * const file = await taglib.open("song.mp3");
 * const tag = file.tag();
 * console.log(tag.title, tag.artist);
 * file.dispose();
 * ```
 */

// Export Core API
export { TagLib } from "./src/taglib.ts";
export type { AudioFile, Tag } from "./src/taglib.ts";
export type { AudioProperties } from "./src/types.ts";

// Export Simple API
export * from "./src/simple.ts";

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
export { AudioFileWorkers, TagLibWorkers } from "./src/workers.ts";

// Export additional types
export { PictureType } from "./src/types.ts";
export type { ExtendedTag, Picture, PropertyMap } from "./src/types.ts";

// Export constants
export { SUPPORTED_FORMATS } from "./src/errors.ts";

// Export Deno compile utilities
export { 
  initializeForDenoCompile, 
  isDenoCompiled,
  prepareWasmForEmbedding 
} from "./src/deno-compile.ts";
