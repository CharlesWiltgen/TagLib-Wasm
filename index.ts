/**
 * @fileoverview Main module exports for taglib-wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */

export { AudioFileImpl as AudioFile, TagLib, createTagLib } from "./src/taglib.ts";
export { readTags, writeTags, readProperties } from "./src/simple.ts";
export { Tags, FormatMappings, isValidTagName, getAllTagNames } from "./src/constants.ts";
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
export type { TagLibModule, WasmModule } from "./src/wasm.ts";

// Import the type for use in this file
import type { TagLibModule } from "./src/wasm.ts";

/**
 * Load the TagLib WASM module
 */
export async function loadTagLibModule(): Promise<TagLibModule> {
  // Now that we're using ES6 modules, we can use dynamic import directly
  const { default: createTagLibModule } = await import("./build/taglib.js");
  const module = await createTagLibModule();
  return module as TagLibModule;
}
