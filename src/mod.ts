/**
 * @deprecated Use the root index.ts or src/taglib/index.ts instead.
 */

// Export from taglib.ts
export { AudioFileImpl, TagLib } from "./taglib.ts";
export type { AudioFile, MutableTag } from "./taglib.ts"; // Export the interfaces

// Export from types.ts (except Tag to avoid conflict)
export type {
  AudioProperties,
  FileType,
  PropertyMap,
  Tag as BasicTag, // Rename the basic Tag interface to avoid conflict
} from "./types.ts";

// Export from wasm.ts
export type { TagLibModule } from "./wasm.ts";
