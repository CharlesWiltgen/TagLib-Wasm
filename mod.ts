/**
 * @fileoverview Main module exports for TagLib WASM
 * 
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */

export { TagLib, AudioFile } from "./src/taglib.ts";
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  Picture,
  PictureType,
  PropertyMap,
  Tag,
  TagLibConfig,
  METADATA_MAPPINGS,
} from "./src/types.ts";
export type { TagLibModule } from "./src/wasm.ts";