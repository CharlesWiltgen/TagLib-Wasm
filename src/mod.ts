/**
 * @fileoverview TagLib WebAssembly TypeScript bindings
 * Universal audio metadata handling for Deno, Node.js, and browsers
 */

// Export from taglib.ts
export { AudioFileImpl, createTagLib, TagLib } from "./taglib";
export type { AudioFile, Tag } from "./taglib"; // Export the interfaces

// Export from types.ts (except Tag to avoid conflict)
export type {
  AudioProperties,
  FileType,
  PropertyMap,
  Tag as BasicTag, // Rename the basic Tag interface to avoid conflict
} from "./types";

// Export from wasm.ts
export type { TagLibModule } from "./wasm";
