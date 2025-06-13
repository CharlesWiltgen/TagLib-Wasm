/**
 * @fileoverview Main module exports for taglib-wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */

export { AudioFileImpl as AudioFile, TagLib, createTagLib } from "./src/taglib.ts";
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
} from "./src/types.ts";
export type { TagLibModule, WasmModule } from "./src/wasm.ts";

// Re-export the module loader
import createTagLibModule from "./build/taglib.js";
export { createTagLibModule };
