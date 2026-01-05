/**
 * Simple API for reading and writing audio metadata with minimal code.
 *
 * @module simple
 *
 * @example
 * ```typescript
 * import { readTags, writeTags } from "@charlesw/taglib-wasm/simple";
 *
 * // Read tags from a file
 * const tags = await readTags(audioBuffer);
 * console.log(tags.title, tags.artist);
 *
 * // Write tags to a file
 * const modified = await writeTags(audioBuffer, {
 *   title: "New Title",
 *   artist: "New Artist"
 * });
 * ```
 */

export * from "./src/simple.ts";
