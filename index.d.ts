/**
 * @fileoverview Main module exports for taglib-wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */
export {
  AudioFileImpl as AudioFile,
  createTagLib,
  TagLib,
} from "./src/taglib.ts";
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
/**
 * Load the TagLib Wasm module
 */
export declare function loadTagLibModule(): Promise<TagLibModule>;
//# sourceMappingURL=index.d.ts.map
