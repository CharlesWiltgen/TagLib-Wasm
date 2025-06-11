/**
 * @fileoverview Main module exports for TagLib WASM
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */

export { AudioFile, TagLib } from "./src/taglib.ts";
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  METADATA_MAPPINGS,
  Picture,
  PictureType,
  PropertyMap,
  Tag,
  TagLibConfig,
} from "./src/types.ts";
export type { TagLibModule } from "./src/wasm.ts";
