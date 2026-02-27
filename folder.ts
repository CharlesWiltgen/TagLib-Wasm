/**
 * Folder scanning and batch operations for audio file collections.
 *
 * @module folder
 *
 * @example
 * ```typescript
 * import { scanFolder, findDuplicates } from "@charlesw/taglib-wasm/folder";
 *
 * const result = await scanFolder("/path/to/music");
 * for (const item of result.items) {
 *   if (item.status === "ok") {
 *     console.log(`${item.path}: ${item.tags.artist} - ${item.tags.title}`);
 *   }
 * }
 * ```
 */

export * from "./src/folder-api/index.ts";
