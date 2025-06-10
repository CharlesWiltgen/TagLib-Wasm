/**
 * @fileoverview JSR-compatible module exports for TagLib WASM
 * 
 * This version uses JSR-compatible WASM loading that doesn't depend on
 * Emscripten's generated JavaScript file.
 */

export { TagLibJSR as TagLib, AudioFileJSR as AudioFile } from "./src/taglib-jsr.ts";
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
export type { TagLibModule } from "./src/wasm-jsr.ts";