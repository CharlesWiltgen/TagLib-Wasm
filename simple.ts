/**
 * Simple API for reading and writing audio metadata with minimal code.
 *
 * @module simple
 *
 * @example
 * ```typescript
 * import { readTags, applyTagsToBuffer } from "@charlesw/taglib-wasm/simple";
 *
 * // Read tags from a file
 * const tags = await readTags(audioBuffer);
 * console.log(tags.title, tags.artist);
 *
 * // Apply tags and get modified buffer
 * const modified = await applyTagsToBuffer(audioBuffer, {
 *   title: "New Title",
 *   artist: "New Artist"
 * });
 * ```
 */

export * from "./src/simple/index.ts";
