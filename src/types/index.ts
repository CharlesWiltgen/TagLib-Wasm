/**
 * @fileoverview Main export barrel for types module
 */

// Re-export TagLibModule from wasm.ts
export type { TagLibModule } from "../wasm.ts";

// Audio format types and properties
export * from "./audio-formats.ts";

// Tag interfaces and PropertyMap
export * from "./tags.ts";

// Format-specific metadata mappings
export * from "./metadata-mappings.ts";

// Picture types and bitrate control modes
export * from "./pictures.ts";

// Configuration types
export * from "./config.ts";
