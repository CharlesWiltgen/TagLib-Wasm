/**
 * Pure disc-folder grammar and album grouping — no Wasm, no runtime deps.
 *
 * @module disc-folder
 *
 * Import from this subpath when all you need is `discFolderInfo` (or the pure
 * `groupAlbums` core): unlike the main entry or `./folder`, this module's
 * graph contains no Wasm loader, so it works in browsers and UI contexts
 * without ever loading TagLib. CI guards the property (taglib-cd7b) — if a
 * future change pulls a non-pure import into this graph, the build fails.
 *
 * ```typescript
 * import { discFolderInfo } from "taglib-wasm/disc-folder";
 * discFolderInfo("CD1"); // { kind: "exact", number: 1, ... }
 * ```
 */
export * from "./src/folder-api/group-albums.ts";
export type { FolderScanResult } from "./src/folder-api/types.ts";
