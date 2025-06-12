/**
 * taglib-wasm - WebAssembly port of TagLib with Embind
 *
 * This is the main entry point for NPM/Node.js usage.
 * For Deno usage, see mod.ts
 */

import createTagLibModule from "./build/taglib.js";
import { createTagLib } from "./src/taglib-embind.ts";

// Export types
export type {
  AudioFile,
  AudioProperties,
  FileType,
  PropertyMap,
  Tag,
} from "./src/types.ts";

// Export the main TagLib class
export { TagLib } from "./src/taglib-embind.ts";

// Export enhanced API
export {
  EnhancedAudioFile,
  TagLibEnhanced,
  createTagLibEnhanced,
} from "./src/enhanced-api.ts";

// Export types for enhanced API
export type {
  AcoustIDInfo,
  MusicBrainzInfo,
  ReplayGainInfo,
} from "./src/enhanced-api.ts";

/**
 * Create a TagLib instance (Embind version)
 *
 * @example
 * ```typescript
 * import { createTagLib } from "taglib-wasm";
 *
 * const taglib = await createTagLib();
 * const file = await taglib.openFile(audioBuffer);
 * console.log(file.tag().title());
 * ```
 */
export async function createTagLib() {
  const module = await createTagLibModule();
  return createTagLib(module);
}

/**
 * Create an enhanced TagLib instance with additional features
 *
 * @example
 * ```typescript
 * import { createTagLibEnhanced } from "taglib-wasm";
 *
 * const taglib = await createTagLibEnhanced();
 * const file = await taglib.openFile(audioBuffer);
 *
 * // Access enhanced features
 * const replayGain = file.getReplayGain();
 * const acoustId = file.getAcoustID();
 * ```
 */
export async function createTagLibEnhanced() {
  const taglib = await createTagLib();
  const { createTagLibEnhanced: create } = await import("./src/enhanced-api.ts");
  return create(taglib);
}

// Cloudflare Workers compatibility
export { configureWorkers } from "./src/workers.ts";