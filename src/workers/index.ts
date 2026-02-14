/**
 * @fileoverview Barrel exports for Cloudflare Workers TagLib API
 */

export { AudioFileWorkers } from "./audio-file-workers.ts";
export { processAudioMetadata, TagLibWorkers } from "./taglib-workers.ts";

/**
 * Re-export commonly used types for convenience.
 * These types define the structure of metadata, audio properties,
 * and configuration options.
 */
export type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  Tag,
  TagLibWorkersConfig,
} from "../types.ts";
