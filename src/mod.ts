/**
 * @fileoverview TagLib WebAssembly TypeScript bindings
 * Universal audio metadata handling for Deno, Node.js, and browsers
 */

// Export from taglib.ts
export { AudioFileImpl, createTagLib, TagLib } from "./taglib.ts";
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

// Export worker pool functionality
export {
  createWorkerPool,
  getGlobalWorkerPool,
  TagLibWorkerPool,
  terminateGlobalWorkerPool,
} from "./worker-pool.ts";
export type {
  BatchOperation,
  WorkerPoolOptions,
  WorkerTask,
} from "./worker-pool.ts";
