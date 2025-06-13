/**
 * @fileoverview JSR-compatible module exports for taglib-wasm
 *
 * This version uses JSR-compatible WASM loading that doesn't depend on
 * Emscripten's generated JavaScript file.
 */

export {
  AudioFileJSR as AudioFile,
  TagLibJSR as TagLib,
} from "./src/taglib-jsr.ts";
export type { Tag } from "./src/taglib-jsr.ts";
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  Picture,
  PictureType,
  PropertyMap,
  TagLibConfig,
} from "./src/types.ts";
export { METADATA_MAPPINGS } from "./src/types.ts";
// TagLibModule type export removed for JSR compatibility
